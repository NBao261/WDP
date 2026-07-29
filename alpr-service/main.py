"""
ALPR Service — Automatic License Plate Recognition
Pipeline: YOLO detect → crop plate → multi-pass PaddleOCR → VN format fix

Optimizations applied (based on research papers):
  [1] YOLO+OCR pipeline     : DOI 10.1109/ACCESS.2024.3430857
  [2] Proportional padding  : DOI 10.48084/etasr.5476
  [3] Bidirectional char fix: DOI 10.1109/ACCESS.2023.3240439
  [4] VN format validator   : DOI 10.5220/0013524700004619
  [5] Early-exit multi-pass : DOI 10.1007/978-3-031-50580-5_25
"""

import os
import sys
import ctypes
import cv2
import numpy as np
import re
import shutil
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse

# Fix Windows DLL conflicts khi torch load trong uvicorn worker
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("YOLO_VERBOSE", "False")
os.environ.setdefault("PYTHONUNBUFFERED", "1")

# Preload torch DLLs truoc khi uvicorn worker chiem quyen process
# (tranh WinError 127 khi load shm.dll trong subprocess)
try:
    import torch as _torch
    _torch_lib = Path(_torch.__file__).parent / "lib"
    # Them torch lib vao PATH cua process hien tai
    os.add_dll_directory(str(_torch_lib))
    # Preload shm.dll bang ctypes truoc
    _shm = _torch_lib / "shm.dll"
    if _shm.exists():
        ctypes.CDLL(str(_shm))
    print(f"[INIT] torch {_torch.__version__} preloaded, lib: {_torch_lib}")
except Exception as _e:
    print(f"[INIT] torch preload warning: {_e}")

# Globals
ocr  = None   # PaddleOCR instance
yolo = None   # YOLO plate detector

_PLATE_MODEL_PATH = Path(__file__).parent / "yolov8n_plate.pt"
_HF_REPO          = "Koushim/yolov8-license-plate-detection"
_HF_FILENAME      = "best.pt"


@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_models()
    yield


app = FastAPI(title="ALPR Service", lifespan=lifespan)


def _load_models():
    global ocr, yolo

    # 1. PaddleOCR
    try:
        from paddleocr import PaddleOCR
        ocr = PaddleOCR(
            use_textline_orientation=False,
            lang='en',
            text_det_thresh=0.2,
            text_det_box_thresh=0.3,
            det_limit_side_len=960,
            ocr_version='PP-OCRv3'
        )
        print("[OK] PaddleOCR loaded")
    except Exception as e:
        print(f"[FAIL] PaddleOCR: {e}")
        ocr = None

    # 2. YOLO license plate detector
    try:
        from ultralytics import YOLO

        if not _PLATE_MODEL_PATH.exists():
            print(f"[YOLO] Downloading plate model from HuggingFace ({_HF_REPO})...")
            try:
                from huggingface_hub import hf_hub_download, login as hf_login

                hf_token = os.environ.get("HF_TOKEN")
                if hf_token:
                    hf_login(token=hf_token, add_to_git_credential=False)
                    print("[YOLO] Logged in to HuggingFace via HF_TOKEN")

                cached = hf_hub_download(
                    repo_id=_HF_REPO,
                    filename=_HF_FILENAME,
                    token=hf_token,
                )
                import shutil
                shutil.copy2(cached, _PLATE_MODEL_PATH)
                print(f"[OK] Plate model saved → {_PLATE_MODEL_PATH}")
            except Exception as dl_err:
                print(f"[WARN] HF download failed: {dl_err}")
                print("[INFO] Set env var HF_TOKEN=hf_xxx to authenticate, or run: huggingface-cli login")
                yolo = None
                return

        yolo = YOLO(str(_PLATE_MODEL_PATH))
        size_kb = _PLATE_MODEL_PATH.stat().st_size // 1024
        print(f"[OK] YOLO plate detector loaded ({size_kb} KB)")

    except ImportError:
        print("[WARN] ultralytics not installed — run: pip install ultralytics huggingface_hub")
        yolo = None
    except Exception as e:
        print(f"[WARN] YOLO unavailable: {e} — falling back to full-image OCR")
        yolo = None


# Preprocessing

def _ensure_min_height(img: np.ndarray, min_h: int = 64) -> np.ndarray:
    h, w = img.shape[:2]
    if h < min_h:
        scale = min_h / h
        img = cv2.resize(img, (int(w * scale), min_h), interpolation=cv2.INTER_CUBIC)
    return img


