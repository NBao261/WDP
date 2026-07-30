import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Loader2,
  MoreVertical,
  PowerOff,
  CheckCircle,
  Trash2,
  Pencil,
  Eye,
  Map,
  Plus,
  Layers,
} from 'lucide-react';
import { floorService, Floor } from '../../../../services/floor.service';
import { VehicleType } from '../../../../services/vehicleType.service';
import { ConfirmModal } from '../../../../components/ConfirmModal';
import { getVehicleColorTheme } from '../../vehicles/components/constants';

// ── Types ───────────────────────────────────────────────────────────────────

export interface FloorSlotStats {
  total: number; // totalSlots from Floor model
  occupied: number; // slots with status 'occupied'
  reserved: number; // slots with status 'reserved'
  fillRate: number; // percentage
}

interface FloorCardProps {
  floor: Floor;
  vehicleTypes: VehicleType[];
  slotStats?: FloorSlotStats;
  onEdit: (floor: Floor) => void;
  onView: (floor: Floor) => void;
  onUpdate: (updated: Floor) => void;
  onRemove: (id: string) => void;
  onViewMap: (floor: Floor) => void;
  onViewDetail?: (floor: Floor) => void;
  isFacilityActive?: boolean;
}

interface FloorGridProps {
  isLoading: boolean;
  floors: Floor[];
  vehicleTypes: VehicleType[];
  slotStats: Record<string, FloorSlotStats>;
  onAddFloor: () => void;
  onEditFloor: (floor: Floor) => void;
  onViewFloor: (floor: Floor) => void;
  onUpdate: (updated: Floor) => void;
  onRemove: (id: string) => void;
  onRefresh: () => void; // only needed for create/edit
  onViewMap: (floor: Floor) => void;
  onViewDetail?: (floor: Floor) => void;
  isFacilityActive?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getBarColor(pct: number) {
  if (pct > 85) return '#E24B4A';
  if (pct >= 60) return '#BA7517';
  return '#3B6D11';
}

// ── Skeleton Loader ──

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-[#e8eae8] p-5 space-y-4 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="w-16 h-4 bg-gray-100 rounded" />
        <div className="w-12 h-5 bg-gray-100 rounded-full" />
      </div>
      <div className="w-24 h-5 bg-gray-100 rounded" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-12 bg-gray-50 rounded-xl" />
        <div className="h-12 bg-gray-50 rounded-xl" />
        <div className="h-12 bg-gray-50 rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <div className="w-16 h-3 bg-gray-100 rounded" />
        <div className="h-1.5 bg-gray-100 rounded-full" />
      </div>
      <div className="flex justify-between pt-2 border-t border-gray-50">
        <div className="w-12 h-6 bg-gray-100 rounded" />
        <div className="w-20 h-6 bg-gray-100 rounded" />
      </div>
    </div>
  );
}

// ── Floor Card ──

