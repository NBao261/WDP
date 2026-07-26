import { ExceptionType } from '../../../../services/exception.service';
import { getOptimizedImageUrl } from '../../../../utils/cloudinary';

export const ExceptionInfoBlocks = ({ selectedException, parkingLocation }: any) => {
  const getImageUrl = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return getOptimizedImageUrl(path);
    const SERVER_URL = (
      import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'
    ).replace(/\/api\/v1\/?$/, '');
    return `${SERVER_URL}${path.startsWith('/') ? path : `/${path}`}`;
  };

  return (
    <>
      <div>
        <h4 className="text-[12px] font-bold text-[#060606] uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-[#9FE870] rounded-sm"></span>Thông tin xe và lượt gửi
        </h4>
        <div className="bg-white border border-[#e8e9e8] rounded-[10px] p-4 space-y-3 shadow-sm">
          <div className="flex justify-between text-[13px]">
            <span className="text-[#6b6b6b]">Biển số:</span>
            <span className="font-mono font-bold text-[14px] text-[#060606]">
              {selectedException.plate}
            </span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-[#6b6b6b]">Loại xe:</span>
            <span className="font-medium text-[#060606]">{selectedException.vehicleType}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-[#6b6b6b]">Mã thẻ:</span>
            <span className="font-mono font-medium text-[#060606]">
              {selectedException.cardCode}
            </span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-[#6b6b6b]">Giờ vào bãi:</span>
            <span className="font-medium text-[#060606]">{selectedException.checkInTime}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-[#6b6b6b]">Vị trí đỗ hiện tại:</span>
            <span className="font-medium text-[#060606]">{parkingLocation}</span>
          </div>
        </div>
      </div>
      <div>
        <h4 className="text-[12px] font-bold text-[#060606] uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-[#ef4444] rounded-sm"></span>Thông tin sự cố
        </h4>
        <div className="bg-white border border-[#e8e9e8] rounded-[10px] p-4 space-y-3 shadow-sm">
          <div className="flex justify-between text-[13px]">
            <span className="text-[#6b6b6b]">Loại sự cố:</span>
            <span className="font-medium text-[#060606]">{selectedException.type}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-[#6b6b6b]">Thời gian ghi nhận:</span>
            <span className="font-medium text-[#060606]">{selectedException.time}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-[#6b6b6b]">Người báo cáo:</span>
            <span className="font-medium text-[#060606]">
              {selectedException.source === 'driver' ? selectedException.driverName : selectedException.staffName}
            </span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-[#6b6b6b]">Phụ phí yêu cầu:</span>
            <span className="font-bold text-[#b03030]">
              {selectedException.surcharge > 0
                ? `${selectedException.surcharge.toLocaleString('vi-VN')} VNĐ`
                : '0 VNĐ'}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#e8e9e8]">
            <span className="text-[12px] text-[#6b6b6b] block mb-1">
              Mô tả chi tiết từ người báo cáo:
            </span>
            <p className="text-[13px] text-[#060606] leading-relaxed">
              {selectedException.description || 'Không có mô tả chi tiết.'}
            </p>
          </div>
        </div>
      </div>
      {/* Bằng chứng */}
      {(selectedException.actualPlate ||
        selectedException.expectedPlate ||
        selectedException.checkInImage ||
        selectedException.checkOutImage ||
        selectedException.excCardCode) && (
        <div>
          <h4 className="text-[12px] font-bold text-[#060606] uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[#3b82f6] rounded-sm"></span>Dữ liệu bằng chứng
          </h4>
          <div className="bg-white border border-[#e8e9e8] rounded-[10px] p-4 space-y-4 shadow-sm">
            {(selectedException.expectedPlate || selectedException.actualPlate) && (
              <div className="grid grid-cols-2 gap-4">
                {selectedException.expectedPlate && (
                  <div>
                    <span className="text-[12px] text-[#6b6b6b] block mb-1">
                      Biển số đã đăng ký:
                    </span>
                    <span className="inline-block font-mono font-bold text-[14px] text-[#060606] px-2.5 py-1 bg-gray-100 rounded-md border border-gray-200">
                      {selectedException.expectedPlate}
                    </span>
                  </div>
                )}
                {selectedException.actualPlate && (
                  <div>
                    <span className="text-[12px] text-[#6b6b6b] block mb-1">
                      Biển số chụp được:
                    </span>
                    <span className="inline-block font-mono font-bold text-[14px] text-[#ef4444] px-2.5 py-1 bg-red-50 rounded-md border border-red-200">
                      {selectedException.actualPlate}
                    </span>
                  </div>
                )}
              </div>
            )}

            {selectedException.excCardCode && (
              <div>
                <span className="text-[12px] text-[#6b6b6b] block mb-1">
                  Mã thẻ quẹt (thực tế):
                </span>
                <span className="font-mono font-bold text-[13px] text-[#060606]">
                  {selectedException.excCardCode}
                </span>
              </div>
            )}

            {(selectedException.checkInImage || selectedException.checkOutImage) && (
              <div
                className={`grid ${selectedException.checkInImage && selectedException.checkOutImage ? 'grid-cols-2' : 'grid-cols-1'} gap-3 pt-3 border-t border-[#e8e9e8]`}
              >
                {selectedException.checkInImage && (
                  <div className="flex flex-col bg-[#f5f5f4] rounded-lg border border-[#e8e9e8] p-2">
                    <span className="text-[12px] font-semibold text-[#6b6b6b] block mb-2 text-center">
                      Ảnh xe lúc vào bãi:
                    </span>
                    <img
                      src={getImageUrl(selectedException.checkInImage)}
                      alt="Check In"
                      className="w-full max-h-[350px] object-contain rounded-md bg-black/5"
                    />
                  </div>
                )}
                {selectedException.checkOutImage && (
                  <div className="flex flex-col bg-[#f5f5f4] rounded-lg border border-[#e8e9e8] p-2">
                    <span className="text-[12px] font-semibold text-[#6b6b6b] block mb-2 text-center">
                      Ảnh xe lúc ra bãi:
                    </span>
                    <img
                      src={getImageUrl(selectedException.checkOutImage)}
                      alt="Check Out"
                      className="w-full max-h-[350px] object-contain rounded-md bg-black/5"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Ảnh từ driver */}
      {selectedException.images && selectedException.images.length > 0 && (
        <div>
          <h4 className="text-[12px] font-bold text-[#060606] uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[#8b5cf6] rounded-sm"></span>Ảnh đính kèm từ khách hàng
          </h4>
          <div className="bg-white border border-[#e8e9e8] rounded-[10px] p-4 shadow-sm">
            <div className={`grid ${selectedException.images.length === 1 ? 'grid-cols-1' : selectedException.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-3`}>
              {selectedException.images.map((img: string, idx: number) => (
                <div key={idx} className="flex flex-col bg-[#f5f5f4] rounded-lg border border-[#e8e9e8] p-2">
                  <img
                    src={getImageUrl(img)}
                    alt={`Driver Upload ${idx + 1}`}
                    className="w-full max-h-[350px] object-contain rounded-md bg-black/5"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
