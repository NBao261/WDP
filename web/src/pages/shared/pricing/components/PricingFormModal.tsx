import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Plus,
  X,
  Loader2,
  Moon,
  Clock,
  CreditCard,
  ChevronDown,
  AlertTriangle,
  ShieldAlert,
  MapPin,
  Building2,
  Lock,
  Check,
} from 'lucide-react';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  pricingService,
  type PricingPlan,
  type CreatePricingPlanPayload,
  type UpdatePricingPlanPayload,
} from '../../../../services/pricing.service';
import {
  formSchema,
  type FormValues,
  FEE_TYPE_OPTIONS,
  FEE_TYPE_LABELS,
  mapToUiType,
  mapToBackendFeeConfig,
} from './constants';
import { ICON_MAP, DEFAULT_ICON } from '../../../shared/vehicles/components/constants';

interface FormModalProps {
  plan?: PricingPlan;
  facilities: any[];
  vehicleTypes: any[];
  existingPlans?: PricingPlan[];
  onClose: () => void;
  onSuccess: () => void;
  selectedFacilityId?: string;
  selectedVehicleTypeId?: string;
}

export function PricingFormModal({
  plan,
  facilities,
  vehicleTypes,
  existingPlans = [],
  onClose,
  onSuccess,
  selectedFacilityId,
  selectedVehicleTypeId,
}: FormModalProps) {
  const isEdit = !!plan;
  const [isFacOpen, setIsFacOpen] = useState(false);
  const [isVtOpen, setIsVtOpen] = useState(false);
  const [step, setStep] = useState(1);
  const STEPS = ['Thông tin chung', 'Cài đặt nâng cao', 'Cấu hình mức giá'];

  const handleNumberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const getVtId = (vt: any) => (vt && typeof vt === 'object' ? vt._id : vt);
  const getFacId = (f: any) => (f && typeof f === 'object' ? f._id : f);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: plan
      ? {
          name: plan.name,
          vehicleTypeId: getVtId(plan.vehicleTypeId),
          facilityId: getFacId(plan.facilityId),
          uiFeeType: mapToUiType(plan.feeType, plan.feeMethod || '') as any,
          rates: (() => {
            const uiType = mapToUiType(plan.feeType, plan.feeMethod || '');
            if (uiType === 'hourly') {
              return [
                plan.rates[0] || { label: 'Giờ đầu', amount: 0, unit: 'giờ' },
                plan.rates[1] || { label: 'Giờ tiếp theo', amount: 0, unit: 'giờ' },
              ];
            }
            if (uiType === 'per_turn') {
              return [plan.rates[0] || { label: 'Mỗi lượt', amount: 0, unit: 'lượt' }];
            }
            return plan.rates;
          })(),
          overnightFee: plan.overnightFee,
          overtimeFeePerHour: plan.overtimeFeePerHour,
          lostCardFee: plan.lostCardFee,
          gracePeriodMinutes: plan.gracePeriodMinutes ?? 0,
          maxDailyFee: plan.maxDailyFee ?? 0,
          firstBlockHours: plan.firstBlockHours ?? 1,
        }
      : {
          facilityId: selectedFacilityId || ('' as any),
          vehicleTypeId: selectedVehicleTypeId || ('' as any),
          uiFeeType: undefined as any,
          rates: [],
          overnightFee: '' as any,
          overtimeFeePerHour: '' as any,
          lostCardFee: '' as any,
          gracePeriodMinutes: '' as any,
          maxDailyFee: '' as any,
          firstBlockHours: '' as any,
        },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'rates' });

  const currentUiFeeType = useWatch({ control, name: 'uiFeeType' });
  const currentFacilityId = useWatch({ control, name: 'facilityId' });
  const currentFacility = facilities.find((f) => f._id === currentFacilityId);

  const allowedVehicleTypes = vehicleTypes;

  // Kiểm tra số lượt gửi xe đang dùng bảng giá này
  const [activeSessionCount, setActiveSessionCount] = useState(0);
  const hasActiveSessions = isEdit && activeSessionCount > 0;

  useEffect(() => {
    if (isEdit && plan?._id) {
      pricingService
        .getActiveSessionCount(plan._id)
        .then((res) => setActiveSessionCount(res.data.activeSessionCount))
        .catch(() => setActiveSessionCount(0));
    }
  }, [isEdit, plan?._id]);

  // Tự động điều chỉnh rates khi thay đổi loại hình thu phí
  useEffect(() => {
    if (isEdit) return;
    if (currentUiFeeType === 'per_turn') {
      setValue('rates', [{ label: 'Mỗi lượt', amount: '' as any, unit: 'lượt' }]);
    } else if (currentUiFeeType === 'hourly') {
      setValue('rates', [
        { label: 'Giờ đầu', amount: '' as any, unit: 'giờ' },
        { label: 'Giờ tiếp theo', amount: '' as any, unit: 'giờ' },
      ]);
    } else if (currentUiFeeType === 'time_window') {
      setValue('rates', [
        { label: 'Khung giờ', amount: '' as any, unit: 'giờ', startTime: '', endTime: '' },
      ]);
    }
  }, [currentUiFeeType, isEdit, setValue]);

  // Determine if feeType should be locked based on existing plans for the selected facility
  const lockedFeeType = useMemo(() => {
    if (!currentFacilityId) return null;
    const facilityPlans = existingPlans.filter((p) => {
      const pFacId = typeof p.facilityId === 'object' ? p.facilityId._id : p.facilityId;
      return pFacId === currentFacilityId && p.status === 'active';
    });
    if (facilityPlans.length === 0) return null;
    // All plans in this facility must have the same feeType
    const firstPlan = facilityPlans[0];
    return mapToUiType(firstPlan.feeType, firstPlan.feeMethod || '');
  }, [currentFacilityId, existingPlans]);

  // Auto-set feeType when facility is selected and has existing plans
  useEffect(() => {
    if (lockedFeeType && !isEdit) {
      setValue('uiFeeType', lockedFeeType as any);
    }
  }, [lockedFeeType, isEdit, setValue]);

  const onSubmit = async (data: FormValues) => {
    try {
      const { uiFeeType, ...restData } = data;
      const { feeType, feeMethod } = mapToBackendFeeConfig(uiFeeType);

      if (isEdit) {
        let payload: UpdatePricingPlanPayload = { ...restData, feeType, feeMethod } as any;
        if (hasActiveSessions) {
          payload = { name: payload.name } as any;
        }
        await pricingService.update(plan!._id, payload);
        toast.success('Cập nhật bảng giá thành công');
      } else {
        const payload: CreatePricingPlanPayload = { ...restData, feeType, feeMethod } as any;
        await pricingService.create(payload);
        toast.success('Tạo bảng giá mới thành công');
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Thao tác thất bại');
    }
  };

  const handleNext = async () => {
    let valid = false;
    if (step === 1) {
      valid = await trigger(['facilityId', 'name', 'vehicleTypeId', 'uiFeeType']);
      if (!valid) toast.error('Vui lòng điền đầy đủ thông tin ở bước 1');
    } else if (step === 2) {
      valid = await trigger([
        'gracePeriodMinutes',
        'lostCardFee',
        'firstBlockHours',
        'maxDailyFee',
        'overnightFee',
        'overtimeFeePerHour',
      ]);
      if (!valid) toast.error('Vui lòng kiểm tra lại các trường ở bước 2');
    }
    if (valid) setStep(step + 1);
  };

  const getInputCls = (hasError: boolean, extra = '') => {
    const base = `w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all ${extra}`;
    if (hasError) {
      return `${base} border-red-400 focus:ring-red-300 bg-red-50/30`;
    }
    return `${base} border-gray-200 focus:ring-[#9FE870] text-gray-800`;
  };
  const errCls = 'text-xs text-red-500 mt-1 flex items-center gap-1';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <div>
            <h2 className="text-[19px] font-extrabold text-[#062F28]">
              {isEdit ? 'Chỉnh Sửa Bảng Giá' : 'Thêm Bảng Giá Mới'}
            </h2>
            <p className="text-[15px] text-gray-500 mt-1">
              Thiết lập cấu hình thu phí cho bãi đỗ xe
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-200 text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex px-6 py-4 border-b border-gray-100 bg-white items-center justify-center gap-4 sm:gap-8 shrink-0">
          {STEPS.map((s, i) => {
            const isPast = step > i + 1;
            const isCurr = step === i + 1;
            return (
              <div key={i} className="flex items-center gap-2 sm:gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${isCurr ? 'bg-[#9FE870] text-[#062F28] ring-4 ring-[#9FE870]/20' : isPast ? 'bg-[#062F28] text-white' : 'bg-gray-100 text-gray-400'}`}
                >
                  {isPast ? <Check size={12} /> : i + 1}
                </div>
                <span
                  className={`text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${isCurr || isPast ? 'text-[#062F28]' : 'text-gray-400'}`}
                >
                  {s}
                </span>
                {i < STEPS.length - 1 && (
                  <div
                    className={`hidden sm:block w-4 lg:w-12 h-[2px] rounded-full transition-colors ${isPast ? 'bg-[#062F28]' : 'bg-gray-100'}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {isEdit && hasActiveSessions && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex gap-3 items-start text-amber-800 shrink-0">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />
            <div className="text-sm">
              <p className="font-semibold">
                Hiện có {activeSessionCount} lượt gửi xe đang sử dụng bảng giá này
              </p>
              <p className="mt-0.5 text-amber-700">
                Không thể chỉnh sửa thông tin giá khi còn xe đang gửi. Bạn chỉ có thể đổi tên bảng
                giá. Vui lòng đợi tất cả xe ra bãi hoặc tạo bảng giá mới.
              </p>
            </div>
          </div>
        )}

        {isEdit && !hasActiveSessions && (
          <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 flex gap-3 items-start text-blue-800 shrink-0">
            <ShieldAlert size={16} className="shrink-0 mt-0.5 text-blue-500" />
            <p className="text-sm">
              <span className="font-semibold">Lưu ý: </span>
              Hiện không có xe nào đang sử dụng bảng giá này. Bạn có thể tự do chỉnh sửa.
            </p>
          </div>
        )}

        {/* Scrollable body */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto bg-gray-50/30 flex flex-col"
        >
          {/* ── BƯỚC 1: THÔNG TIN CHUNG ──────────────────────────────────── */}
          <div className={step === 1 ? 'block flex-1' : 'hidden'}>
            <div className="px-6 py-5 border-b border-gray-100 bg-white">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wider block mb-2">
                Tòa nhà áp dụng <span className="text-red-600">*</span>
              </label>
              <Controller
                control={control}
                name="facilityId"
                render={({ field }) => {
                  const selected = facilities.find((f) => f._id === field.value);
                  const hasErr = !!errors.facilityId;
                  const isLocked = isEdit || !!selectedFacilityId;
                  return (
                    <div className="relative">
                      <div
                        onClick={() => !isLocked && setIsFacOpen(!isFacOpen)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          isLocked
                            ? 'border-gray-300 bg-gray-200 cursor-not-allowed opacity-90'
                            : isFacOpen
                              ? 'border-[#8AD65D] bg-white shadow-md cursor-pointer' // Viền xanh đậm hơn chút, bóng to hơn
                              : hasErr
                                ? 'border-red-500 focus:ring-red-400 bg-red-50 cursor-pointer'
                                : 'border-gray-300 bg-gray-100 hover:bg-white hover:border-[#9FE870] cursor-pointer'
                        }`}
                      >
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: 'rgba(159,232,112,0.25)', // Nền icon đậm hơn
                            border: '1px solid rgba(159,232,112,0.5)', // Viền icon rõ hơn
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Building2 size={20} style={{ color: '#062F28' }} />
                        </div>

                        {selected ? (
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-[15px] text-[#062F28] truncate">
                              {selected.name}
                            </p>
                            <div className="flex items-start gap-1.5 mt-1 text-[13px] font-medium text-gray-800">
                              <MapPin size={14} className="shrink-0 mt-0.5 text-gray-600" />
                              <span>{selected.address}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[13px] font-medium text-gray-800">
                              <Clock size={14} className="shrink-0 text-gray-600" />
                              <span>
                                {selected.openTime} – {selected.closeTime}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[14px] font-medium text-gray-600 flex-1">
                            -- Chọn tòa nhà / bãi đỗ xe --
                          </span>
                        )}

                        {!isLocked && (
                          <ChevronDown
                            size={18}
                            className={`text-gray-600 shrink-0 transition-transform ${isFacOpen ? 'rotate-180' : ''}`}
                          />
                        )}
                      </div>

                      {hasErr && (
                        <p className={`${errCls} text-red-600 font-medium mt-1.5`}>
                          <span>⚠</span> {errors.facilityId!.message}
                        </p>
                      )}

                      <AnimatePresence>
                        {isFacOpen && (
                          <div
                            key="fac-overlay"
                            className="fixed inset-0 z-40"
                            onClick={() => setIsFacOpen(false)}
                          />
                        )}
                        {isFacOpen && (
                          <motion.div
                            key="fac-dropdown"
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute top-[calc(100%+6px)] left-0 w-full bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-50 max-h-60 overflow-y-auto"
                          >
                            {facilities.map((f) => (
                              <div
                                key={f._id}
                                onClick={() => {
                                  field.onChange(f._id);
                                  setIsFacOpen(false);
                                }}
                                className={`px-4 py-3 cursor-pointer flex items-center gap-3 border-b border-gray-100 last:border-0 transition-colors ${
                                  field.value === f._id ? 'bg-[#9FE870]/30' : 'hover:bg-gray-100'
                                }`}
                              >
                                <div
                                  style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 8,
                                    background: 'rgba(159,232,112,0.2)',
                                    border: '1px solid rgba(159,232,112,0.4)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  <Building2 size={16} style={{ color: '#062F28' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p
                                    className={`text-[14px] truncate ${
                                      field.value === f._id
                                        ? 'text-[#062F28] font-bold'
                                        : 'text-gray-900 font-semibold'
                                    }`}
                                  >
                                    {f.name}
                                  </p>
                                  <div className="flex items-start gap-1.5 mt-0.5 text-[12px] font-medium text-gray-600">
                                    <MapPin size={12} className="shrink-0 mt-0.5" />
                                    {f.address}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-600">
                                    <Clock size={12} className="shrink-0" />
                                    {f.openTime} – {f.closeTime}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }}
              />
            </div>

            <div className="px-6 py-6 bg-white space-y-6">
              {/* Tên bảng giá */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                  Tên bảng giá <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('name')}
                  className={getInputCls(!!errors.name)}
                  placeholder="Ví dụ: Xe máy - Theo giờ"
                />
                {errors.name && (
                  <p className={errCls}>
                    <span>⚠</span> {errors.name.message}
                  </p>
                )}
              </div>

              {/* Loại xe */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                  Loại xe <span className="text-red-500">*</span>
                </label>
                <Controller
                  control={control}
                  name="vehicleTypeId"
                  render={({ field }) => {
                    const selected = allowedVehicleTypes.find((v) => v._id === field.value);
                    const SelectedIcon =
                      selected?.icon && ICON_MAP[selected.icon]
                        ? ICON_MAP[selected.icon]
                        : ICON_MAP[DEFAULT_ICON];
                    const hasErr = !!errors.vehicleTypeId;
                    return (
                      <div className="relative">
                        <div
                          onClick={() => {
                            if (!isEdit && allowedVehicleTypes.length > 0) {
                              setIsVtOpen(!isVtOpen);
                            }
                          }}
                          className={`${getInputCls(hasErr)} flex items-center justify-between ${isEdit || allowedVehicleTypes.length === 0 ? 'bg-gray-100 opacity-70 pointer-events-none cursor-not-allowed' : 'cursor-pointer'} ${isVtOpen ? 'ring-2 ring-[#9FE870] border-[#9FE870]' : ''}`}
                        >
                          <span
                            className={
                              selected ? 'flex items-center gap-2 text-[#062F28]' : 'text-gray-400'
                            }
                          >
                            {selected ? (
                              <>
                                <SelectedIcon size={15} />
                                {selected.name}
                              </>
                            ) : allowedVehicleTypes.length === 0 ? (
                              'Chưa có loại xe'
                            ) : (
                              '-- Chọn loại xe --'
                            )}
                          </span>
                          <ChevronDown
                            size={15}
                            className={`text-gray-400 transition-transform ${isVtOpen ? 'rotate-180' : ''}`}
                          />
                        </div>
                        {hasErr && (
                          <p className={errCls}>
                            <span>⚠</span> {errors.vehicleTypeId!.message}
                          </p>
                        )}
                        <AnimatePresence>
                          {isVtOpen && (
                            <div
                              key="vt-overlay"
                              className="fixed inset-0 z-40"
                              onClick={() => setIsVtOpen(false)}
                            />
                          )}
                          {isVtOpen && (
                            <motion.div
                              key="vt-dropdown"
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              className="absolute top-[calc(100%+6px)] left-0 w-full bg-white border border-gray-100 rounded-xl shadow-xl py-1 z-50 max-h-44 overflow-y-auto"
                            >
                              {allowedVehicleTypes.length === 0 ? (
                                <div className="px-3 py-3 text-sm text-center text-gray-500">
                                  Chưa có loại xe
                                </div>
                              ) : (
                                allowedVehicleTypes.map((v) => {
                                  const IconComp =
                                    v.icon && ICON_MAP[v.icon]
                                      ? ICON_MAP[v.icon]
                                      : ICON_MAP[DEFAULT_ICON];
                                  return (
                                    <div
                                      key={v._id}
                                      onClick={() => {
                                        field.onChange(v._id);
                                        setIsVtOpen(false);
                                      }}
                                      className={`px-3 py-2.5 text-sm cursor-pointer flex items-center gap-2 transition-colors ${field.value === v._id ? 'bg-[#9FE870]/20 text-[#062F28] font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                                    >
                                      <IconComp
                                        size={15}
                                        className={
                                          field.value === v._id ? 'text-[#062F28]' : 'text-gray-400'
                                        }
                                      />
                                      {v.name}
                                    </div>
                                  );
                                })
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  }}
                />
              </div>

              {/* Loại hình thu phí */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                  Loại hình thu phí <span className="text-red-500">*</span>
                </label>
                {lockedFeeType && (
                  <div className="text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100 mb-2 flex items-start gap-2">
                    <Lock size={12} className="shrink-0 mt-0.5" />
                    <span>
                      Tòa nhà này đã có bảng giá <b>{FEE_TYPE_LABELS[lockedFeeType]}</b>. Loại hình
                      thu phí phải thống nhất.
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {FEE_TYPE_OPTIONS.map(([val, label]) => (
                    <Controller
                      key={val}
                      control={control}
                      name="uiFeeType"
                      render={({ field }) => (
                        <label
                          className={`flex items-center gap-2.5 border rounded-xl px-4 py-2.5 transition-all text-sm font-semibold ${
                            lockedFeeType && lockedFeeType !== val
                              ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed opacity-50'
                              : field.value === val
                                ? 'border-[#062F28] bg-[#9FE870]/20 text-[#062F28] ring-1 ring-[#062F28] shadow-sm cursor-pointer'
                                : errors.uiFeeType
                                  ? 'border-red-400 focus:ring-red-300 bg-red-50/30 text-gray-600 cursor-pointer'
                                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-[#9FE870]/50 hover:bg-white cursor-pointer'
                          }`}
                        >
                          <input
                            type="radio"
                            className="w-4 h-4 accent-[#062F28]"
                            value={val}
                            checked={field.value === val}
                            disabled={
                              (!!lockedFeeType && lockedFeeType !== val) || hasActiveSessions
                            }
                            onChange={() => field.onChange(val)}
                          />
                          {label}
                          {lockedFeeType && lockedFeeType === val && (
                            <Lock size={12} className="text-blue-500 ml-auto" />
                          )}
                        </label>
                      )}
                    />
                  ))}
                </div>
                {errors.uiFeeType && (
                  <p className={errCls}>
                    <span>⚠</span> {errors.uiFeeType.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── BƯỚC 2: CÀI ĐẶT NÂNG CAO ────────────────────────────── */}
          <div className={step === 2 ? 'block flex-1 bg-white px-6 py-6' : 'hidden'}>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
                Phụ phí &amp; Cài đặt nâng cao
              </p>
              {currentUiFeeType ? (
                <div className="grid grid-cols-2 gap-4">
                  {/* Grace period */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                        Miễn phí (Phút)
                      </label>
                      {errors.gracePeriodMinutes && (
                        <span className="text-[11px] font-bold text-red-500 flex items-center gap-1">
                          <span>⚠</span> {errors.gracePeriodMinutes.message}
                        </span>
                      )}
                    </div>
                    <input
                      {...register('gracePeriodMinutes')}
                      type="number"
                      min="0"
                      max="60"
                      onKeyDown={handleNumberKeyDown}
                      className={`${getInputCls(!!errors.gracePeriodMinutes)} ${hasActiveSessions ? 'opacity-70 bg-gray-50' : ''}`}
                      placeholder="0"
                      readOnly={hasActiveSessions}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">X phút đầu miễn phí</p>
                  </div>

                  {/* Lost card fee */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block flex items-center gap-1">
                        <CreditCard size={13} /> Phí mất thẻ (VNĐ)
                      </label>
                      {errors.lostCardFee && (
                        <span className="text-[11px] font-bold text-red-500 flex items-center gap-1">
                          <span>⚠</span> {errors.lostCardFee.message}
                        </span>
                      )}
                    </div>
                    <input
                      {...register('lostCardFee')}
                      type="number"
                      min="0"
                      onKeyDown={handleNumberKeyDown}
                      className={`${getInputCls(!!errors.lostCardFee)} ${hasActiveSessions ? 'opacity-70 bg-gray-50' : ''}`}
                      placeholder="50000"
                      readOnly={hasActiveSessions}
                    />
                  </div>

                  {/* First block hours: Hourly only */}
                  {currentUiFeeType === 'hourly' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                          Giờ tính mức đầu
                        </label>
                        {errors.firstBlockHours && (
                          <span className="text-[11px] font-bold text-red-500 flex items-center gap-1">
                            <span>⚠</span> {errors.firstBlockHours.message}
                          </span>
                        )}
                      </div>
                      <input
                        {...register('firstBlockHours')}
                        type="number"
                        min="1"
                        onKeyDown={handleNumberKeyDown}
                        className={`${getInputCls(!!errors.firstBlockHours)} ${hasActiveSessions ? 'opacity-70 bg-gray-50' : ''}`}
                        placeholder="1"
                        readOnly={hasActiveSessions}
                      />
                      <p className="text-[10px] text-gray-400 mt-1">
                        Số giờ đầu tiên áp dụng mức giá 'Giờ đầu'
                      </p>
                    </div>
                  )}

                  {/* Max daily fee */}
                  {(currentUiFeeType === 'hourly' || currentUiFeeType === 'time_window') && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                          Phí tối đa/Ngày (VNĐ)
                        </label>
                        {errors.maxDailyFee && (
                          <span className="text-[11px] font-bold text-red-500 flex items-center gap-1">
                            <span>⚠</span> {errors.maxDailyFee.message}
                          </span>
                        )}
                      </div>
                      <input
                        {...register('maxDailyFee')}
                        type="number"
                        min="0"
                        onKeyDown={handleNumberKeyDown}
                        className={`${getInputCls(!!errors.maxDailyFee)} ${hasActiveSessions ? 'opacity-70 bg-gray-50' : ''}`}
                        placeholder="0"
                        readOnly={hasActiveSessions}
                      />
                      <p className="text-[10px] text-gray-400 mt-1">0 = Không giới hạn</p>
                    </div>
                  )}

                  {/* Overnight fee */}
                  {(currentUiFeeType === 'per_turn' || currentUiFeeType === 'hourly') && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block flex items-center gap-1">
                          <Moon size={13} /> Phí qua đêm (VNĐ)
                        </label>
                        {errors.overnightFee && (
                          <span className="text-[11px] font-bold text-red-500 flex items-center gap-1">
                            <span>⚠</span> {errors.overnightFee.message}
                          </span>
                        )}
                      </div>
                      <input
                        {...register('overnightFee')}
                        type="number"
                        min="0"
                        onKeyDown={handleNumberKeyDown}
                        className={`${getInputCls(!!errors.overnightFee)} ${hasActiveSessions ? 'opacity-70 bg-gray-50' : ''}`}
                        placeholder="0"
                        readOnly={hasActiveSessions}
                      />
                    </div>
                  )}

                  {/* Overtime fee */}
                  {(currentUiFeeType === 'time_window' || currentUiFeeType === 'hourly') && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block flex items-center gap-1">
                          <Clock size={13} /> Phí quá giờ (VNĐ/h)
                        </label>
                        {errors.overtimeFeePerHour && (
                          <span className="text-[11px] font-bold text-red-500 flex items-center gap-1">
                            <span>⚠</span> {errors.overtimeFeePerHour.message}
                          </span>
                        )}
                      </div>
                      <input
                        {...register('overtimeFeePerHour')}
                        type="number"
                        min="0"
                        onKeyDown={handleNumberKeyDown}
                        className={`${getInputCls(!!errors.overtimeFeePerHour)} ${hasActiveSessions ? 'opacity-70 bg-gray-50' : ''}`}
                        placeholder="0"
                        readOnly={hasActiveSessions}
                      />
                      <p className="text-[10px] text-gray-400 mt-1">
                        {currentUiFeeType === 'hourly' ? 'Khi đỗ quá 24h' : 'Ngoài khung hoạt động'}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full min-h-[160px] border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center justify-center p-6 text-center">
                  <AlertTriangle className="w-6 h-6 text-gray-200 mb-2" />
                  <p className="text-sm font-semibold text-gray-400">Chọn loại hình thu phí</p>
                  <p className="text-xs text-gray-300 mt-1">ở Bước 1 để thiết lập phụ phí</p>
                </div>
              )}
            </div>
          </div>

          {/* ── BƯỚC 3: CẤU HÌNH MỨC GIÁ ─────────── */}
          <div className={step === 3 ? 'block flex-1 bg-white px-6 py-8' : 'hidden'}>
            {currentUiFeeType && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    Cấu hình mức giá <span className="text-red-500">*</span>
                  </p>
                  {currentUiFeeType === 'time_window' && (
                    <button
                      type="button"
                      onClick={() =>
                        append({ label: '', amount: 0, unit: 'giờ', startTime: '', endTime: '' })
                      }
                      disabled={hasActiveSessions}
                      className={`text-xs font-bold text-[#062F28] hover:bg-[#9FE870]/20 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors border border-[#9FE870]/40 ${hasActiveSessions ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <Plus size={13} /> Thêm Khung Giờ
                    </button>
                  )}
                </div>

                {currentUiFeeType === 'time_window' && (
                  <div className="text-xs text-blue-700 bg-blue-50 px-3 py-2.5 rounded-xl border border-blue-100 mb-4 flex items-start gap-2">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    <span>
                      Các khung giờ <b>phải nối tiếp nhau và phủ kín toàn bộ thời gian hoạt động</b>{' '}
                      của tòa nhà
                      {currentFacility
                        ? ` (${currentFacility.openTime} – ${currentFacility.closeTime})`
                        : ''}
                      . Ngoài khung sẽ tính theo phí quá giờ.
                    </span>
                  </div>
                )}

                <div
                  className={`grid gap-5 ${currentUiFeeType === 'hourly' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}
                >
                  {fields.map((fld, idx) => (
                    <div
                      key={fld.id}
                      className={`relative ${
                        currentUiFeeType === 'per_turn'
                          ? 'p-6'
                          : 'bg-white border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-[20px] p-6'
                      }`}
                    >
                      {fields.length > 1 && currentUiFeeType === 'time_window' && (
                        <button
                          type="button"
                          onClick={() => remove(idx)}
                          className="absolute top-2 right-2 text-gray-300 hover:text-red-400 hover:bg-red-50 p-1 rounded-lg transition-all"
                        >
                          <X size={13} />
                        </button>
                      )}

                      {currentUiFeeType === 'time_window' && (
                        <div className="mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1">
                              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                                Từ giờ <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="time"
                                {...register(`rates.${idx}.startTime`)}
                                readOnly={hasActiveSessions}
                                className={`${getInputCls(!!errors.rates?.[idx]?.startTime, 'py-2 text-[15px] font-semibold text-[#062F28]')} ${hasActiveSessions ? 'opacity-70 bg-gray-50' : ''}`}
                              />
                              {errors.rates?.[idx]?.startTime && (
                                <p className={errCls}>
                                  <span>⚠</span> {errors.rates[idx]!.startTime!.message}
                                </p>
                              )}
                            </div>
                            <span className="text-gray-300 mt-4">–</span>
                            <div className="flex-1">
                              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                                Đến giờ <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="time"
                                {...register(`rates.${idx}.endTime`)}
                                readOnly={hasActiveSessions}
                                className={`${getInputCls(!!errors.rates?.[idx]?.endTime, 'py-2 text-[15px] font-semibold text-[#062F28]')} ${hasActiveSessions ? 'opacity-70 bg-gray-50' : ''}`}
                              />
                              {errors.rates?.[idx]?.endTime && (
                                <p className={errCls}>
                                  <span>⚠</span> {errors.rates[idx]!.endTime!.message}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          {!hasActiveSessions && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {currentFacility && currentFacility.openTime && currentFacility.closeTime && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setValue(`rates.${idx}.startTime`, currentFacility.openTime);
                                    setValue(`rates.${idx}.endTime`, currentFacility.closeTime);
                                    trigger(`rates.${idx}.startTime`);
                                    trigger(`rates.${idx}.endTime`);
                                  }}
                                  className="text-[10px] font-semibold px-2 py-1.5 rounded-md bg-[#9FE870]/20 text-[#062F28] hover:bg-[#9FE870]/40 transition-colors border border-[#9FE870]/30"
                                >
                                  Giờ HĐ toà nhà
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setValue(`rates.${idx}.startTime`, '00:00');
                                  setValue(`rates.${idx}.endTime`, '23:59');
                                  trigger(`rates.${idx}.startTime`);
                                  trigger(`rates.${idx}.endTime`);
                                }}
                                className="text-[10px] font-semibold px-2 py-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors border border-gray-200"
                              >
                                Cả ngày (24h)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setValue(`rates.${idx}.startTime`, '06:00');
                                  setValue(`rates.${idx}.endTime`, '18:00');
                                  trigger(`rates.${idx}.startTime`);
                                  trigger(`rates.${idx}.endTime`);
                                }}
                                className="text-[10px] font-semibold px-2 py-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors border border-gray-200"
                              >
                                Ngày (06:00-18:00)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setValue(`rates.${idx}.startTime`, '18:00');
                                  setValue(`rates.${idx}.endTime`, '06:00');
                                  trigger(`rates.${idx}.startTime`);
                                  trigger(`rates.${idx}.endTime`);
                                }}
                                className="text-[10px] font-semibold px-2 py-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors border border-gray-200"
                              >
                                Đêm (18:00-06:00)
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mb-3">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                          Tên <span className="text-red-500">*</span>
                        </label>
                        <input
                          {...register(`rates.${idx}.label`)}
                          placeholder={
                            currentUiFeeType === 'hourly'
                              ? idx === 0
                                ? 'Giờ đầu'
                                : 'Giờ tiếp theo'
                              : currentUiFeeType === 'per_turn'
                                ? 'Mỗi lượt'
                                : 'Khung giờ'
                          }
                          className={`${getInputCls(!!errors.rates?.[idx]?.label, 'py-2 text-[15px] font-bold text-[#062F28]')} ${hasActiveSessions ? 'opacity-70 bg-gray-50' : ''}`}
                          readOnly={hasActiveSessions}
                        />
                        {errors.rates?.[idx]?.label && (
                          <p className={errCls}>
                            <span>⚠</span> {errors.rates[idx]!.label!.message}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                            Đơn giá (VNĐ) <span className="text-red-500">*</span>
                          </label>
                          <input
                            {...register(`rates.${idx}.amount`)}
                            type="number"
                            min="0"
                            placeholder="0"
                            onKeyDown={handleNumberKeyDown}
                            readOnly={hasActiveSessions}
                            className={`${getInputCls(!!errors.rates?.[idx]?.amount, 'text-[16px] text-[#062F28]')} ${hasActiveSessions ? 'opacity-70 bg-gray-50' : ''}`}
                          />
                        </div>
                        {errors.rates?.[idx]?.amount && (
                          <p className={errCls}>
                            <span>⚠</span> {errors.rates[idx]!.amount!.message}
                          </p>
                        )}
                        <div className="w-16">
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                            Đơn vị
                          </label>
                          <input
                            {...register(`rates.${idx}.unit`)}
                            readOnly
                            className={`${getInputCls(false, 'text-[15px] font-bold')} bg-gray-50 text-gray-500 cursor-not-allowed text-center border-gray-100`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {errors.rates?.root && (
                  <p className={errCls}>
                    <span>⚠</span> {errors.rates.root.message}
                  </p>
                )}
              </div>
            )}
            {!currentUiFeeType && (
              <div className="flex items-center justify-center h-full min-h-[200px]">
                <p className="text-gray-400">Vui lòng chọn loại hình thu phí ở Bước 1.</p>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50/80 border-t border-gray-100 flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={step === 1 ? onClose : () => setStep(step - 1)}
            disabled={isSubmitting}
            className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {step === 1 ? 'Hủy Bỏ' : 'Quay Lại'}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 text-sm font-bold text-[#062F28] bg-[#9FE870] rounded-xl hover:bg-[#9FE870]/90 transition-colors shadow-sm flex items-center gap-2"
            >
              Tiếp Tục
            </button>
          ) : (
            <button
              type="submit"
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              className="px-6 py-2.5 text-sm font-bold text-[#062F28] bg-[#9FE870] rounded-xl hover:bg-[#9FE870]/90 transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Lưu Thay Đổi' : 'Hoàn Tất'}
            </button>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