export const FloorCard = React.memo(function FloorCard({
  floor,
  vehicleTypes,
  slotStats,
  onEdit,
  onView,
  onUpdate,
  onRemove,
  onViewMap,
  onViewDetail,
  isFacilityActive = true,
}: FloorCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'deactivate' | null>(null);
  const [hovered, setHovered] = useState(false);

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setLoading(true);
    try {
      const occupied = slotStats?.occupied ?? 0;
      const reserved = slotStats?.reserved ?? 0;

      if (occupied > 0 || reserved > 0) {
        toast.error(
          confirmAction === 'delete'
            ? 'Không thể xóa tầng vì đang có slot đang dùng hoặc đã đặt trước.'
            : 'Không thể thay đổi trạng thái vì đang có slot đang dùng hoặc đã đặt trước.'
        );
        setConfirmAction(null);
        setLoading(false);
        return;
      }

      if (confirmAction === 'delete') {
        await floorService.softDelete(floor._id);
        toast.success('Xóa tầng thành công');
        onRemove(floor._id);
      } else {
        const res = await floorService.update(floor._id, { status: 'inactive' });
        toast.success(`Đã vô hiệu hóa tầng ${floor.name}`);
        onUpdate(res.data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Thao tác thất bại');
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  };

  const handleReactivate = async () => {
    setMenuOpen(false);
    setLoading(true);
    try {
      const res = await floorService.update(floor._id, { status: 'active' });
      toast.success(`Đã kích hoạt tầng ${floor.name}`);
      onUpdate(res.data);
    } catch (err: any) {
      toast.error(err.message || 'Kích hoạt thất bại');
    } finally {
      setLoading(false);
    }
  };

  const total = slotStats?.total ?? 0;
  const occupied = slotStats?.occupied ?? 0;
  const fillRate = slotStats?.fillRate ?? 0;
  const barColor = getBarColor(fillRate);
  const fillColor = fillRate > 85 ? '#E24B4A' : fillRate >= 60 ? '#BA7517' : '#3B6D11';

  const isActive = floor.status === 'active';

  const badgeStyle = isActive
    ? { background: 'rgba(159,232,112,0.15)', color: '#82C94E', border: 'none', fontWeight: 'bold' }
    : (floor as any).status === 'maintenance'
      ? {
          background: 'rgba(250,204,21,0.15)',
          color: '#EAB308',
          border: 'none',
          fontWeight: 'bold',
        }
      : { background: '#f0f1f0', color: '#6b6e6b', border: 'none', fontWeight: 'bold' };

  // Vehicle type objects - Optimized with useMemo
  const vtTypes = useMemo(() => {
    return (floor.allowedVehicleTypes || [])
      .map((item: any) => {
        const typeId = typeof item === 'string' ? item : item._id;
        return (
          vehicleTypes.find((v) => v._id === typeId) || (typeof item === 'object' ? item : null)
        );
      })
      .filter(Boolean);
  }, [floor.allowedVehicleTypes, vehicleTypes]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white',
        borderRadius: 16,
        border: hovered ? '2px solid #9FE870' : '2px solid #f0f0f0',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.06)' : '0 2px 10px rgba(0,0,0,0.03)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
      className={!isActive ? 'opacity-70' : ''}
      onClick={() => onView(floor)}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3 relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3 min-w-0">
            {/* Icon */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: '#ffffff',
                border: '1.5px solid #f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Layers size={24} style={{ color: '#9FE870' }} />
            </div>
            {/* Name */}
            <div className="flex-1 min-w-0 flex items-center">
              <h3 className="text-[15px] font-bold text-[#062F28] truncate" title={floor.name}>
                {floor.name}
              </h3>
            </div>
          </div>

          {/* Badge & Action Menu */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              style={{
                fontSize: 10,
                padding: '3px 10px',
                borderRadius: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                ...badgeStyle,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isActive
                    ? '#82C94E'
                    : (floor as any).status === 'maintenance'
                      ? '#EAB308'
                      : '#9b9e9b',
                }}
              />
              {isActive
                ? 'HOẠT ĐỘNG'
                : (floor as any).status === 'maintenance'
                  ? 'BẢO TRÌ'
                  : 'ĐÃ VÔ HIỆU HÓA'}
            </span>

            {/* Menu dropdown */}
            {isFacilityActive && (
              <div className="relative -mr-2" onClick={(e) => e.stopPropagation()}>
                {loading ? (
                  <div className="w-7 h-7 flex items-center justify-center">
                    <Loader2 size={14} className="animate-spin text-gray-400" />
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen((v) => !v);
                    }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <MoreVertical size={16} />
                  </button>
                )}
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -6 }}
                      transition={{ duration: 0.12 }}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-8 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-20"
                    >
                      <div
                        className="fixed inset-0 z-[-1]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                        }}
                      />
                      {onViewDetail && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewDetail(floor);
                              setMenuOpen(false);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Eye size={14} /> Xem chi tiết
                          </button>
                          <div className="h-px bg-gray-100 mx-2 my-1" />
                        </>
                      )}
                      {isActive && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(floor);
                              setMenuOpen(false);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Pencil size={14} /> Chỉnh sửa
                          </button>
                          <div className="h-px bg-gray-100 mx-2 my-1" />
                        </>
                      )}
                      {isActive ? (
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            setConfirmAction('deactivate');
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm text-orange-600 hover:bg-orange-50 flex items-center gap-2"
                        >
                          <PowerOff size={14} /> Vô hiệu hóa
                        </button>
                      ) : (
                        <button
                          onClick={handleReactivate}
                          className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2"
                          style={{ color: '#27500A' }}
                        >
                          <CheckCircle size={14} /> Kích hoạt lại
                        </button>
                      )}
                      <div className="h-px bg-gray-100 mx-2 my-1" />
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          setConfirmAction('delete');
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 size={14} /> Xóa tầng
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Vehicle type pills - separate row */}
        <div className="flex flex-wrap gap-1.5 mt-1 pl-[60px]">
          {vtTypes.length === 0 ? (
            <span className="text-[11px] text-gray-400 italic">Không có loại xe</span>
          ) : (
            vtTypes.map((v: any, i: number) => {
              const color = getVehicleColorTheme(v.code || v.name, v.icon);
              return (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded text-[11px] font-medium"
                  style={{ background: color.bg, color: color.text }}
                >
                  {v.name}
                </span>
              );
            })
          )}
        </div>
      </div>

      {/* 3 Stats Box */}
      <div className="px-5 pb-5 mt-1">
        <div className="flex items-center justify-between border border-[#9FE870] rounded-xl p-3 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <div className="text-center flex-1">
            <div className="text-[11px] text-[#7B7B7B] mb-1">Tổng slot</div>
            <div className="text-[15px] font-bold text-[#062F28]">{total}</div>
          </div>
          <div className="w-px h-8 bg-gray-100" />
          <div className="text-center flex-1">
            <div className="text-[11px] text-[#7B7B7B] mb-1">Đang dùng</div>
            <div className="text-[15px] font-bold text-[#062F28]">{occupied}</div>
          </div>
          <div className="w-px h-8 bg-gray-100" />
          <div className="text-center flex-1">
            <div className="text-[11px] text-[#7B7B7B] mb-1">Lấp đầy</div>
            <div className="text-[15px] font-bold" style={{ color: fillColor }}>
              {fillRate}%
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-5 mt-auto">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewMap(floor);
          }}
          className={`w-full py-3.5 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 transition-colors duration-200 ${
            isActive
              ? 'bg-[#9FE870] text-[#062F28] hover:bg-[#062F28] hover:text-[#9FE870]'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
          }`}
        >
          Sơ đồ tầng →
        </button>
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <ConfirmModal
          isOpen={confirmAction !== null}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => handleConfirm()}
          title={confirmAction === 'delete' ? 'Xóa tầng' : 'Vô hiệu hóa tầng'}
          message={
            confirmAction === 'delete'
              ? `Bạn có chắc muốn xóa tầng "${floor.name}"? Thao tác này không thể hoàn tác.`
              : `Bạn có chắc muốn vô hiệu hóa tầng "${floor.name}"? Các slot trong tầng sẽ không khả dụng.`
          }
          confirmText={confirmAction === 'delete' ? 'Xóa' : 'Vô hiệu hóa'}
          variant={confirmAction === 'delete' ? 'danger' : 'warning'}
          isLoading={loading}
        />
      </div>
    </motion.div>
  );
});

