import React from 'react';
import { formatPlate } from '../../../../../utils/format';
import { VehicleType } from '../../../../../services/vehicleType.service';

interface CheckInFormProps {
  displayPlate: string;
  plate: string;
  setPlate: (val: string) => void;
  checkInError: string | null;
  setCheckInError: (val: string | null) => void;
  isSubmitting: boolean;
  pendingClear: boolean;
  handleCheckInEnter: () => void;
  selectedVehicleTypeId: string;
  setSelectedVehicleTypeId: (val: string) => void;
  vehicleTypes: VehicleType[];
  ownerName?: string;
}

export function CheckInForm({
  displayPlate,
  plate,
  setPlate,
  checkInError,
  setCheckInError,
  isSubmitting,
  pendingClear,
  handleCheckInEnter,
  selectedVehicleTypeId,
  setSelectedVehicleTypeId,
  vehicleTypes,
  ownerName,
}: CheckInFormProps) {
  return (
    <>
      <div className="flex flex-col gap-1 mt-1">
        <label className="block text-xs font-semibold text-[#060606]">Biển số xe vào</label>
        <input
          type="text"
          value={displayPlate}
          readOnly
          tabIndex={-1}
          disabled={isSubmitting || pendingClear}
          className={`w-full h-12 text-2xl text-center font-mono px-3 border rounded-[6px] uppercase font-bold outline-none transition-all duration-200 disabled:opacity-70 cursor-not-allowed pointer-events-none select-none
            ${
              checkInError
                ? 'bg-[#fdebea] border-[#d32f2f] text-[#d32f2f]'
                : displayPlate
                  ? 'bg-[#f0f9e8] border-[#9FE870] text-[#062F28]'
                  : 'bg-[#fdfdfd] border-[#e8e9e8] text-[#9b9b9b] focus:border-[#9FE870]'
            }`}
          placeholder="XXX-XX-XXXXX"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-1">
        <div className="flex flex-col gap-1">
          <label className="block text-xs font-semibold text-[#060606]">Loại xe</label>
          <select
            value={selectedVehicleTypeId}
            onChange={(e) => setSelectedVehicleTypeId(e.target.value)}
            className="w-full h-9 px-3 border border-[#e8e9e8] bg-white rounded-[6px] text-xs font-medium outline-none focus:border-[#060606]"
          >
            {vehicleTypes.length === 0 && <option value="">Đang tải...</option>}
            {vehicleTypes.map((vt) => (
              <option key={vt._id} value={vt._id}>
                {vt.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="block text-xs font-semibold text-[#060606]">Chủ xe</label>
          <input
            type="text"
            value={ownerName || (plate ? 'Khách vãng lai' : '')}
            readOnly
            className="w-full h-9 px-3 bg-[#fdfdfd] border border-[#e8e9e8] rounded-[6px] text-[#555] text-xs font-medium outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="block text-xs font-semibold text-[#060606]">Nhập lại biển vào</label>
          <input
            type="text"
            placeholder="F5 để nhập lại"
            value={plate}
            onChange={(e) => {
              setPlate(formatPlate(e.target.value));
              setCheckInError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.code === 'Space') {
                e.preventDefault();
                handleCheckInEnter();
              }
            }}
            className="w-full h-9 px-3 bg-white border border-[#e8e9e8] rounded-[6px] text-[#333] text-xs font-medium outline-none focus:border-[#9FE870]"
          />
        </div>
      </div>
    </>
  );
}
