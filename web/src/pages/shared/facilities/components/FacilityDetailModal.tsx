import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, Building2, MapPin, Clock, Layers, FileText, Calendar, Lock } from 'lucide-react';
import { Facility } from '../../../../services/facility.service';
import { ICON_MAP, DEFAULT_ICON } from '../../../shared/vehicles/components/constants';

function getBarTextColor(pct: number) {
  if (pct > 85) return 'text-[#E24B4A]';
  if (pct >= 60) return 'text-[#BA7517]';
  return 'text-[#3B6D11]';
}

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  facility?: Facility;
  stats?: { totalSlots: number; occupied: number; fillRate: number };
  currentFloors?: number;
  vehicleTypes?: { _id: string; name: string; icon?: string }[];
  allVehicleTypes?: { _id: string; name: string; icon?: string }[];
}

export function FacilityDetailModal({
  isOpen,
  onClose,
  facility,
  stats,
  currentFloors = 0,
  vehicleTypes = [],
  allVehicleTypes = [],
}: DetailModalProps) {
  if (!isOpen || !facility) return null;

  const isActive = facility.status === 'active';
  const badgeStyle = isActive
    ? { background: 'rgba(159,232,112,0.15)', color: '#82C94E', border: 'none', fontWeight: 'bold' }
    : (facility as any).status === 'maintenance'
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
              <h2 className="text-lg font-bold text-[#060606]">Chi tiết tòa nhà / bãi đỗ</h2>
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
            <div className="space-y-5">
              {/* Facility Info */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Vị trí tòa nhà / bãi đỗ
                  </p>
                  <span
                    className="text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5"
                    style={badgeStyle}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: badgeStyle.color }}
                    />
                    {isActive
                      ? 'HOẠT ĐỘNG'
                      : (facility as any).status === 'maintenance'
                        ? 'BẢO TRÌ'
                        : 'NGƯNG'}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#F4F2FF] flex items-center justify-center shrink-0">
                    <Building2 size={22} className="text-[#7C3AED]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-extrabold text-[#060606] leading-tight">
                      {facility.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                      <MapPin size={12} className="shrink-0 mt-0.5" />
                      <span className="break-words">{facility.address}</span>
                    </p>
                    {facility.createdAt && (
                      <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                        <Calendar size={11} /> Ngày tạo:{' '}
                        {new Date(facility.createdAt).toLocaleDateString('vi-VN')}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Vehicle Types */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Các loại xe cho phép
                </p>
                {vehicleTypes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {vehicleTypes.map((v: any) => {
                      const IconComp =
                        v.icon && ICON_MAP[v.icon] ? ICON_MAP[v.icon] : ICON_MAP[DEFAULT_ICON];
                      const idx = Math.max(
                        0,
                        allVehicleTypes.findIndex((av: any) => av._id === v._id)
                      );
                      const colors = [
                        { bg: '#F3F4F6', text: '#4B5563' },
                        { bg: '#EAF5E4', text: '#062F28' },
                        { bg: '#9FE870', text: '#062F28' },
                        { bg: '#062F28', text: '#9FE870' },
                      ];
                      const color = colors[Math.min(idx, colors.length - 1)];
                      return (
                        <span
                          key={v._id}
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

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex flex-col justify-center gap-1.5 text-center">
                  <Layers size={18} className="mx-auto text-[#062F28]" />
                  <p className="text-[11px] font-semibold text-gray-500 uppercase">
                    Số tầng tối đa
                  </p>
                  <p className="text-[14px] font-bold text-[#062F28]">
                    {facility.totalFloors} tầng
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex flex-col justify-center gap-1.5 text-center">
                  <Building2 size={18} className="mx-auto text-[#062F28]" />
                  <p className="text-[11px] font-semibold text-gray-500 uppercase">Tầng hiện có</p>
                  <p className="text-[14px] font-bold text-[#062F28]">{currentFloors} tầng</p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex flex-col justify-center gap-1.5 text-center">
                  <Clock size={18} className="mx-auto text-[#062F28]" />
                  <p className="text-[11px] font-semibold text-gray-500 uppercase">Giờ hoạt động</p>
                  <p className="text-[14px] font-bold text-[#062F28]">
                    {facility.openTime} - {facility.closeTime}
                  </p>
                </div>
              </div>

              {/* Capacity */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Thống kê sức chứa
                </p>
                <div className="flex items-center justify-between border border-[#9FE870] rounded-xl p-3 bg-white shadow-sm">
                  <div className="text-center flex-1">
                    <div className="text-xl tabular-nums font-semibold text-[#062F28]">
                      {stats?.totalSlots ?? 0}
                    </div>
                    <div className="text-[12px] text-[#7B7B7B] mt-1 font-medium">Tổng slot</div>
                  </div>
                  <div className="w-px h-8 bg-gray-100" />
                  <div className="text-center flex-1">
                    <div className="text-xl tabular-nums font-semibold text-[#062F28]">
                      {stats?.occupied ?? 0}
                    </div>
                    <div className="text-[12px] text-[#7B7B7B] mt-1 font-medium">Đang dùng</div>
                  </div>
                  <div className="w-px h-8 bg-gray-100" />
                  <div className="text-center flex-1">
                    <div
                      className={`text-xl tabular-nums font-semibold ${getBarTextColor(stats?.fillRate ?? 0)}`}
                    >
                      {stats?.fillRate ?? 0}%
                    </div>
                    <div className="text-[12px] text-[#7B7B7B] mt-1 font-medium">Lấp đầy</div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1.5 mb-2">
                  <FileText size={14} /> Mô tả
                </p>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-[14px] text-gray-700 leading-relaxed min-h-[80px]">
                  {facility.description ? (
                    <span className="whitespace-pre-wrap">{facility.description}</span>
                  ) : (
                    <span className="text-gray-400 italic">
                      Không có mô tả cho tòa nhà / bãi đỗ này.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-[#9FE870] hover:border-[#9FE870] hover:text-[#062F28] transition-all"
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
