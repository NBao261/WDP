import { AlertTriangle, Loader2, Search } from 'lucide-react';
import { EXCEPTION_TYPE_LABELS, ExceptionType } from '../../../../services/exception.service';

export const CreateExceptionForm = ({ logic }: any) => {
  return (
    <div className="p-6 overflow-y-auto space-y-6">
      <div>
        <label className="block text-[13px] font-bold text-[#060606] mb-2 uppercase tracking-wider">
          1. Tìm phiên gửi xe
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Nhập biển số hoặc mã vé..."
            value={logic.searchQuery}
            onChange={(e) => logic.setSearchQuery(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && logic.handleSearch()}
            className="flex-1 bg-white border border-[#e8e9e8] rounded-[8px] px-4 h-11 text-[14px] font-mono focus:outline-none focus:border-[#060606]"
          />
          <button
            onClick={logic.handleSearch}
            disabled={logic.isSearching}
            className="h-11 px-6 bg-[#1a1a1a] text-[#9FE870] font-bold rounded-[8px] hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {logic.isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}{' '}
            Tìm
          </button>
        </div>
        {logic.foundSession && (
          <div className="mt-4 p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px] flex justify-between items-center animate-in fade-in slide-in-from-top-2">
            <div>
              <div className="font-mono text-[18px] font-bold text-[#060606]">
                {logic.foundSession.licensePlate}
              </div>
              <div className="text-[12px] text-[#64748b] mt-0.5">
                Mã vé: {logic.foundSession.code} • Giờ vào:{' '}
                {new Date(logic.foundSession.checkInTime).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
            <button
              onClick={logic.handleReset}
              className="text-[12px] font-bold text-red-500 hover:text-red-700 underline underline-offset-2"
            >
              Đổi xe
            </button>
          </div>
        )}
      </div>

      <div
        className={`transition-opacity duration-300 ${logic.foundSession ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}
      >
        <label className="block text-[13px] font-bold text-[#060606] mb-4 uppercase tracking-wider pt-2 border-t border-gray-100">
          2. Chi tiết sự cố
        </label>
        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#64748b] mb-1.5">
              Loại sự cố <span className="text-red-500">*</span>
            </label>
            <select
              value={logic.exceptionType}
              onChange={(e) => logic.setExceptionType(e.target.value as ExceptionType)}
              className="w-full h-11 bg-white border border-[#e8e9e8] rounded-[8px] px-3 text-[14px] font-medium focus:outline-none focus:border-[#060606]"
            >
              {Object.entries(EXCEPTION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {logic.exceptionType === ExceptionType.LOST_CARD && logic.foundSession?.pricingPlanId && (
            <div className="animate-in fade-in slide-in-from-top-1">
              {logic.isFetchingFee ? (
                <div className="p-4 bg-gray-50 flex justify-center rounded-[8px]">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : logic.lostCardFee > 0 ? (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-[8px] flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-[13px] font-bold text-orange-900">
                      Phí làm lại thẻ (quy định theo loại xe)
                    </h5>
                    <p className="text-[14px] font-bold text-orange-700 mt-1">
                      {logic.lostCardFee.toLocaleString('vi-VN')} VNĐ
                    </p>
                    <p className="text-[12px] text-orange-800 mt-1">
                      Khoản phí này sẽ tự động được cộng vào tổng tiền khi khách hàng check-out.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[13px] font-medium text-[#64748b] mb-1.5">
                    Phụ phí làm lại thẻ (VNĐ) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={logic.surcharge}
                    onChange={(e) =>
                      logic.setSurcharge(e.target.value ? Number(e.target.value) : '')
                    }
                    placeholder="Quản lý chưa cài đặt mức phí, vui lòng tự nhập (VD: 50000)"
                    className="w-full bg-white border border-[#e8e9e8] rounded-[8px] px-4 h-11 text-[14px] focus:outline-none focus:border-[#060606]"
                  />
                </div>
              )}
            </div>
          )}
          <div>
            <label className="block text-[13px] font-medium text-[#64748b] mb-1.5">
              Mô tả tình huống <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={logic.description}
              onChange={(e) => logic.setDescription(e.target.value)}
              placeholder="Mô tả chi tiết nguyên nhân lỗi, tình huống xảy ra..."
              className="w-full bg-white border border-[#e8e9e8] rounded-[8px] p-3 text-[14px] focus:outline-none focus:border-[#060606] resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
