import { VehicleType } from '../../../../../services/vehicleType.service';
import { SlotAvailability } from './useCheckInState';

interface CheckInActionProps {
  vehicleTypes: VehicleType[];
  selectedVehicleTypeId: string;
  slotAvailability: SlotAvailability[];
  capacityLoaded: boolean;
  checkInError: string | null;
  isSubmitting: boolean;
  pendingClear: boolean;
  plate: string;
  handleCheckInClick: () => void;
}

export function CheckInAction({
  vehicleTypes,
  selectedVehicleTypeId,
  slotAvailability,
  capacityLoaded,
  checkInError,
  isSubmitting,
  pendingClear,
  plate,
  handleCheckInClick,
}: CheckInActionProps) {
  const selectedType = vehicleTypes.find((v) => v._id === selectedVehicleTypeId);
  const selectedTypeName = selectedType?.name || '';
  const availability = slotAvailability.find((s) => s.vehicleTypeId === selectedVehicleTypeId);
  const isFull = capacityLoaded && availability !== undefined && availability.availableCount === 0;

  return (
    <div className="flex flex-col gap-1 mt-1">
      <label className="block text-xs font-semibold text-[#060606]">Trạng thái</label>
      {(() => {
        if (checkInError) {
          return (
            <button
              onClick={handleCheckInClick}
              disabled={isSubmitting}
              className="w-full h-10 rounded-[6px] font-bold text-sm flex items-center justify-center transition-all bg-[#fdebea] text-[#d32f2f] border border-[#d32f2f]"
            >
              {isSubmitting ? 'Đang xử lý...' : checkInError}
            </button>
          );
        }
        if (isFull) {
          return (
            <button
              onClick={handleCheckInClick}
              disabled={isSubmitting}
              className="w-full h-10 rounded-[6px] font-bold text-sm flex items-center justify-center transition-all bg-[#d32f2f] text-white border border-[#d32f2f] hover:bg-[#c62828]"
            >
              {isSubmitting
                ? 'Đang xử lý...'
                : pendingClear
                  ? 'Mở chắn'
                  : `Bãi ${selectedTypeName} Đã Đầy`}
            </button>
          );
        }
        return (
          <button
            onClick={() => {
              if (pendingClear) return;
              handleCheckInClick();
            }}
            disabled={isSubmitting || pendingClear}
            className={`w-full h-10 rounded-[6px] font-bold text-sm flex items-center justify-center transition-all ${
              pendingClear
                ? 'bg-[#062F28] text-white'
                : isSubmitting
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : !plate
                    ? 'bg-[#fcfcfc] border border-[#e8e9e8] text-[#9b9b9b]'
                    : 'bg-[#a3c965] hover:bg-[#9cbd5a] text-[#2c4015] border border-[#a3c965]'
            }`}
          >
            {isSubmitting
              ? 'Đang xử lý...'
              : pendingClear
                ? 'Đang mở chắn...'
                : !plate
                  ? '—'
                  : 'Cho xe qua'}
          </button>
        );
      })()}
    </div>
  );
}