// ── Floor Grid ──

export function FloorGrid({
  isLoading,
  floors,
  vehicleTypes,
  slotStats,
  onAddFloor,
  onEditFloor,
  onViewFloor,
  onUpdate,
  onRemove,
  onViewMap,
  onViewDetail,
  isFacilityActive = true,
}: FloorGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (floors.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#e8eae8] py-20 flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-white border-[1.5px] border-[#f0f0f0] flex items-center justify-center">
          <Layers size={24} className="text-[#9FE870]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-[#060606]">Không có tầng nào trong cơ sở này</p>
          {isFacilityActive && (
            <p className="text-xs text-gray-400 mt-1">
              Thêm tầng đầu tiên để bắt đầu quản lý chỗ đỗ xe
            </p>
          )}
        </div>
        {isFacilityActive && (
          <button
            onClick={onAddFloor}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors bg-[#062F28] text-white hover:bg-[#062F28]/80"
          >
            <Plus size={20} /> Thêm Tầng
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {floors.map((floor) => (
        <FloorCard
          key={floor._id}
          floor={floor}
          vehicleTypes={vehicleTypes}
          slotStats={slotStats[floor._id]}
          onEdit={onEditFloor}
          onView={onViewFloor}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onViewMap={onViewMap}
          onViewDetail={onViewDetail}
          isFacilityActive={isFacilityActive}
        />
      ))}
    </div>
  );
}
