import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useGlobalExceptionLogic } from './useGlobalExceptionLogic';
import { EXCEPTION_TYPE_LABELS, ExceptionType } from '../../../../services/exception.service';
import { createPortal } from 'react-dom';

interface GlobalExceptionPanelProps {
  coPlateCam: string;
  checkOutImage?: string | null;
  currentSession?: any;
  onClose: () => void;
  onExceptionCreated?: () => void;
}

export default function GlobalExceptionPanel({
  coPlateCam,
  checkOutImage,
  currentSession,
  onClose,
  onExceptionCreated,
}: GlobalExceptionPanelProps) {
  const logic = useGlobalExceptionLogic(
    currentSession,
    coPlateCam,
    checkOutImage,
    onClose,
    onExceptionCreated
  );

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 max-w-[420px] w-full bg-white shadow-[-8px_0_32px_rgba(0,0,0,0.12)] border-l border-[#e8e9e8] flex flex-col animate-in slide-in-from-right duration-300 ease-out">
        <div className="px-6 py-7 border-b border-[#e8e9e8] flex justify-between items-start bg-gray-50/50">
          <div>
            <h3 className="text-[18px] font-bold text-[#ef4444] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Báo Cáo Sự Cố
            </h3>
            <p className="text-[12px] text-[#6b6b6b] mt-1">
              {logic.activeSession?._id
                ? `Phiên #${logic.activeSession.code || logic.activeSession._id}`
                : '⚠ Không có phiên xe — hãy tìm vé trước'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#6b6b6b] hover:text-black p-1 rounded-md hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {!logic.activeSession && (
            <div className="mb-8">
              <label className="block text-[13px] font-bold text-[#060606] mb-2 uppercase tracking-wider">
                Tìm phiên gửi xe
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
                  className="h-11 px-6 bg-[#060606] text-white font-bold rounded-[8px] hover:bg-[#222] transition-colors disabled:opacity-50"
                >
                  {logic.isSearching ? 'Tìm...' : 'Tìm'}
                </button>
              </div>
            </div>
          )}

          {logic.activeSession && (
            <div className="bg-[#f9faf9] rounded-[12px] p-5 mb-8 border border-[#e8e9e8] relative">
              {logic.searchedSession && (
                <button
                  onClick={() => logic.setSearchedSession(null)}
                  className="absolute top-3 right-3 text-[12px] font-bold text-red-500 hover:text-red-700 underline"
                >
                  Bỏ tìm kiếm
                </button>
              )}
              <div className="bg-white border border-[#e8e9e8] rounded-[8px] p-3 mb-4 text-center shadow-sm">
                <div className="font-mono text-[24px] font-bold text-[#060606] tracking-widest uppercase">
                  {logic.searchedSession
                    ? logic.searchedSession.licensePlate
                    : coPlateCam || currentSession?.licensePlate || '—'}
                </div>
                <div className="text-sm font-medium text-[#6b6b6b] mt-1">
                  {(logic.activeSession?.vehicleTypeId as any)?.name || 'Chưa xác định'}
                </div>
              </div>
              <div className="space-y-2 text-[13px] text-[#6b6b6b] font-medium border-t border-gray-100 pt-3">
                <div className="flex justify-between">
                  <span>Biển số vào (Ghi nhận):</span>
                  <span className="text-[#060606] font-mono">
                    {logic.activeSession?.licensePlate || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Mã vé:</span>
                  <span className="text-[#060606]">{logic.activeSession?.code || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Mã thẻ:</span>
                  <span className="text-[#060606] font-mono">{logic.activeSession?.cardCode || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Giờ vào:</span>
                  <span className="text-[#060606]">
                    {logic.activeSession?.checkInTime
                      ? new Date(logic.activeSession.checkInTime).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cổng vào:</span>
                  <span className="text-[#060606]">{logic.activeSession?.gateIn || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bãi xe:</span>
                  <span className="text-[#060606]">{(logic.activeSession?.facilityId as any)?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vị trí:</span>
                  <span className="text-[#060606]">
                    {(logic.activeSession?.floorId as any)?.name || '—'} — {(logic.activeSession?.slotId as any)?.code || '—'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-[13px] font-bold mb-2 text-[#060606]">Loại sự cố</label>
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

            {logic.exceptionType === ExceptionType.LOST_CARD &&
              logic.activeSession?.pricingPlanId && (
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
              <label className="block text-[13px] font-bold mb-2 text-[#060606]">
                Mô tả chi tiết tình huống <span className="text-[#ef4444]">*</span>
              </label>
              <textarea
                rows={4}
                value={logic.note}
                onChange={(e) => logic.setNote(e.target.value)}
                className="w-full bg-white border border-[#e8e9e8] rounded-[8px] p-3 text-[14px] focus:outline-none focus:border-[#060606] resize-none"
                placeholder="Mô tả chi tiết nguyên nhân lỗi, tình huống xảy ra..."
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-[#e8e9e8] flex gap-3 bg-white">
          <button
            onClick={onClose}
            disabled={logic.isSubmitting}
            className="flex-[1] h-11 border border-[#e8e9e8] bg-white rounded-[8px] text-[#060606] font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={logic.handleSubmit}
            disabled={logic.isSubmitting || !logic.activeSession?._id}
            className="flex-[2] h-11 bg-[#ef4444] text-white font-bold rounded-[8px] hover:bg-red-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {logic.isSubmitting ? 'Đang gửi...' : 'Gửi Sự Cố'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
