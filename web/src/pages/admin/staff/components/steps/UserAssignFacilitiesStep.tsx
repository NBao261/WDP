import { useState, useEffect } from 'react';
import { RefreshCw, MapPin, AlertCircle, CheckSquare, Square } from 'lucide-react';
import { facilityService, Facility } from '../../../../../services/facility.service';

interface UserAssignFacilitiesStepProps {
  selectedFacilityIds: string[];
  onChange: (ids: string[]) => void;
}

export function UserAssignFacilitiesStep({
  selectedFacilityIds,
  onChange,
}: UserAssignFacilitiesStepProps) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  // Progressive disclosure state
  const [wantsToAssign, setWantsToAssign] = useState(selectedFacilityIds.length > 0);

  useEffect(() => {
    const loadFacilities = async () => {
      setLoading(true);
      setFetchError('');
      try {
        const res = await facilityService.getAll({ status: 'active', limit: 100 });
        setFacilities(res.data ?? []);
      } catch (err: any) {
        setFetchError(err.message || 'Không thể tải danh sách tòa nhà.');
      } finally {
        setLoading(false);
      }
    };
    loadFacilities();
  }, []);

  const toggleFacility = (facilityId: string) => {
    if (selectedFacilityIds.includes(facilityId)) {
      onChange(selectedFacilityIds.filter((id) => id !== facilityId));
    } else {
      onChange([...selectedFacilityIds, facilityId]);
    }
  };

  const isSelected = (facilityId: string) => selectedFacilityIds.includes(facilityId);

  const handleToggleAssign = () => {
    const newVal = !wantsToAssign;
    setWantsToAssign(newVal);
    if (!newVal) {
      onChange([]); // Clear selection when turning off
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-400">
        <RefreshCw className="w-6 h-6 animate-spin mb-2" />
        <p className="text-xs">Đang tải danh sách tòa nhà...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {fetchError}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Master Toggle */}
      <button
        type="button"
        onClick={handleToggleAssign}
        className={`w-full p-4 rounded-xl border flex items-center justify-between transition-colors ${
          wantsToAssign
            ? 'bg-[#9FE870]/20 border-[#9FE870]'
            : 'bg-white border-gray-200 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-6 rounded-full flex items-center p-1 transition-colors ${
              wantsToAssign ? 'bg-[#062F28]' : 'bg-gray-300'
            }`}
          >
            <div
              className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                wantsToAssign ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-[#062F28]">Phân công tòa nhà ngay</p>
            <p className="text-xs text-gray-500 mt-0.5">Bật để chọn tòa nhà cho nhân viên này</p>
          </div>
        </div>
      </button>

      {/* Facility List (Progressively Disclosed) */}
      {wantsToAssign && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {facilities.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">
              Chưa có tòa nhà active nào trong hệ thống.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
              {facilities.map((facility) => {
                const selected = isSelected(facility._id);
                return (
                  <button
                    key={facility._id}
                    type="button"
                    onClick={() => toggleFacility(facility._id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                      selected
                        ? 'bg-[#9FE870]/20 border-[#9FE870]'
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {selected ? (
                        <CheckSquare className="w-4 h-4 text-[#062F28]" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-[#062F28] truncate">{facility.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                        <p className="text-[11px] text-gray-400 truncate">{facility.address}</p>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {facility.openTime} – {facility.closeTime}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedFacilityIds.length > 0 && (
            <p className="text-xs text-center font-semibold text-[#062F28]">
              ✓ Đã chọn {selectedFacilityIds.length} tòa nhà
            </p>
          )}
        </div>
      )}
    </div>
  );
}
