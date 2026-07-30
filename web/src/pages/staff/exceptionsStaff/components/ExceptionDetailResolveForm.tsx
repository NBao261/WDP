import { ExceptionType } from '../../../../services/exception.service';
import { formatPlate } from '../../../../utils/format';

export const ExceptionDetailResolveForm = ({
  selectedException,
  canResolve,
  staffNote,
  setStaffNote,
  newLicensePlate,
  setNewLicensePlate,
  selectedFloorId,
  setSelectedFloorId,
  newSlotId,
  setNewSlotId,
  floors,
  availableSlots,
  isLoadingFloors,
  isLoadingSlots,
}: any) => {
  if (!canResolve) return null;
  return (
    <div>
      <h4 className="text-[12px] font-bold text-[#060606] uppercase tracking-wider mb-4 flex items-center gap-2">
        <span className="w-1.5 h-4 bg-[#f39c12] rounded-sm"></span>Thực hiện Xử lý Sự cố
      </h4>
      <div className="bg-[#fffdf5] border border-[#fdeab1] rounded-[10px] p-4 space-y-4 shadow-sm animate-in fade-in">
        {selectedException.typeEnum === ExceptionType.WRONG_PLATE && (
          <div>
            <label className="block text-[13px] font-medium text-[#060606] mb-1.5">
              Biển số đúng (Hệ thống sẽ cập nhật lại vé) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newLicensePlate}
              onChange={(e) => setNewLicensePlate(formatPlate(e.target.value))}
              placeholder="Nhập biển số đúng..."
              className="w-full bg-white border border-[#fdeab1] rounded-[8px] px-3 h-10 text-[13px] font-mono focus:outline-none focus:border-[#f39c12]"
            />
          </div>
        )}
        {selectedException.typeEnum === ExceptionType.WRONG_ZONE && (
          <div className="space-y-3">
            <p className="text-[12px] text-[#c77700] mb-2 leading-relaxed">
              Lưu ý: Hệ thống chỉ hiển thị các Vị trí đang Trống hoặc đang bị Khoá, và phải đúng
              loại xe ({selectedException.vehicleType}).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-medium text-[#060606] mb-1.5">
                  Chọn Tầng
                </label>
                <select
                  value={selectedFloorId}
                  onChange={(e) => {
                    setSelectedFloorId(e.target.value);
                    setNewSlotId('');
                  }}
                  className="w-full bg-white border border-[#fdeab1] rounded-[8px] px-3 h-10 text-[13px] focus:outline-none focus:border-[#f39c12]"
                  disabled={isLoadingFloors}
                >
                  <option value="">-- Chọn tầng --</option>
                  {floors.map((f: any) => (
                    <option key={f._id} value={f._id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#060606] mb-1.5">
                  Vị trí đỗ mới <span className="text-red-500">*</span>
                </label>
                <select
                  value={newSlotId}
                  onChange={(e) => setNewSlotId(e.target.value)}
                  className="w-full bg-white border border-[#fdeab1] rounded-[8px] px-3 h-10 text-[13px] focus:outline-none focus:border-[#f39c12]"
                  disabled={!selectedFloorId || isLoadingSlots}
                >
                  <option value="">-- Chọn vị trí --</option>
                  {availableSlots.map((s: any) => (
                    <option key={s._id} value={s._id}>
                      {s.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
        <div>
          <label className="block text-[13px] font-medium text-[#060606] mb-1.5">
            Ghi chú xử lý của bạn <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            value={staffNote}
            onChange={(e) => setStaffNote(e.target.value)}
            placeholder="Nhập ghi chú xử lý (VD: Đã cập nhật lại biển số đúng cho khách)..."
            className="w-full bg-white border border-[#fdeab1] rounded-[8px] p-3 text-[13px] focus:outline-none focus:border-[#f39c12] resize-none"
          />
        </div>
      </div>
    </div>
  );
};