def preprocess_normal(img: np.ndarray) -> np.ndarray:
    """Tieu chuan: CLAHE + sharpen (PP. [1][2])"""
    img = _ensure_min_height(img)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    gray = cv2.filter2D(gray, -1, kernel)
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)


def preprocess_glare(img: np.ndarray) -> np.ndarray:
    """Xu ly choi sang: LAB color + adaptive threshold"""
    img = _ensure_min_height(img)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))
    l = clahe.apply(l)
    result = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
    gray = cv2.cvtColor(result, cv2.COLOR_BGR2GRAY)
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 10
    )
    return cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)


def preprocess_dark(img: np.ndarray) -> np.ndarray:
    """Xu ly thieu sang: gamma correction 2.0 + CLAHE manh (PP. [2])"""
    img = _ensure_min_height(img)
    table = np.array([((i / 255.0) ** (1.0 / 2.0)) * 255 for i in range(256)]).astype("uint8")
    bright = cv2.LUT(img, table)
    gray = cv2.cvtColor(bright, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    gray = cv2.filter2D(gray, -1, kernel)
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)


def preprocess_morph(img: np.ndarray) -> np.ndarray:
    """
    Morphological operations de lam net ky tu tren crop nho (PP. [3]).
    Huu ich khi bien so bi nhoe nhe.
    """
    img = _ensure_min_height(img)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    return cv2.cvtColor(opened, cv2.COLOR_GRAY2BGR)


# PaddleOCR Output Parser

def parse_paddle_result(result) -> list:
    """
    Parse output cua PaddleOCR v2.x (list) hoac v3.6 (dict).
    Returns list of (y_center, x_center, text, confidence).
    """
    items = []
    if result is None:
        return items

    if isinstance(result, dict):
        texts  = result.get('rec_texts', [])
        scores = result.get('rec_scores', [])
        polys  = result.get('dt_polys', [])
        for i, text in enumerate(texts):
            bbox   = polys[i] if i < len(polys) else [[0,0]]*4
            conf   = float(scores[i]) if i < len(scores) else 0.5
            yc = sum(pt[1] for pt in bbox) / 4
            xc = sum(pt[0] for pt in bbox) / 4
            items.append((yc, xc, str(text).strip(), conf))
        return items

    data = result
    if len(data) == 1 and isinstance(data[0], list) and data[0] and isinstance(data[0][0], list):
        data = data[0]
    for line in data:
        if isinstance(line, (list, tuple)) and len(line) >= 2:
            bbox, text_info = line[0], line[1]
            if isinstance(text_info, (list, tuple)) and len(text_info) >= 2:
                text, conf = str(text_info[0]).strip(), float(text_info[1])
            elif isinstance(text_info, str):
                text, conf = text_info.strip(), 0.5
            else:
                continue
            yc = sum(pt[1] for pt in bbox) / 4
            xc = sum(pt[0] for pt in bbox) / 4
            items.append((yc, xc, text, conf))
    return items


def assemble_rows(items: list, row_gap_ratio: float = 0.4) -> str:
    """Sap xep text theo dong (Y) roi cot (X) → ghep bien so 2 dong thanh 1 dong."""
    if not items:
        return ""
    items = sorted(items, key=lambda i: i[0])
    y_vals   = [i[0] for i in items]
    y_range  = max(y_vals) - min(y_vals) if len(y_vals) > 1 else 0
    threshold = y_range * row_gap_ratio if y_range > 10 else 999

    rows, cur = [], [items[0]]
    for item in items[1:]:
        if item[0] - cur[-1][0] > threshold:
            rows.append(cur)
            cur = [item]
        else:
            cur.append(item)
    rows.append(cur)

    return " ".join(
        " ".join(i[2] for i in sorted(row, key=lambda i: i[1]))
        for row in rows
    )


def avg_conf(items: list) -> float:
    return sum(i[3] for i in items) / len(items) if items else 0.0


# VN Plate Normalization (bidirectional, position-aware - PP. [3][4])

_D2L = {'8': 'B', '0': 'D', '6': 'G', '1': 'I', '5': 'S'}   # digit→letter
_L2D = {'O': '0', 'I': '1', 'B': '8', 'S': '5', 'Z': '2',    # letter→digit
        'G': '6', 'D': '0'}

_VN_PLATE_RE = re.compile(
    r'^(?:'
    r'\d{2}[A-Z]{1,2}\d?-[\d.]{4,6}'
    r'|'
    r'\d{2}-[A-Z]{1,2}[\d.]{4,6}'
    r')$'
)


