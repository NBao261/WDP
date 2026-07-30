import { useState, useEffect, useRef, useMemo } from 'react';
import { getOptimizedImageUrl } from '../../../../utils/cloudinary';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Plus, Map, ChevronLeft, Camera } from 'lucide-react';
import { Floor } from '../../../../services/floor.service';
import {
  ParkingSlot,
  SlotStatus,
  ParkingSessionPopulated,
} from '../../../../services/slot.service';
import { VehicleType } from '../../../../services/vehicleType.service';
import { SlotStatusModal } from './SlotStatusModal';
import { SlotFormModal } from './SlotFormModal';
import {
  ICON_MAP,
  DEFAULT_ICON,
  getVehicleColorTheme,
} from '../../../shared/vehicles/components/constants';

const SERVER_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace('/api/v1', '')
  : 'http://localhost:5000';

function getImageUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith('http')) return getOptimizedImageUrl(url, 400);
  const SERVER_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1').replace(
    '/api/v1',
    ''
  );
  return `${SERVER_URL}${url.startsWith('/') ? url : `/${url}`}`;
}

interface SlotGroup {
  name: string;
  icon: string;
  slots: ParkingSlot[];
}

interface SlotMappingEditorViewProps {
  floor: Floor | null;
  slots: ParkingSlot[];
  vtMap: Record<string, string>;
  vehicleTypes: VehicleType[];
  loading: boolean;
  onRefreshSlots: (silent?: boolean) => void;
  onClose?: () => void;
  isFacilityActive?: boolean;
}

