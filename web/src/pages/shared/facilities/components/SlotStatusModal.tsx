import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  X,
  Loader2,
  Trash2,
  MapPin,
  Layers,
  Clock,
  CreditCard,
  User,
  LogIn,
  LogOut,
  DoorOpen,
  Banknote,
  Edit2,
  ChevronDown,
  Tag,
  Ticket,
  Phone,
  Mail,
  CalendarClock,
  Wrench,
} from 'lucide-react';
import { getOptimizedImageUrl } from '../../../../utils/cloudinary';
import {
  slotService,
  type ParkingSlot,
  type SlotStatus,
  type ParkingSessionPopulated,
} from '../../../../services/slot.service';
import { facilityService } from '../../../../services/facility.service';
import { floorService } from '../../../../services/floor.service';
import { userService } from '../../../../services/user.service';
import { vehicleTypeService, type VehicleType } from '../../../../services/vehicleType.service';
import { sessionService } from '../../../../services/session.service';
import { ConfirmModal } from '../../../../components/ConfirmModal';
import { ICON_MAP, DEFAULT_ICON, getVehicleColorTheme } from '../../../shared/vehicles/components/constants';

interface SlotStatusModalProps {
  slot: ParkingSlot | null;
  onClose: () => void;
  onSuccess: () => void;
}

// ── Config ────────────────────────────────────────────────

const STATUS_CFG: Record<
  SlotStatus,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  available: { label: 'TRỐNG', color: '#6b7280', bg: '#ffffff', border: '#e5e7eb', dot: '#9ca3af' },
  occupied: {
    label: 'ĐANG DÙNG',
    color: '#062F28',
    bg: '#A0E870',
    border: '#A0E870',
    dot: '#062F28',
  },
  reserved: {
    label: 'ĐẶT TRƯỚC',
    color: '#1d4ed8',
    bg: '#dbeafe',
    border: '#bfdbfe',
    dot: '#3b82f6',
  },
  maintenance: {
    label: 'BẢO TRÌ',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
    dot: '#ef4444',
  },
  locked: { label: 'KHÓA', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: '#ef4444' },
};