def fix_vn_plate(raw: str) -> str:
    s = raw.strip().upper()

    s = re.sub(r'[*#@\\\\/|]', '-', s)
    s = re.sub(r'[^A-Z0-9\s.\-]', '', s)
    s = re.sub(r'\s+', ' ', s).strip()

    s = re.sub(r'^(\d{2}-[A-Z]{1,2}\d?) (\d)', r'\1-\2', s)
    s = re.sub(r'^(\d{2}[A-Z]{1,2}\d?) (\d)', r'\1-\2', s)

    s = s.replace(' ', '')

    s = re.sub(r'^(\d{2})-([A-Z]{1,2}\d?)-', r'\1\2-', s)

    if '-' not in s:
        s = re.sub(r'^(\d{2}[A-Z]{1,2})(\d)', r'\1-\2', s)
        if '-' not in s:
            s = re.sub(r'^(\d{2}[A-Z]{1,2})(\d)', r'\1-\2', s)
            s = re.sub(r'^(\d{2})([A-Z])', r'\1-\2', s)

    parts = s.split('-', 1)
    if len(parts) != 2:
        return s
    prefix_raw, number_raw = parts[0], parts[1]

    m_pre = re.match(r'^(\d{2})([A-Z0-9]*)$', prefix_raw)
    if not m_pre:
        return s
    province = m_pre.group(1)
    series   = list(m_pre.group(2))

    if series and series[0] in _D2L:
        series[0] = _D2L[series[0]]

    if not series and number_raw and (number_raw[0].isalpha() or number_raw[0] in _D2L):
        after_letter = number_raw[1:]
        has_dot = '.' in after_letter
        pure_digits = len(re.sub(r'[^0-9]', '', after_letter))

        is_two_char = False
        if pure_digits >= 6:
            is_two_char = True
        elif pure_digits == 5 and not has_dot:
            is_two_char = False
            
        if after_letter and (after_letter[0].isalpha() or after_letter[0] in _D2L):
            is_two_char = True

        if is_two_char and after_letter:
            series = [number_raw[0], after_letter[0]]
            number_raw = after_letter[1:]
        else:
            series = [number_raw[0]]
            number_raw = after_letter

        for i, c in enumerate(series):
            if c in _D2L: series[i] = _D2L[c]

    number = list(number_raw)
    for i, c in enumerate(number):
        if c == '.':
            continue
        if c in _L2D:
            number[i] = _L2D[c]

    number_str = ''.join(number)
    
    m = re.match(r'^([\d.]+)', number_str)
    if m:
        number_str = m.group(1).rstrip('.')
    else:
        number_str = ""

    series_str = ''.join(series)

    if series_str:
        return f"{province}{series_str}-{number_str}"
    else:
        return f"{province}-{number_str}"


def is_valid_vn_plate(text: str) -> bool:
    return bool(_VN_PLATE_RE.match(text.replace(' ', '')))


# YOLO Plate Detection

def detect_plates(img: np.ndarray, conf_thresh: float = 0.25) -> list:
    """
    Dung YOLO de detect bien so xe (PP. [1] DOI 10.1109/ACCESS.2024.3430857).
    Returns: list of (crop_image, yolo_confidence)
    """
    if yolo is None:
        return []

    try:
        results = yolo.predict(img, conf=conf_thresh, verbose=False, imgsz=640)
    except Exception as e:
        print(f"  [YOLO] predict error: {e}")
        return []

    crops = []
    h, w  = img.shape[:2]

    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = (int(v) for v in box.xyxy[0].tolist())
            det_conf = float(box.conf[0])

            pw = max(6, int((x2 - x1) * 0.15))
            ph = max(4, int((y2 - y1) * 0.40))
            x1 = max(0, x1 - pw)
            y1 = max(0, y1 - ph)
            x2 = min(w, x2 + pw)
            y2 = min(h, y2 + ph)

            crop = img[y1:y2, x1:x2]
            if crop.size > 0 and (x2 - x1) > 20 and (y2 - y1) > 10:
                crops.append((crop, det_conf))
                print(f"  [YOLO] plate [{x1},{y1},{x2},{y2}] det_conf={det_conf:.2f}")

    return crops


# Multi-pass OCR với Early-Exit

_RESIZE_MAX_W  = 640
_EARLY_EXIT    = 0.88


def _resize(img: np.ndarray, min_w: int = 480) -> np.ndarray:
    h, w = img.shape[:2]
    if w < min_w:
        scale = min_w / w
        img = cv2.resize(img, (min_w, int(h * scale)), interpolation=cv2.INTER_CUBIC)
    return img


