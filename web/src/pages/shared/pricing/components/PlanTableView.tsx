import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Edit, PowerOff, CheckCircle2, Trash2, MoreVertical, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { pricingService, type PricingPlan } from '../../../../services/pricing.service';
import { type Facility } from '../../../../services/facility.service';
import { type VehicleType } from '../../../../services/vehicleType.service';
import { FEE_TYPE_LABELS, mapToUiType } from './constants';
import {
  ICON_MAP,
  getVehicleColorTheme,
  DEFAULT_ICON,
} from '../../../shared/vehicles/components/constants';
import { ConfirmModal } from '../../../../components/ConfirmModal';

interface PlanTableProps {
  plans: PricingPlan[];
  facilities: Facility[];
  vehicleTypes: VehicleType[];
  onEdit: (p: PricingPlan) => void;
  onViewDetail: (p: PricingPlan) => void;
  onRefresh: () => void;
  currentPage?: number;
  itemsPerPage?: number;
  sortName: string;
  setSortName: (v: string) => void;
  sortVehicle: string;
  setSortVehicle: (v: string) => void;
  sortPrice: string;
  setSortPrice: (v: string) => void;
  sortDate: string;
  setSortDate: (v: string) => void;
}

export function PlanTableView({
  plans,
  vehicleTypes,
  onEdit,
  onViewDetail,
  onRefresh,
  currentPage = 1,
  itemsPerPage = 10,
  sortName,
  setSortName,
  sortVehicle,
  setSortVehicle,
  sortPrice,
  setSortPrice,
  sortDate,
  setSortDate,
}: PlanTableProps) {
  const resetSorts = (...except: string[]) => {
    if (!except.includes('name')) setSortName('default');
    if (!except.includes('vehicle')) setSortVehicle('default');
    if (!except.includes('price')) setSortPrice('default');
    if (!except.includes('date')) setSortDate('default');
  };
  const [loading, setLoading] = useState(false);
  const [deletePlan, setDeletePlan] = useState<PricingPlan | null>(null);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [menuState, setMenuState] = useState<{ id: string; top: number; right: number } | null>(
    null
  );

  const handleMenuClick = (e: React.MouseEvent, planId: string) => {
    e.stopPropagation();
    if (menuState?.id === planId) {
      setMenuState(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuState({
      id: planId,
      top: rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right,
    });
  };

  // Close menu on outside click or scroll
  useEffect(() => {
    const handleOutsideClick = () => setMenuState(null);
    const handleScroll = () => setMenuState(null);
    if (menuState) {
      document.addEventListener('click', handleOutsideClick);
      window.addEventListener('scroll', handleScroll, true);
    }
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [menuState]);

  // Fetch active session counts for all plans
  useEffect(() => {
    const fetchCounts = async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        plans.map(async (p) => {
          try {
            const res = await pricingService.getActiveSessionCount(p._id);
            counts[p._id] = res.data.activeSessionCount;
          } catch {
            counts[p._id] = 0;
          }
        })
      );
      setSessionCounts(counts);
    };
    if (plans.length > 0) fetchCounts();
  }, [plans]);

  const toggle = async (plan: PricingPlan, s: 'active' | 'inactive') => {
    setLoading(true);
    try {
      await pricingService.update(plan._id, { status: s });
      toast.success(s === 'active' ? 'Đã kích hoạt' : 'Đã vô hiệu hóa');
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePlan) return;
    setLoading(true);
    try {
      await pricingService.delete(deletePlan._id);
      toast.success('Đã xóa bảng giá thành công');
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi');
    } finally {
      setLoading(false);
      setDeletePlan(null);
    }
  };

  const fmt = (n: number) => n.toLocaleString('vi-VN') + ' đ';
  const translateUnit = (unit: string) => {
    const map: Record<string, string> = {
      hour: 'giờ',
      '/hour': '/giờ',
      hours: 'giờ',
      turn: 'lượt',
      '/turn': '/lượt',
      day: 'ngày',
      '/day': '/ngày',
      VND: 'đ',
      '/VND': '',
    };
    return map[unit] ?? map[unit.toLowerCase()] ?? unit;
  };

  const activeMenuPlan = plans.find((p) => p._id === menuState?.id);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col relative">
      <div className="w-full min-h-[160px]">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[#9FE870] text-[#062F28] text-[13px] border-b border-[#9FE870] font-semibold uppercase tracking-wider">
            <tr>
              <th className="px-3 py-4 text-center rounded-tl-2xl">STT</th>
              <th
                className="px-4 py-4 cursor-pointer select-none hover:text-[#062F28] transition-colors"
                onClick={() => {
                  resetSorts('name');
                  if (sortName === 'default') setSortName('name_asc');
                  else if (sortName === 'name_asc') setSortName('name_desc');
                  else setSortName('default');
                }}
              >
                <span className="flex items-center gap-1.5">
                  Tên bảng giá
                  <ArrowUpDown
                    size={13}
                    className={sortName !== 'default' ? 'text-white' : 'text-[#062F28]/40'}
                  />
                  {sortName !== 'default' && (
                    <span className="text-[10px] text-white font-bold">
                      {sortName === 'name_asc' ? 'A-Z' : 'Z-A'}
                    </span>
                  )}
                </span>
              </th>
              <th
                className="px-4 py-4 cursor-pointer select-none hover:text-[#062F28] transition-colors"
                onClick={() => {
                  resetSorts('vehicle');
                  if (sortVehicle === 'default') setSortVehicle('vt_asc');
                  else if (sortVehicle === 'vt_asc') setSortVehicle('vt_desc');
                  else setSortVehicle('default');
                }}
              >
                <span className="flex items-center gap-1.5">
                  Loại xe
                  <ArrowUpDown
                    size={13}
                    className={sortVehicle !== 'default' ? 'text-white' : 'text-[#062F28]/40'}
                  />
                  {sortVehicle !== 'default' && (
                    <span className="text-[10px] text-white font-bold">
                      {sortVehicle === 'vt_asc' ? 'A-Z' : 'Z-A'}
                    </span>
                  )}
                </span>
              </th>
              <th className="px-4 py-4">Loại giá</th>
              <th
                className="px-4 py-4 cursor-pointer select-none hover:text-[#062F28] transition-colors"
                onClick={() => {
                  resetSorts('price');
                  if (sortPrice === 'default') setSortPrice('price_desc');
                  else if (sortPrice === 'price_desc') setSortPrice('price_asc');
                  else setSortPrice('default');
                }}
              >
                <span className="flex items-center gap-1.5">
                  Đơn giá cơ bản
                  <ArrowUpDown
                    size={13}
                    className={sortPrice !== 'default' ? 'text-white' : 'text-[#062F28]/40'}
                  />
                  {sortPrice !== 'default' && (
                    <span className="text-[10px] text-white font-bold">
                      {sortPrice === 'price_desc' ? '↓ Cao' : '↑ Thấp'}
                    </span>
                  )}
                </span>
              </th>
              <th className="px-4 py-4">Phụ phí</th>
              <th className="px-4 py-4 text-center">Trạng thái</th>
              <th
                className="px-4 py-4 text-right rounded-tr-2xl cursor-pointer select-none hover:text-[#062F28] transition-colors"
                onClick={() => {
                  resetSorts('date');
                  if (sortDate === 'default') setSortDate('created_desc');
                  else if (sortDate === 'created_desc') setSortDate('created_asc');
                  else setSortDate('default');
                }}
              >
                <span className="flex items-center justify-end gap-1.5">
                  Thao tác
                  <ArrowUpDown
                    size={13}
                    className={sortDate !== 'default' ? 'text-white' : 'text-[#062F28]/40'}
                  />
                  {sortDate !== 'default' && (
                    <span className="text-[10px] text-white font-bold">
                      {sortDate === 'created_desc' ? '↓ Mới' : '↑ Cũ'}
                    </span>
                  )}
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            <AnimatePresence mode="popLayout">
              {plans.map((plan, index) => {
                const vtId =
                  typeof plan.vehicleTypeId === 'object'
                    ? plan.vehicleTypeId?._id
                    : plan.vehicleTypeId;
                const vtName =
                  typeof plan.vehicleTypeId === 'object'
                    ? plan.vehicleTypeId?.name
                    : (vehicleTypes.find((v) => v._id === vtId)?.name ?? '');
                const vtIconKey =
                  typeof plan.vehicleTypeId === 'object'
                    ? plan.vehicleTypeId?.icon
                    : (vehicleTypes.find((v) => v._id === vtId)?.icon ?? '');
                const uiFeeType = mapToUiType(plan.feeType, plan.feeMethod || '');
                const VtIcon =
                  vtIconKey && ICON_MAP[vtIconKey] ? ICON_MAP[vtIconKey] : ICON_MAP[DEFAULT_ICON];
                const isActive = plan.status === 'active';

                return (
                  <motion.tr
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key={plan._id}
                    onClick={() => onViewDetail(plan)}
                    className={`hover:bg-[#9FE870]/10 transition-colors cursor-pointer border-b border-gray-50 last:border-0 ${!isActive ? 'opacity-75 bg-gray-50/50' : ''}`}
                  >
                    <td className="px-4 py-4 text-[#6b6b6b] text-sm text-center font-medium truncate">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </td>
                    <td
                      className="px-4 py-4 font-bold text-[15px] text-[#062F28] max-w-[200px] truncate"
                      title={plan.name}
                    >
                      {plan.name}
                    </td>
                    <td className="px-4 py-4">
                      {(() => {
                        const vtObj = vehicleTypes.find((v) => v._id === vtId);
                        const colorTheme = getVehicleColorTheme(vtObj?.code, vtObj?.icon);
                        return (
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 text-[13px] font-semibold rounded-lg"
                            style={{ background: colorTheme.bg, color: colorTheme.text }}
                          >
                            <VtIcon size={14} color={colorTheme.text} strokeWidth={2} /> {vtName}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-[#6b6b6b] text-sm font-medium">
                        {FEE_TYPE_LABELS[uiFeeType] ?? plan.feeType}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {plan.rates && plan.rates.length > 0 ? (
                        <div className="flex flex-col gap-1 whitespace-nowrap">
                          {plan.rates.map((rate, rIdx) => (
                            <div key={rIdx} className="flex items-center gap-1.5">
                              {plan.rates.length > 1 && (
                                <span
                                  className="text-[12px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium truncate max-w-[130px]"
                                  title={`${rate.label}${rate.startTime && rate.endTime ? ` (${rate.startTime} - ${rate.endTime})` : ''}`}
                                >
                                  {rate.label}{' '}
                                  {rate.startTime && rate.endTime
                                    ? `(${rate.startTime}-${rate.endTime})`
                                    : ''}
                                </span>
                              )}
                              <span className="font-bold text-[#062F28] text-[14px]">
                                {fmt(rate.amount)}
                              </span>
                              <span className="text-[#6b6b6b] text-[12px]">
                                /{translateUnit(rate.unit)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-[13px] text-[#6b6b6b]">
                      <div className="flex flex-col gap-0.5 whitespace-nowrap">
                        {plan.overnightFee > 0 && (
                          <span>
                            Qua đêm:{' '}
                            <span className="font-medium text-[#062F28]">
                              {fmt(plan.overnightFee)}
                            </span>
                          </span>
                        )}
                        {plan.overtimeFeePerHour > 0 && (
                          <span>
                            Quá giờ:{' '}
                            <span className="font-medium text-[#062F28]">
                              {fmt(plan.overtimeFeePerHour)}/h
                            </span>
                          </span>
                        )}
                        {plan.lostCardFee > 0 && (
                          <span>
                            Mất thẻ:{' '}
                            <span className="font-medium text-[#062F28]">
                              {fmt(plan.lostCardFee)}
                            </span>
                          </span>
                        )}
                        {!plan.overnightFee && !plan.overtimeFeePerHour && !plan.lostCardFee && (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {(() => {
                        const sessCount = sessionCounts[plan._id] ?? 0;

                        if (isActive) {
                          return (
                            <div className="flex flex-col items-center gap-1.5">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-gradient-to-r from-[#f0fce4] to-[#e6f9d4] text-[#4a8c1c] border border-[#c2e89a]/60 shadow-sm">
                                <CheckCircle2 size={12} />
                                ĐANG ÁP DỤNG
                              </span>
                              {sessCount > 0 && (
                                <span className="text-[10px] font-medium text-[#4a8c1c]">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#82C94E] animate-pulse mr-1 align-middle" />
                                  {sessCount} xe đang gửi
                                </span>
                              )}
                            </div>
                          );
                        }

                        // Inactive
                        return (
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-gray-50 text-gray-400 border border-gray-200/60">
                              <PowerOff size={12} />
                              VÔ HIỆU HÓA
                            </span>
                            {sessCount > 0 && (
                              <span className="text-[10px] font-medium text-amber-600">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse mr-1 align-middle" />
                                {sessCount} xe · giá cũ
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div
                        className="flex items-center justify-end relative"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => handleMenuClick(e, plan._id)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={!!deletePlan}
        onClose={() => setDeletePlan(null)}
        onConfirm={handleDelete}
        title="Xác nhận xóa"
        message={`Bạn có chắc chắn muốn xóa bảng giá "${deletePlan?.name}" không?`}
        confirmText="Xóa bảng giá"
        cancelText="Hủy"
        variant="danger"
        isLoading={loading}
      />

      {menuState &&
        activeMenuPlan &&
        createPortal(
          <div
            style={{
              position: 'absolute',
              top: menuState.top,
              right: menuState.right,
              zIndex: 9999,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-40 bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-gray-100 py-1.5"
            >
              <button
                onClick={() => {
                  onEdit(activeMenuPlan);
                  setMenuState(null);
                }}
                className="w-full text-left px-4 py-2 text-[13px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit size={14} /> Chỉnh sửa
              </button>
              <div className="h-px bg-gray-100 mx-2 my-1" />
              {activeMenuPlan.status === 'active' ? (
                <button
                  onClick={() => {
                    toggle(activeMenuPlan, 'inactive');
                    setMenuState(null);
                  }}
                  className="w-full text-left px-4 py-2 text-[13px] text-orange-600 hover:bg-orange-50 flex items-center gap-2"
                >
                  <PowerOff size={14} /> Vô hiệu hóa
                </button>
              ) : (
                <button
                  onClick={() => {
                    toggle(activeMenuPlan, 'active');
                    setMenuState(null);
                  }}
                  className="w-full text-left px-4 py-2 text-[13px] text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"
                >
                  <CheckCircle2 size={14} /> Kích hoạt
                </button>
              )}
              <div className="h-px bg-gray-100 mx-2 my-1" />
              <button
                onClick={() => {
                  setDeletePlan(activeMenuPlan);
                  setMenuState(null);
                }}
                className="w-full text-left px-4 py-2 text-[13px] text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 size={14} /> Xóa
              </button>
            </motion.div>
          </div>,
          document.body
        )}
    </div>
  );
}
