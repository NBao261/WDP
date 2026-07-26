import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { verifyToken } from '../middlewares/auth.middleware';

const router = Router();

// Only allow image uploads
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/gif'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIMETYPES.includes(file.mimetype) && ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh (JPEG, PNG, WebP, BMP, GIF)'));
    }
  },
});

// Tất cả route upload yêu cầu đăng nhập
router.use(verifyToken);

/**
 * POST /upload/image
 * Upload ảnh đơn giản (không OCR) — dùng cho xe không có biển số.
 * Trả về: { success: true, data: { imageUrl: '/uploads/vehicles/<filename>' } }
 */
router.post('/image', upload.single('image'), (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'Không có file ảnh' });
    }

    const dir = path.join(__dirname, '../../public/uploads/vehicles');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `vehicle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    fs.writeFileSync(path.join(dir, filename), file.buffer);

    const imageUrl = `/uploads/vehicles/${filename}`;

    return res.json({
      success: true,
      data: { imageUrl },
    });
  } catch (error: any) {
    console.error('Upload image error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Upload thất bại' });
  }
});

export default router;