const SESSION_STATUS_CFG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  active: { label: 'HOẠT ĐỘNG', color: '#062F28', bg: '#A0E870', border: '#A0E870' },
  pending_payment: { label: 'CHỜ THANH TOÁN', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  completed: { label: 'HOÀN THÀNH', color: '#374151', bg: '#f9fafb', border: '#e5e7eb' },
  exception: { label: 'SỰ CỐ', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
};

function CustomSelect({
  value,
  onChange,
  options,
  placement = 'bottom',
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placement?: 'top' | 'bottom';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 bg-gray-50 rounded-xl text-sm font-medium flex items-center justify-between cursor-pointer transition-all select-none"
        style={{
          border: isOpen ? '1px solid #9FE870' : '1px solid #e2e3e2',
          boxShadow: isOpen ? '0 0 0 3px rgba(159,232,112,0.2)' : 'none',
          color: '#062F28',
          backgroundColor: isOpen ? '#ffffff' : '#f9fafb',
        }}
      >
        <span className="truncate pr-4">{selectedOption?.label}</span>
        <ChevronDown
          size={16}
          className="text-gray-500 shrink-0 transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: placement === 'top' ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: placement === 'top' ? 4 : -4 }}
            transition={{ duration: 0.15 }}
            className={`absolute left-0 right-0 bg-white border border-[#e2e3e2] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] z-[100] overflow-hidden flex flex-col max-h-[240px] ${
              placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            }`}
          >
            <div className="overflow-y-auto py-1.5 custom-scrollbar-select">
              <style>{`
                .custom-scrollbar-select::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar-select::-webkit-scrollbar-track { background: transparent; margin: 4px 0; }
                .custom-scrollbar-select::-webkit-scrollbar-thumb { background: #e2e3e2; border-radius: 4px; }
                .custom-scrollbar-select::-webkit-scrollbar-thumb:hover { background: #c0c0c0; }
              `}</style>
              {options.map((o) => (
                <div
                  key={o.value}
                  onClick={() => {
                    onChange(o.value);
                    setIsOpen(false);
                  }}
                  className="px-4 py-2.5 text-[14px] cursor-pointer transition-colors flex items-center"
                  style={{
                    color: value === o.value ? '#062F28' : '#4a4a4a',
                    background: value === o.value ? '#f4fbe9' : '#ffffff',
                    fontWeight: value === o.value ? 500 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (value !== o.value) e.currentTarget.style.background = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    if (value !== o.value) e.currentTarget.style.background = '#ffffff';
                  }}
                >
                  {o.label}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────

function fmtDateTime(dt?: string | null) {
  if (!dt) return '—';
  const d = new Date(dt);
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${time} — ${date}`;
}

function fmtDuration(checkIn: string, checkOut?: string | null) {
  const ms = Math.max(
    0,
    (checkOut ? new Date(checkOut) : new Date()).getTime() - new Date(checkIn).getTime()
  );
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h} giờ ${m} phút` : `${m} phút`;
}

function fmtFee(fee: number) {
  return fee.toLocaleString('vi-VN') + ' ₫';
}

function nameFromField(field: any): string | null {
  if (!field) return null;
  if (typeof field === 'object' && field.name) return field.name;
  return null;
}

function idFromField(field: any): string | null {
  if (!field) return null;
  if (typeof field === 'string') return field;
  return null;
}

function fmtPricingType(field: any): string {
  if (!field || typeof field !== 'object') return 'Mặc định';
  switch (field.feeMethod) {
    case 'flat_rate':
      return 'Theo lượt';
    case 'duration_based':
      return 'Theo giờ';
    case 'time_window':
      return 'Theo khung giờ';
    default:
      return field.name || 'Mặc định';
  }
}

// ── InfoItem (Grid based) ─────────────────────────────────

function InfoItem({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: any;
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-gray-400 text-[11px] font-bold uppercase tracking-widest">
        <Icon size={14} strokeWidth={2.5} /> {label}
      </div>
      <div
        className={`text-[15px] font-semibold break-words leading-relaxed ${highlight ? 'text-emerald-600 text-base' : 'text-gray-800'}`}
      >
        {value}
      </div>
    </div>
  );
}

// ── SessionInfo ───────────────────────────────────────────

function getImageUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith('http')) return getOptimizedImageUrl(url, 400);
  const SERVER_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');
  return `${SERVER_URL}${url.startsWith('/') ? url : `/${url}`}`;
}

function SessionInfo({ session }: { session: ParkingSessionPopulated }) {
  const ssCfg = SESSION_STATUS_CFG[session.status] ?? SESSION_STATUS_CFG.active;
  void ssCfg; // used for future reference
  const isActive = session.status === 'active' || session.status === 'pending_payment';

  const [staffInName, setStaffInName] = useState(nameFromField(session.staffInId) ?? '…');
  const [staffOutName, setStaffOutName] = useState<string | null>(
    nameFromField(session.staffOutId)
  );
  const [liveFee, setLiveFee] = useState<number>(session.totalFee || 0);

  useEffect(() => {
    const inId = idFromField(session.staffInId);
    if (inId) {
      userService
        .getUserById(inId)
        .then((r) => {
          if (r.success) setStaffInName(r.data.name);
        })
        .catch(() => setStaffInName('—'));
    }
    const outId = idFromField(session.staffOutId);
    if (outId) {
      userService
        .getUserById(outId)
        .then((r) => {
          if (r.success) setStaffOutName(r.data.name);
        })
        .catch(() => setStaffOutName('—'));
    }

    if (session._id && isActive) {
      sessionService
        .calculateFee(session._id)
        .then((r) => {
          if (r.success) setLiveFee(r.data.finalFee ?? r.data.totalFee ?? 0);
        })
        .catch(() => {});
    }
  }, [session, isActive]);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-4">
          <p className="text-[11px] font-bold text-gray-900 uppercase tracking-widest pl-1 mb-1.5">
            Biển số xe
          </p>
          <p className="text-3xl font-black text-[#062F28] tracking-widest uppercase break-words">
            {session.licensePlate}
          </p>
        </div>
      </div>

      {/* Grid details */}
      <div className="grid grid-cols-2 gap-x-5 gap-y-5 bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <InfoItem icon={User} label="NV vào" value={staffInName} />
        <InfoItem
          icon={CreditCard}
          label="Mã thẻ"
          value={
            <span className="font-mono bg-[#9FE870]/15 px-2.5 py-0.5 rounded text-[#062F28] border border-[#9FE870]/30">
              {session.cardCode}
            </span>
          }
        />

        <InfoItem icon={DoorOpen} label="Cổng" value={`${session.gateIn || 'Cổng A'}`} />
        <InfoItem icon={LogIn} label="Giờ vào" value={fmtDateTime(session.checkInTime)} />

        <InfoItem icon={Tag} label="Loại giá" value={fmtPricingType(session.pricingPlanId)} />
        <InfoItem
          icon={Clock}
          label="Thời gian"
          value={fmtDuration(session.checkInTime, session.checkOutTime)}
        />
        <InfoItem
          icon={Banknote}
          label="Tổng phí"
          value={fmtFee(isActive ? liveFee : session.totalFee)}
          highlight
        />

        {!isActive && (
          <>
            <InfoItem icon={User} label="NV ra" value={staffOutName ?? '…'} />
            <InfoItem icon={LogOut} label="Giờ ra" value={fmtDateTime(session.checkOutTime)} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────

export function SlotStatusModal({ slot, onClose, onSuccess }: SlotStatusModalProps) {
  const [selected, setSelected] = useState<SlotStatus | ''>('');
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [editCode, setEditCode] = useState('');
  const [editVtId, setEditVtId] = useState('');
  const [editStatus, setEditStatus] = useState<SlotStatus | ''>('');

  useEffect(() => {
    vehicleTypeService
      .getAll({ limit: 100 })
      .then((res) => {
        if (res.success) setVehicleTypes(res.data);
      })
      .catch(() => {});
  }, []);

  // Re-fetch slot with full populated currentSessionId
  const [freshSlot, setFreshSlot] = useState<ParkingSlot | null>(null);
  const [fetchingSlot, setFetchingSlot] = useState(false);

  const [facilityName, setFacilityName] = useState('');
  const [floorName, setFloorName] = useState('');
  const [fetchingNames, setFetchingNames] = useState(false);
  const [allowedVtIds, setAllowedVtIds] = useState<string[]>([]);

  const loadFreshSlot = useCallback(async (id: string) => {
    setFetchingSlot(true);
    try {
      const res = await slotService.getById(id);
      if (res.success) setFreshSlot(res.data);
    } catch {
      /* silent */
    } finally {
      setFetchingSlot(false);
    }
  }, []);

  useEffect(() => {
    setSelected('');
    setFreshSlot(null);
    setFacilityName('');
    setFloorName('');
    if (!slot) return;

    loadFreshSlot(slot._id);

    const fetchNames = async () => {
      setFetchingNames(true);
      try {
        const facId =
          slot.facilityId && typeof slot.facilityId === 'object' ? (slot.facilityId as any)._id : slot.facilityId;
        const flrId = slot.floorId && typeof slot.floorId === 'object' ? (slot.floorId as any)._id : slot.floorId;

        if (slot.facilityId && typeof slot.facilityId === 'object' && (slot.facilityId as any).name) {
          setFacilityName((slot.facilityId as any).name);
        } else if (facId) {
          const r = await facilityService.getById(facId);
          if (r.success) setFacilityName(r.data.name);
        }
        if (slot.floorId && typeof slot.floorId === 'object' && (slot.floorId as any).name) {
          setFloorName((slot.floorId as any).name);
        }
        if (flrId) {
          const r = await floorService.getById(flrId);
          if (r.success) {
            if (!(slot.floorId && typeof slot.floorId === 'object' && (slot.floorId as any).name)) {
              setFloorName(r.data.name);
            }
            const allowedIds = (r.data.allowedVehicleTypes || []).map((item: any) =>
              typeof item === 'string' ? item : item._id
            );
            setAllowedVtIds(allowedIds);
          }
        }
      } catch {
        /* silent */
      } finally {
        setFetchingNames(false);
      }
    };
    fetchNames();
  }, [slot, loadFreshSlot]);

  useEffect(() => {
    const s = freshSlot ?? slot;
    if (s) {
      setEditCode(s.code);
      setEditVtId(
        s.vehicleTypeId && typeof s.vehicleTypeId === 'object' ? (s.vehicleTypeId as any)._id : s.vehicleTypeId
      );
      setEditStatus(s.status);
    }
  }, [freshSlot, slot, isEditing]);

  if (!slot) return null;

  const displaySlot = freshSlot ?? slot;

  let nexts: SlotStatus[] = [];
  if (displaySlot.status === 'available') {
    nexts = ['maintenance'];
  } else if (displaySlot.status === 'maintenance' || displaySlot.status === 'locked') {
    nexts = ['available'];
  }

  const canDelete = displaySlot.status === 'available';
  const curCfg = STATUS_CFG[displaySlot.status];

  const session: ParkingSessionPopulated | null =
    displaySlot.currentSessionId && typeof displaySlot.currentSessionId === 'object'
      ? (displaySlot.currentSessionId as ParkingSessionPopulated)
      : null;

  const reservation = displaySlot.reservationInfo || null;

  let VtIcon = ICON_MAP[DEFAULT_ICON];
  let vtNameStr = 'N/A';
  let vtCode = '';
  let vtIconKey = '';
  if (displaySlot.vehicleTypeId && typeof displaySlot.vehicleTypeId === 'object') {
    const vt = displaySlot.vehicleTypeId as any;
    vtNameStr = vt.name || 'N/A';
    vtCode = vt.code || '';
    vtIconKey = vt.icon || '';
    if (vt.icon && ICON_MAP[vt.icon]) VtIcon = ICON_MAP[vt.icon];
  } else if (displaySlot.vehicleTypeId) {
    vtNameStr = displaySlot.vehicleTypeId as string;
  }
  const vtColorTheme = getVehicleColorTheme(vtCode, vtIconKey);
  // Override curCfg for slot box colors based on vehicle type
  const slotBoxCfg = (vtCode || vtIconKey)
    ? { bg: vtColorTheme.bg, color: vtColorTheme.text, border: vtColorTheme.bg, dot: vtColorTheme.text }
    : curCfg;

  const handleSubmit = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await slotService.updateStatus(slot._id, { status: selected });
      toast.success(`Slot ${slot.code} → ${STATUS_CFG[selected].label}`);
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Cập nhật thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    const hasStatusChange = editStatus !== '' && editStatus !== displaySlot.status;
    const currentVtId =
      displaySlot.vehicleTypeId && typeof displaySlot.vehicleTypeId === 'object'
        ? (displaySlot.vehicleTypeId as any)._id
        : displaySlot.vehicleTypeId;
    const hasInfoChange =
      editCode.trim().toUpperCase() !== displaySlot.code || editVtId !== currentVtId;

    if (!hasStatusChange && !hasInfoChange) {
      setIsEditing(false);
      return;
    }

    setLoading(true);
    try {
      if (hasStatusChange) {
        await slotService.updateStatus(slot._id, { status: editStatus as SlotStatus });
      }
      if (hasInfoChange) {
        await slotService.update(slot._id, {
          code: editCode.trim().toUpperCase(),
          vehicleTypeId: editVtId,
        });
      }

      toast.success('Cập nhật thành công');
      onSuccess();
      setIsEditing(false);
      loadFreshSlot(slot._id);
    } catch (e: any) {
      toast.error(e.message || 'Cập nhật thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await slotService.delete(slot._id);
      toast.success('Đã xóa slot');
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Xóa thất bại');
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
      >
        {/* Modal Panel */}
        <motion.div
          key="modal"
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-5xl h-[800px] max-h-[95vh] bg-white rounded-[32px] shadow-[0_24px_64px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden"
        >
          {/* ═══ HEADER (FIXED) ═══ */}
          <div className="px-7 py-5 border-b border-gray-100 flex items-start justify-between bg-white shrink-0 z-10 relative">
            <div>
              <h3 className="text-[18px] font-bold text-gray-900">
                {isEditing ? 'Chỉnh Sửa Vị Trí' : 'Chi Tiết Vị Trí Đỗ Xe'}
              </h3>
              <p className="text-[13px] text-gray-500 mt-0.5">
                {isEditing
                  ? 'Cập nhật thông tin và trạng thái'
                  : 'Thông tin chi tiết về vị trí đỗ xe'}
              </p>
            </div>
            <div className="flex items-center gap-1 -mt-1 -mr-2">
              {!isEditing && displaySlot.status !== 'occupied' && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-[#4a7c20] hover:bg-[#f4f7ed] transition-colors"
                  title="Chỉnh sửa slot"
                >
                  <Edit2 size={16} />
                </button>
              )}
              {canDelete && !isEditing && (
                <button
                  onClick={() => setConfirmOpen(true)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Xóa slot"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          {/* ═══ CONTENT ═══ */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {isEditing ? (
              <div className="p-7 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-bold text-gray-900 uppercase tracking-widest mb-2">
                    Mã vị trí
                  </label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#9FE870] uppercase"
                    maxLength={10}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-900 uppercase tracking-widest mb-2">
                    Loại xe
                  </label>
                  <CustomSelect
                    value={editVtId}
                    onChange={setEditVtId}
                    options={vehicleTypes
                      .filter((vt) => allowedVtIds.length === 0 || allowedVtIds.includes(vt._id))
                      .map((vt) => ({ value: vt._id, label: vt.name }))}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 items-stretch overflow-hidden">
                {/* Left Column: All Info (Slot & Session) */}
                <div className="bg-white flex flex-col border-r border-gray-100 overflow-y-auto">
                  <div className="flex-1 p-6 flex flex-col gap-5">
                    {/* --- Slot Info Section (Top) --- */}
                    <div>
                      {/* Slot Position, Status, Floor */}
                      <div className="mb-5">
                        {/* Row 1: Title & Status */}
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-bold text-gray-900 uppercase tracking-widest pl-1">
                            Vị trí đỗ xe
                          </p>
                          <span
                            className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1 rounded-xl border"
                            style={{
                              color: curCfg.color,
                              background: curCfg.bg,
                              borderColor: curCfg.border,
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: curCfg.dot }}
                            />
                            {curCfg.label}
                          </span>
                        </div>

                        {/* Row 2: Box & Floor */}
                        <div className="flex items-center gap-3">
                          <div
                            className="flex flex-col items-center justify-center min-w-[72px] h-[72px] px-3 rounded-[18px] shadow-sm relative overflow-hidden transition-colors"
                            style={{
                              background: slotBoxCfg.bg,
                              borderColor: slotBoxCfg.border,
                              borderWidth: 1,
                            }}
                          >
                            {displaySlot.status === 'occupied' ? (
                              <>
                                <VtIcon
                                  size={28}
                                  style={{ color: slotBoxCfg.color }}
                                  className="opacity-90 mb-0.5"
                                  strokeWidth={1.5}
                                />
                                <span
                                  className="text-[11px] font-bold opacity-75"
                                  style={{ color: slotBoxCfg.color }}
                                >
                                  {displaySlot.code}
                                </span>
                              </>
                            ) : (
                              <>
                                <VtIcon
                                  size={28}
                                  style={{ color: slotBoxCfg.color }}
                                  className="opacity-90 mb-0.5"
                                  strokeWidth={1.5}
                                />
                                <span
                                  className="text-[11px] font-bold opacity-75"
                                  style={{ color: slotBoxCfg.color }}
                                >
                                  {displaySlot.code}
                                </span>
                              </>
                            )}
                          </div>

                          <div>
                            {fetchingNames ? (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-3.5 h-3.5 bg-gray-200 rounded-sm animate-pulse" />
                                  <div className="h-4 w-20 rounded bg-gray-200 animate-pulse" />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-3.5 h-3.5 bg-gray-200 rounded-sm animate-pulse" />
                                  <div className="h-4 w-16 rounded bg-gray-200 animate-pulse" />
                                </div>
                              </div>
                            ) : facilityName || floorName ? (
                              <div className="flex flex-col gap-1.5 text-[14px] font-medium text-gray-500">
                                {facilityName && (
                                  <span className="inline-flex items-center gap-1.5">
                                    <MapPin size={16} className="text-gray-400" /> {facilityName}
                                  </span>
                                )}
                                {floorName && (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Layers size={16} className="text-gray-400" /> Tầng: {floorName}
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Vehicle Types (Image 2 style) */}
                      <div className="mb-5">
                        <p className="text-[11px] font-bold text-gray-900 uppercase tracking-widest mb-2.5">
                          Các loại xe cho phép
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <div
                            className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg"
                            style={{ background: vtColorTheme.bg, borderColor: vtColorTheme.bg, color: vtColorTheme.text }}
                          >
                            <VtIcon size={16} strokeWidth={2.5} />
                            <span className="text-[13px] font-bold">{vtNameStr}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status Switcher (Grid) */}
                      {nexts.length > 0 && (
                        <div className="mb-5">
                          <p className="text-[11px] font-bold text-gray-900 uppercase tracking-widest mb-2.5">
                            Cập nhật trạng thái
                          </p>
                          <div className="flex gap-3">
                            {nexts.map((s) => {
                              const cfg = STATUS_CFG[s];
                              const isSelected = selected === s;

                              let hoverClass = 'hover:border-gray-200 hover:bg-gray-50';
                              let selectedClass = 'border-[#062F28] bg-[#062F28] text-white';

                              if (s === 'available') {
                                hoverClass = 'hover:border-emerald-300 hover:bg-emerald-50';
                                selectedClass = 'border-emerald-500 bg-emerald-50 text-emerald-700';
                              }
                              if (s === 'maintenance') {
                                hoverClass = 'hover:border-amber-300 hover:bg-amber-50';
                                selectedClass = 'border-amber-500 bg-amber-50 text-amber-700';
                              }
                              if (s === 'locked') {
                                hoverClass = 'hover:border-rose-300 hover:bg-rose-50';
                                selectedClass = 'border-rose-500 bg-rose-50 text-rose-700';
                              }

                              return (
                                <button
                                  key={s}
                                  onClick={() => setSelected(isSelected ? '' : s)}
                                  className={`flex-1 relative flex flex-col items-center justify-center py-3 rounded-[14px] border-[3px] transition-all ${
                                    isSelected
                                      ? `${selectedClass} scale-[1.02] shadow-sm`
                                      : `border-gray-100 bg-white ${hoverClass}`
                                  }`}
                                >
                                  <span
                                    className={`text-[14px] font-bold ${isSelected ? '' : 'text-gray-600'}`}
                                  >
                                    {cfg.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Submit Button (Animated presence) */}
                      <AnimatePresence>
                        {selected && (
                          <motion.div
                            initial={{ height: 0, opacity: 0, marginTop: 0 }}
                            animate={{ height: 'auto', opacity: 1, marginTop: 16 }}
                            exit={{ height: 0, opacity: 0, marginTop: 0 }}
                            className="overflow-hidden flex flex-col gap-3 p-1 -m-1"
                          >
                            <button
                              disabled={loading}
                              onClick={handleSubmit}
                              className="w-full h-[52px] bg-[#062F28] text-white font-extrabold text-sm rounded-[16px] shadow-sm hover:bg-[#062F28]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            >
                              {loading && <Loader2 size={16} className="animate-spin" />}
                              Cập nhật trạng thái
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* --- Divider --- */}
                    {session && <hr className="border-gray-100 my-1" />}

                    {/* --- Session / Reservation Info Section (Bottom) --- */}
                    {fetchingSlot ? (
                      <div className="flex flex-col items-center justify-center py-8 gap-3 text-gray-400">
                        <Loader2 className="animate-spin" size={24} />
                        <p className="text-[13px] font-medium">Đang tải chi tiết...</p>
                      </div>
                    ) : session ? (
                      <div>
                        <SessionInfo session={session} />
                      </div>
                    ) : reservation ? (
                      <div className="flex flex-col gap-5">
                        {/* Reservation Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0 pr-4">
                            <p className="text-[11px] font-bold text-gray-900 uppercase tracking-widest pl-1 mb-1.5">
                              Thông tin đặt trước
                            </p>
                            <p className="text-3xl font-black text-[#062F28] tracking-widest uppercase break-words">
                              {reservation.licensePlate}
                            </p>
                          </div>
                        </div>

                        {/* Reservation Grid */}
                        <div className="grid grid-cols-2 gap-x-5 gap-y-5 bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                          <InfoItem
                            icon={Ticket}
                            label="Mã đặt chỗ"
                            value={
                              <span className="font-mono bg-blue-50 px-2.5 py-0.5 rounded text-blue-700 border border-blue-200">
                                {reservation.code}
                              </span>
                            }
                          />
                          <InfoItem
                            icon={Tag}
                            label="Trạng thái"
                            value={
                              <span className={`inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1 rounded-xl border ${
                                reservation.status === 'confirmed'
                                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                  : 'text-amber-700 bg-amber-50 border-amber-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${reservation.status === 'confirmed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                {reservation.status === 'confirmed' ? 'Đã xác nhận' : 'Chờ xác nhận'}
                              </span>
                            }
                          />
                          {typeof reservation.user === 'object' && (
                            <InfoItem icon={User} label="Người đặt" value={reservation.user.name} />
                          )}
                          <InfoItem
                            icon={CalendarClock}
                            label="Thời gian đặt"
                            value={fmtDateTime(reservation.startTime)}
                          />
                          {typeof reservation.user === 'object' && reservation.user.email && (
                            <InfoItem icon={Mail} label="Email" value={reservation.user.email} />
                          )}
                          {typeof reservation.user === 'object' && reservation.user.phone && (
                            <InfoItem icon={Phone} label="Số điện thoại" value={reservation.user.phone} />
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Right Column: Image */}
                <div className="bg-[#fafafa] flex flex-col items-center p-7 relative overflow-hidden">
                  {!session && !reservation ? (
                    displaySlot.status === 'maintenance' || displaySlot.status === 'locked' ? (
                      <div className="flex flex-col items-center justify-center h-full text-center text-amber-500">
                        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center shadow-sm mb-4 border-2 border-amber-200">
                          <Wrench size={32} className="text-amber-500" />
                        </div>
                        <p className="text-[14px] font-bold text-amber-700 mb-1">
                          {displaySlot.status === 'maintenance' ? 'Đang bảo trì' : 'Đã khóa'}
                        </p>
                        <p className="text-[13px] text-amber-600/80">
                          {displaySlot.maintenanceReason || 'Vị trí này tạm thời không khả dụng.'}
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                          {(() => { const DefIcon = ICON_MAP[DEFAULT_ICON]; return <DefIcon size={24} className="text-gray-300" />; })()}
                        </div>
                        <p className="text-[14px] font-medium text-gray-500 mb-1">
                          Vị trí đang trống
                        </p>
                        <p className="text-[13px]">Chưa có xe nào đang đỗ tại đây.</p>
                      </div>
                    )
                  ) : reservation && !session ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center shadow-sm mb-4 border-2 border-blue-200">
                        <Ticket size={32} className="text-blue-500" />
                      </div>
                      <p className="text-[14px] font-bold text-blue-700 mb-1">
                        Đã đặt trước
                      </p>
                      <p className="text-[13px] text-gray-500">
                        Slot này đã được đặt bởi{' '}
                        <span className="font-semibold text-[#062F28]">
                          {typeof reservation.user === 'object' ? reservation.user.name : 'Người dùng'}
                        </span>
                      </p>
                      <p className="text-[12px] text-gray-400 mt-1">
                        Biển số: <span className="font-bold text-[#062F28] tracking-wider">{reservation.licensePlate}</span>
                      </p>
                    </div>
                  ) : session?.checkInImage ? (
                    <div className="w-full h-full flex flex-col gap-3">
                      <p className="text-[11px] font-bold text-gray-900 uppercase tracking-widest w-full text-left pl-1 shrink-0">
                        Hình ảnh xe lúc vào
                      </p>
                      <div className="w-full flex-1 rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-200/60 p-2 flex items-center justify-center">
                        <img 
                          src={getImageUrl(session?.checkInImage) || ''} 
                          alt="Hình ảnh xe lúc vào" 
                          className="w-full h-full object-contain rounded-xl"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center text-gray-400">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                        {(() => { const DefIcon = ICON_MAP[DEFAULT_ICON]; return <DefIcon size={24} className="text-gray-300" />; })()}
                      </div>
                      <p className="text-[14px] font-medium text-gray-500 mb-1">
                        Không có hình ảnh
                      </p>
                      <p className="text-[13px]">Phiên này không có ảnh chụp xe.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ═══ FOOTER ═══ */}
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={loading}
                  className="h-10 px-6 rounded-xl font-semibold text-sm bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={loading}
                  className="h-10 px-6 rounded-xl font-bold text-sm bg-[#062F28] text-white hover:bg-[#062F28]/90 shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  Lưu Thay Đổi
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className="h-10 px-6 rounded-xl font-bold text-sm bg-gray-200 text-gray-700 hover:bg-[#9FE870] hover:text-[#062F28] transition-colors"
              >
                Đóng
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Xóa Vị Trí Đỗ Xe"
        message={`Bạn có chắc chắn muốn xóa vị trí đỗ xe "${displaySlot.code}" không?`}
        confirmText="Xóa vị trí"
        isLoading={isDeleting}
        variant="danger"
      />
    </AnimatePresence>,
    document.body
  );
}
