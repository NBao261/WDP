import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, Layers, Calendar, Lock } from 'lucide-react';
import { Floor } from '../../../../services/floor.service';
import { VehicleType } from '../../../../services/vehicleType.service';
import {
  ICON_MAP,
  DEFAULT_ICON,
  getVehicleColorTheme,
} from '../../../shared/vehicles/components/constants';

function getBarTextColor(pct: number) {
  if (pct > 85) return 'text-[#E24B4A]';
  if (pct >= 60) return 'text-[#BA7517]';
  return 'text-[#3B6D11]';
}

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  floor?: Floor;
  stats?: { total: number; occupied: number; fillRate: number };
  vehicleTypes?: VehicleType[];
}

export function FloorDetailModal({
  isOpen,
  onClose,
  floor,
  stats,
  vehicleTypes = [],
}: DetailModalProps) {
  if (!isOpen || !floor) return null;

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

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h2 className="text-lg font-bold text-[#060606]">Chi tiết Tầng</h2>
              <p className="text-xs text-gray-500 mt-0.5">Xem thông tin và thống kê sức chứa</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
            <div className="flex flex-col gap-6 items-stretch">
              {/* General & Allowed vehicles */}
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1.5">
                      Vị trí Tầng
                    </p>
                    <span
                      style={{
                        fontSize: 11,
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
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-[#9FE870]/15 flex items-center justify-center border border-[#9FE870]/30 shrink-0 text-[#062F28]">
                      <Layers size={32} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-1.5">
                        <h3 className="text-xl font-bold text-[#062F28]">{floor.name}</h3>
                      </div>
                      <div className="flex items-center gap-1.5 text-[13px] text-gray-400 mt-2">
                        <Calendar size={13} /> Ngày tạo:{' '}
                        <span className="text-gray-600 font-medium">
                          {new Date(floor.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                        {!isActive && (
                          <>
                            <span className="mx-1.5 text-gray-300">•</span>
                            <Lock size={13} className="text-red-400" />{' '}
                            <span className="text-red-500">Tạm khóa:</span>{' '}
                            <span className="text-gray-600 font-medium">
                              {new Date(floor.updatedAt).toLocaleDateString('vi-VN')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1.5 mb-2">
                    Các loại xe cho phép
                  </p>
                  {(floor.allowedVehicleTypes?.length || 0) > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(floor.allowedVehicleTypes || []).map((vId: any) => {
                        const id = typeof vId === 'string' ? vId : vId._id;
                        const v =
                          typeof vId === 'string' ? vehicleTypes.find((vt) => vt._id === id) : vId;
                        if (!v) return null;
                        const IconComp =
                          v.icon && ICON_MAP[v.icon] ? ICON_MAP[v.icon] : ICON_MAP[DEFAULT_ICON];
                        const color = getVehicleColorTheme(v.code || v.name, v.icon);
                        return (
                          <span
                            key={id}
                            className="px-2.5 py-1.5 text-[12px] font-semibold rounded-lg flex items-center gap-1.5 shadow-sm"
                            style={{ background: color.bg, color: color.text }}
                          >
                            <IconComp size={14} color={color.text} /> {v.name}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-sm text-gray-400 italic">
                      Không có loại xe nào được hỗ trợ
                    </div>
                  )}
                </div>
              </div>

              {/* Capacity Stats */}
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1.5 mb-2">
                    Thống kê sức chứa
                  </p>
                  <div className="flex items-center justify-between border border-[#9FE870] rounded-xl p-3 bg-white shadow-sm flex-wrap gap-y-4">
                    <div className="text-center flex-[1_1_25%]">
                      <div className="text-xl tabular-nums font-semibold text-[#062F28]">
                        {floor.totalSlots || 0}
                      </div>
                      <div className="text-[12px] text-[#7B7B7B] mt-1 font-medium">Sức chứa</div>
                    </div>
                    <div className="w-px h-8 bg-gray-100 hidden sm:block" />
                    <div className="text-center flex-[1_1_25%]">
                      <div className="text-xl tabular-nums font-semibold text-[#062F28]">
                        {stats?.total ?? 0}
                      </div>
                      <div className="text-[12px] text-[#7B7B7B] mt-1 font-medium">Đã tạo</div>
                    </div>
                    <div className="w-px h-8 bg-gray-100 hidden sm:block" />
                    <div className="text-center flex-[1_1_25%]">
                      <div className="text-xl tabular-nums font-semibold text-[#062F28]">
                        {stats?.occupied ?? 0}
                      </div>
                      <div className="text-[12px] text-[#7B7B7B] mt-1 font-medium">Đang dùng</div>
                    </div>

                    <div className="w-full mt-2 pt-3 border-t border-gray-100 text-center flex items-center justify-center gap-2">
                      <span className="text-[13px] text-[#7B7B7B] font-medium">Tỷ lệ lấp đầy:</span>
                      <span
                        className={`text-[15px] font-bold ${getBarTextColor(
                          floor.totalSlots
                            ? Math.round(((stats?.occupied ?? 0) / floor.totalSlots) * 100)
                            : 0
                        )}`}
                      >
                        {floor.totalSlots
                          ? Math.round(((stats?.occupied ?? 0) / floor.totalSlots) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-[#9FE870] hover:border-[#9FE870] hover:text-[#062F28] transition-all shadow-sm"
            >
              Đóng
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