def preprocess_binary(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)


def ocr_image(img: np.ndarray) -> tuple[str, float]:
    img = _resize(img)

    preprocessors = [
        ("original", lambda: img),
        ("binary",   lambda: preprocess_binary(img)),
        ("normal",   lambda: preprocess_normal(img)),
        ("morph",    lambda: preprocess_morph(img)),
        ("glare",    lambda: preprocess_glare(img)),
        ("dark",     lambda: preprocess_dark(img)),
    ]

    best = None

    for name, make_img in preprocessors:
        try:
            processed  = make_img()
            result     = ocr.ocr(processed, cls=False)
            items      = parse_paddle_result(result)
            if not items:
                continue

            raw  = assemble_rows(items)
            print(f"[DEBUG] raw: {raw}", flush=True)
            noise_words = {"honda", "yamaha", "suzuki", "sym", "piaggio", "hotline", "xemay", "xe"}
            words = [w for w in raw.split() if w.lower() not in noise_words and not w.lower().startswith("hotline")]
            
            best_sub_text, found_valid = "", False
            for length in range(1, min(5, len(words) + 1)):
                for i in range(len(words) - length + 1):
                    sub_raw = " ".join(words[i:i+length])
                    sub_text = fix_vn_plate(sub_raw)
                    if is_valid_vn_plate(sub_text):
                        best_sub_text = sub_text
                        found_valid = True
                        break
                if found_valid:
                    break
                    
            if found_valid:
                text = best_sub_text
                conf = avg_conf(items)
                valid = True
            else:
                text = fix_vn_plate(raw)
                conf = avg_conf(items)
                valid = is_valid_vn_plate(text)

            alnum = re.sub(r'[^A-Z0-9]', '', text)

            if len(alnum) >= 4:
                print(f"    [{name}] → '{text}' (conf={conf:.3f}, valid={valid})")
                
                if best is None:
                    best = (text, conf, valid)
                else:
                    best_text, best_conf, best_valid = best
                    if valid and not best_valid:
                        best = (text, conf, valid)
                    elif valid == best_valid and conf > best_conf:
                        best = (text, conf, valid)
                        
                if conf >= _EARLY_EXIT and valid:
                    print(f"    [early-exit] conf={conf:.3f}")
                    return (best[0], best[1])

        except Exception as e:
            print(f"    [{name}] OCR error: {e}")

    return (best[0], best[1]) if best else ("", 0.0)


# FastAPI Routes

@app.get("/health")
def health():
    return {
        "status": "ok",
        "engine": "PaddleOCR-v3.6",
        "detector": "YOLO-plate" if yolo else "none (full-image fallback)",
        "ocr": "ready" if ocr else "unavailable",
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Not an image")
    if ocr is None:
        raise HTTPException(503, "OCR engine not initialized")

    try:
        contents = await file.read()

        MAX_FILE_SIZE = 10 * 1024 * 1024
        if len(contents) == 0:
            raise HTTPException(400, "Empty file")
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(413, f"File too large ({len(contents) // (1024*1024)}MB). Max: 10MB")

        nparr    = np.frombuffer(contents, np.uint8)
        img      = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Cannot decode image")

        print(f"\n[ALPR] Image {img.shape[1]}x{img.shape[0]}")

        all_results = []

        plate_crops = detect_plates(img)

        if plate_crops:
            print(f"[ALPR] YOLO found {len(plate_crops)} plate(s)")
            for i, (crop, det_conf) in enumerate(plate_crops):
                text, ocr_conf = ocr_image(crop)
                if not text:
                    continue
                combined = round(det_conf * 0.30 + ocr_conf * 0.70, 4)
                all_results.append({
                    "text":       text,
                    "confidence": combined,
                    "valid":      is_valid_vn_plate(text),
                    "source":     "yolo+ocr",
                })

        if not any(r["valid"] for r in all_results):
            print("[ALPR] Fallback: full-image OCR")
            text, conf = ocr_image(img)
            if text:
                all_results.append({
                    "text":       text,
                    "confidence": round(conf, 4),
                    "valid":      is_valid_vn_plate(text),
                    "source":     "ocr-only",
                })

        all_results.sort(key=lambda x: (x["valid"], x["confidence"]), reverse=True)

        print(f"[ALPR] Final: {all_results}")
        return JSONResponse({"results": all_results})

    except Exception as e:
        import traceback
        print(f"[ALPR] Error: {e}")
        traceback.print_exc()
        raise HTTPException(500, str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)