export function SlotMappingEditorView({
  floor,
  slots,
  vtMap,
  vehicleTypes,
  loading,
  onRefreshSlots,
  onClose,
  isFacilityActive = true,
}: SlotMappingEditorViewProps) {
  const [filterStatus, setFilterStatus] = useState<SlotStatus | 'all'>('all');
  const [statusSlot, setStatusSlot] = useState<ParkingSlot | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [singleSlotOpen, setSingleSlotOpen] = useState(false);
  const [hoveredSlotInfo, setHoveredSlotInfo] = useState<{ id: string; rect: DOMRect } | null>(
    null
  );
  const [filterVehicleType, setFilterVehicleType] = useState<string | 'all'>('all');

  // Helper to extract session data from a slot
  const getSessionData = (slot: ParkingSlot): ParkingSessionPopulated | null => {
    if (
      slot.status === 'occupied' &&
      slot.currentSessionId &&
      typeof slot.currentSessionId === 'object'
    ) {
      return slot.currentSessionId as ParkingSessionPopulated;
    }
    return null;
  };

  if (!floor) return null;

  const filteredSlots = useMemo(() => {
    let result = filterStatus === 'all' ? slots : slots.filter((s) => s.status === filterStatus);
    if (filterVehicleType !== 'all') {
      result = result.filter((s) => {
        const vtId =
          s.vehicleTypeId && typeof s.vehicleTypeId === 'object'
            ? (s.vehicleTypeId as any)._id
            : s.vehicleTypeId;
        return vtId === filterVehicleType;
      });
    }
    return result;
  }, [slots, filterStatus, filterVehicleType]);

  // Group slots by vehicle type
  const groupedSlots = useMemo(() => {
    const groups: Record<string, SlotGroup> = {};
    const ungrouped: ParkingSlot[] = [];

    filteredSlots.forEach((slot) => {
      const vtId =
        slot.vehicleTypeId && typeof slot.vehicleTypeId === 'object'
          ? slot.vehicleTypeId._id
          : (slot.vehicleTypeId as string) || '';

      if (!vtId) {
        ungrouped.push(slot);
        return;
      }

      if (!groups[vtId]) {
        const vtObj =
          slot.vehicleTypeId && typeof slot.vehicleTypeId === 'object' ? slot.vehicleTypeId : null;
        const vtFromList = vehicleTypes.find((v) => v._id === vtId);
        groups[vtId] = {
          name: vtObj?.name || vtFromList?.name || vtMap[vtId] || vtId,
          icon: vtObj?.icon || vtFromList?.icon || '',
          slots: [],
        };
      }
      groups[vtId].slots.push(slot);
    });

    const entries: [string, SlotGroup][] = Object.entries(groups);
    if (ungrouped.length > 0) {
      entries.push(['_ungrouped', { name: 'Khác', icon: '', slots: ungrouped }]);
    }
    return entries;
  }, [filteredSlots, vehicleTypes, vtMap]);

  const filterButtons: { label: string; value: SlotStatus | 'all' }[] = [
    { label: 'Tất cả', value: 'all' },
    { label: 'Trống', value: 'available' },
    { label: 'Đang dùng', value: 'occupied' },
    { label: 'Đã đặt', value: 'reserved' },
    { label: 'Bảo trì', value: 'maintenance' },
    { label: 'Khóa', value: 'locked' },
  ];

  // Allowed vehicle types for this floor
  const floorVehicleTypes = vehicleTypes.filter((vt) =>
    (floor.allowedVehicleTypes || []).some(
      (allowed: any) => (typeof allowed === 'string' ? allowed : allowed._id) === vt._id
    )
  );

  return (
    <>
      <motion.div
        id="slot-editor"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-[#e8eae8] p-6 mt-6"
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-5 pb-5 border-b border-gray-100">
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-[#062F28] hover:bg-[#A0E870]/20 rounded-xl transition-colors border border-gray-200 hover:border-[#A0E870]"
              title="Quay lại danh sách tầng"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold text-[#062F28]">
              Sơ đồ vị trí đỗ xe — Tầng {floor.name}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Nhấp vào một vị trí để thay đổi trạng thái
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                slots.length >= floor.totalSlots
                  ? 'text-red-600 bg-red-50'
                  : 'text-[#062F28] bg-[#A0E870]/30'
              }`}
            >
              {slots.length} / {floor.totalSlots} vị trí
            </span>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          {/* Status filter pills */}
          <div className="flex gap-1.5 flex-wrap">
            {filterButtons.map((btn) => (
              <button
                key={btn.value}
                onClick={() => setFilterStatus(btn.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterStatus === btn.value
                    ? 'bg-[#A0E870] text-[#062F28] font-semibold'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkOpen(true)}
              className="px-3 py-2 bg-[#062F28] text-white hover:bg-[#062F28]/90 rounded-xl transition-colors flex items-center gap-1.5 text-sm font-medium shadow-sm"
            >
              <Plus size={16} />
              Gán loại xe
            </button>
            <button
              onClick={() => onRefreshSlots()}
              title="Làm mới"
              className="px-3 py-2 border border-gray-200 text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors flex items-center justify-center shrink-0"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Body: palette + canvas */}
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Vehicle types palette */}
          <div className="w-full lg:w-44 bg-gray-50 rounded-xl border border-gray-200 shrink-0 relative min-h-[260px]">
            <div className="absolute inset-0 p-4 flex flex-col">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 shrink-0">
                Loại xe cho phép
              </h4>
              <div className="overflow-y-auto space-y-2.5 pr-1 vehicle-scrollbar h-full">
                <style>{`
                  .vehicle-scrollbar::-webkit-scrollbar { width: 4px; }
                  .vehicle-scrollbar::-webkit-scrollbar-track { background: transparent; }
                  .vehicle-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
                  .vehicle-scrollbar::-webkit-scrollbar-thumb:hover { background: #d1d5db; }
                `}</style>
                {floorVehicleTypes.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Chưa gán loại xe</p>
                ) : (
                  (() => {
                    const hasSlot = (vtId: string) =>
                      slots.some((s) => {
                        const sVtId =
                          typeof s.vehicleTypeId === 'object'
                            ? (s.vehicleTypeId as any)?._id
                            : s.vehicleTypeId;
                        return sVtId === vtId;
                      });

                    const assignedVTs = floorVehicleTypes.filter((vt) => hasSlot(vt._id));
                    const unassignedVTs = floorVehicleTypes.filter((vt) => !hasSlot(vt._id));

                    const renderVtCard = (vt: any) => {
                      const Icon =
                        vt.icon && ICON_MAP[vt.icon] ? ICON_MAP[vt.icon] : ICON_MAP[DEFAULT_ICON];
                      const isSelected = filterVehicleType === vt._id;
                      const vtTheme = getVehicleColorTheme(vt.code, vt.icon);
                      return (
                        <button
                          key={vt._id}
                          onClick={() => setFilterVehicleType(isSelected ? 'all' : vt._id)}
                          className={`w-full border px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-all shrink-0 text-left ${
                            isSelected
                              ? 'font-semibold shadow-sm'
                              : 'bg-white border-gray-200 text-gray-700 hover:shadow-sm'
                          }`}
                          style={
                            isSelected
                              ? {
                                  background: vtTheme.bg,
                                  borderColor: vtTheme.bg,
                                  color: vtTheme.text,
                                }
                              : undefined
                          }
                        >
                          <div
                            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                            style={{ background: vtTheme.bg }}
                          >
                            <Icon size={14} style={{ color: vtTheme.text }} />
                          </div>
                          <span className="truncate">{vt.name}</span>
                        </button>
                      );
                    };

                    return (
                      <>
                        {unassignedVTs.length > 0 && (
                          <div className={assignedVTs.length > 0 ? 'mb-4' : ''}>
                            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
                              Chưa gán vị trí
                            </h5>
                            <div className="space-y-2.5">{unassignedVTs.map(renderVtCard)}</div>
                          </div>
                        )}
                        {assignedVTs.length > 0 && (
                          <div>
                            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
                              Đã gán vị trí
                            </h5>
                            <div className="space-y-2.5">{assignedVTs.map(renderVtCard)}</div>
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 min-w-0 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 p-5 min-h-[260px] overflow-x-auto">
            {loading ? (
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : filteredSlots.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm gap-2">
                <Map size={28} className="opacity-30" />
                {slots.length === 0
                  ? `Tầng này chưa có vị trí nào (0/${floor.totalSlots}).`
                  : 'Không có vị trí phù hợp bộ lọc.'}
              </div>
            ) : (
              <div className="min-w-[500px]">
                {/* Legend */}
                <div className="flex gap-4 mb-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-3.5 h-3.5 rounded border border-gray-300"
                      style={{
                        background:
                          'linear-gradient(135deg, #F3F8ED 0%, #9FE870 50%, #085041 100%)',
                      }}
                    />{' '}
                    Đang dùng (theo loại xe)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded bg-blue-100 border border-blue-200" /> Đã
                    đặt
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded bg-red-50 border border-red-200" /> Bảo trì
                    / Khóa
                  </div>
                </div>

                {/* Slot rows grouped by vehicle type */}
                <div className="space-y-5">
                  {groupedSlots.map(([vtId, group]) => {
                    const Icon =
                      group.icon && ICON_MAP[group.icon]
                        ? ICON_MAP[group.icon]
                        : ICON_MAP[DEFAULT_ICON];
                    const vtForGroup = vehicleTypes.find((v) => v._id === vtId);
                    const groupTheme = getVehicleColorTheme(
                      vtForGroup?.code,
                      vtForGroup?.icon || group.icon
                    );
                    return (
                      <div key={vtId}>
                        {/* Vehicle type label */}
                        <div className="flex items-center gap-2 mb-2.5">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: groupTheme.bg }}
                          >
                            <Icon size={15} style={{ color: groupTheme.text }} />
                          </div>
                          <span className="text-sm font-bold text-[#062F28]">{group.name}</span>
                          <span className="text-xs text-gray-400 font-medium">
                            ({group.slots.length} vị trí)
                          </span>
                          <div className="flex-1 h-px bg-gray-200 ml-2" />
                        </div>
                        {/* Slots row */}
                        <div className="flex flex-wrap gap-2.5 pl-9">
                          {group.slots.map((slot) => {
                            const vtObj =
                              slot.vehicleTypeId && typeof slot.vehicleTypeId === 'object'
                                ? (slot.vehicleTypeId as any)
                                : vehicleTypes.find((v) => v._id === slot.vehicleTypeId);
                            const vtColorTheme = getVehicleColorTheme(vtObj?.code, vtObj?.icon);

                            let bgClass = 'bg-white border-gray-200 text-gray-500';
                            let inlineStyle: React.CSSProperties = {};
                            if (slot.status === 'occupied') {
                              bgClass = 'border shadow-sm';
                              inlineStyle = {
                                background: vtColorTheme.bg,
                                borderColor: vtColorTheme.bg,
                                color: vtColorTheme.text,
                              };
                            } else if (slot.status === 'reserved')
                              bgClass = 'bg-blue-100 border-blue-200 text-blue-700';
                            else if (slot.status === 'maintenance' || slot.status === 'locked')
                              bgClass = 'bg-red-50 border-red-200 text-red-600';

                            return (
                              <div
                                key={slot._id}
                                onClick={() => {
                                  if (floor.status === 'active' && isFacilityActive)
                                    setStatusSlot(slot);
                                  else
                                    toast.error(
                                      !isFacilityActive
                                        ? 'Không thể chỉnh sửa vị trí của tòa nhà đang bị vô hiệu hóa.'
                                        : 'Không thể chỉnh sửa vị trí của tầng đang bị vô hiệu hóa.'
                                    );
                                }}
                                onMouseEnter={(e) =>
                                  setHoveredSlotInfo({
                                    id: slot._id,
                                    rect: e.currentTarget.getBoundingClientRect(),
                                  })
                                }
                                onMouseLeave={() => setHoveredSlotInfo(null)}
                                className={`relative w-20 h-12 rounded-lg flex items-center justify-center text-sm font-semibold ${floor.status === 'active' && isFacilityActive ? 'cursor-pointer hover:scale-105 hover:shadow-md' : 'cursor-not-allowed opacity-75'} transition-all shadow-sm border ${bgClass}`}
                                style={inlineStyle}
                                title={`${slot.code} – ${group.name} (${slot.status})`}
                              >
                                {slot.code}
                                {/* Camera badge for occupied slots with image */}
                                {(() => {
                                  const session = getSessionData(slot);
                                  if (session?.checkInImage) {
                                    return (
                                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#062F28] rounded-full flex items-center justify-center shadow-sm">
                                        <Camera size={9} className="text-[#A0E870]" />
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Remaining slots visual */}
                {floor.totalSlots > slots.length && (
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <Plus size={15} className="text-gray-400" />
                      </div>
                      <span className="text-sm font-bold text-gray-400">Chưa phân bổ</span>
                      <span className="text-xs text-gray-400 font-medium">
                        ({floor.totalSlots - slots.length} vị trí trống)
                      </span>
                      <div className="flex-1 h-px bg-gray-200 ml-2" />
                    </div>
                    <div className="flex flex-wrap gap-2.5 pl-9">
                      {Array.from({ length: floor.totalSlots - slots.length }).map((_, i) => (
                        <div
                          key={`empty-${i}`}
                          onClick={() => {
                            if (floor.status === 'active' && isFacilityActive)
                              setSingleSlotOpen(true);
                            else
                              toast.error(
                                !isFacilityActive
                                  ? 'Không thể thêm vị trí của tòa nhà đang bị vô hiệu hóa.'
                                  : 'Không thể thêm vị trí của tầng đang bị vô hiệu hóa.'
                              );
                          }}
                          className={`w-20 h-12 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-200 text-gray-300 text-xs ${floor.status === 'active' && isFacilityActive ? 'cursor-pointer hover:border-[#A0E870] hover:text-[#A0E870] hover:bg-[#A0E870]/5' : 'cursor-not-allowed opacity-75'} transition-all`}
                          title="Nhấp để thêm 1 vị trí"
                        >
                          <Plus size={16} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {statusSlot && (
          <SlotStatusModal
            slot={statusSlot}
            onClose={() => setStatusSlot(null)}
            onSuccess={() => {
              setStatusSlot(null);
              onRefreshSlots(true);
            }}
          />
        )}
        {bulkOpen && floor && (
          <SlotFormModal
            facilityId={(floor as any).facilityId}
            floorId={floor._id}
            vehicleTypes={floorVehicleTypes}
            totalSlots={floor.totalSlots}
            currentSlotCount={slots.length}
            existingSlots={slots.map((s) => ({
              _id: s._id,
              code: s.code,
              vehicleTypeId:
                typeof s.vehicleTypeId === 'object' && s.vehicleTypeId
                  ? s.vehicleTypeId._id
                  : (s.vehicleTypeId as string),
            }))}
            onClose={() => setBulkOpen(false)}
            onSuccess={() => {
              setBulkOpen(false);
              onRefreshSlots(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Single slot modal (from empty slot click) */}
      <AnimatePresence>
        {singleSlotOpen && floor && (
          <SlotFormModal
            facilityId={(floor as any).facilityId}
            floorId={floor._id}
            vehicleTypes={floorVehicleTypes}
            totalSlots={floor.totalSlots}
            currentSlotCount={slots.length}
            singleOnly
            existingSlots={slots.map((s) => ({
              _id: s._id,
              code: s.code,
              vehicleTypeId:
                typeof s.vehicleTypeId === 'object' && s.vehicleTypeId
                  ? s.vehicleTypeId._id
                  : (s.vehicleTypeId as string),
            }))}
            onClose={() => setSingleSlotOpen(false)}
            onSuccess={() => {
              setSingleSlotOpen(false);
              onRefreshSlots(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Portal Tooltip to escape overflow-hidden container */}
      {hoveredSlotInfo &&
        (() => {
          const slot = slots.find((s) => s._id === hoveredSlotInfo.id);
          if (!slot) return null;
          const session = getSessionData(slot);
          const reservation = slot.reservationInfo;

          // Không có gì để hiển thị
          if (!session && !reservation) return null;

          return createPortal(
            <div
              className="fixed z-[9999] pointer-events-none"
              style={{
                top: hoveredSlotInfo.rect.top - 8,
                left: hoveredSlotInfo.rect.left + hoveredSlotInfo.rect.width / 2,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-2 min-w-[160px]">
                {session ? (
                  <>
                    {session.checkInImage ? (
                      <img
                        src={getImageUrl(session.checkInImage) || ''}
                        alt={`Xe ${session.licensePlate}`}
                        className="w-36 h-24 object-cover rounded-lg mb-1.5"
                      />
                    ) : (
                      <div className="w-36 h-24 bg-gray-100 rounded-lg mb-1.5 flex items-center justify-center">
                        {(() => {
                          const DefaultIcon = ICON_MAP[DEFAULT_ICON];
                          return <DefaultIcon size={24} className="text-gray-300" />;
                        })()}
                      </div>
                    )}
                    <p className="text-xs font-bold text-center text-[#062F28]">
                      {session.licensePlate || 'Không có biển số'}
                    </p>
                  </>
                ) : reservation ? (
                  <div className="p-1 space-y-1">
                    <p
                      className="text-[10px] font-bold uppercase"
                      style={{ color: reservation.status === 'confirmed' ? '#059669' : '#d97706' }}
                    >
                      {reservation.status === 'confirmed' ? 'Đã xác nhận ✓' : 'Chờ xác nhận'}
                    </p>
                    {typeof reservation.user === 'object' && (
                      <p className="text-xs font-semibold text-[#062F28]">
                        {reservation.user.name}
                      </p>
                    )}
                    <p className="text-[11px] font-bold text-[#062F28]">
                      {reservation.licensePlate}
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="w-3 h-3 bg-white border-b border-r border-gray-200 rotate-45 absolute -bottom-1.5 left-1/2 -translate-x-1/2" />
            </div>,
            document.body
          );
        })()}
    </>
  );
}
