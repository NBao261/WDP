import { ImagePlus, RefreshCw, X } from 'lucide-react';
import React from 'react';
import { getImageUrl } from '../../../../../services/api';

interface CheckInOCRProps {
  previewUrl: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  isUploading: boolean;
  clearPreview: () => void;
  handleImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function CheckInOCR({
  previewUrl,
  fileInputRef,
  isUploading,
  clearPreview,
  handleImageUpload,
}: CheckInOCRProps) {
  // Khung ảnh xe ra vào (OCR)
  return (
    <div className="flex-1 flex flex-col gap-1.5 relative">
      <label className="block text-[10px] font-semibold text-[#6b6b6b]">Ảnh biển số Vào</label>
      {!previewUrl ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="h-full flex-1 w-full border border-dashed border-[#999] rounded-[6px] flex flex-col items-center justify-center gap-2 hover:border-[#9FE870] hover:bg-[#f5ffe8] transition-all duration-200 disabled:opacity-60 bg-[#fcfcfc] min-h-[150px]"
        >
          {isUploading ? (
            <RefreshCw className="w-6 h-6 animate-spin text-[#8bc34a]" />
          ) : (
            <div className="flex flex-col items-center">
              <img src="/Logo_chu.png" alt="LYNC PARK" className="h-24 mb-2 object-contain" />
              <ImagePlus className="w-4 h-4 text-[#aaa] mb-2" />
              <span className="text-[10px] font-semibold text-[#6b6b6b]">
                Chụp / Upload ảnh biển số (OCR)
              </span>
              <span className="text-[9px] text-[#aaa]">
                Hỗ trợ JPG, PNG — chụp thẳng góc, đủ sáng
              </span>
            </div>
          )}
        </button>
      ) : (
        <div className="relative border border-[#e8e9e8] rounded-[6px] overflow-hidden h-full flex-1 bg-[#f5f5f4] min-h-[150px]">
          <img
            src={getImageUrl(previewUrl)}
            alt="preview"
            className="w-full h-full object-contain"
          />
          <button
            type="button"
            onClick={clearPreview}
            className="absolute top-2 right-2 w-6 h-6 bg-black/70 text-white rounded-full flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        className="hidden"
        onChange={handleImageUpload}
      />
    </div>
  );
}
