import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { X, Loader2, Building2, Layers, ChevronDown } from 'lucide-react';
import {
  vehicleTypeService,
  VehicleType,
  CreateVehicleTypePayload,
  UpdateVehicleTypePayload,
} from '../../../../services/vehicleType.service';
import { facilityService, Facility } from '../../../../services/facility.service';
import { floorService, Floor } from '../../../../services/floor.service';
import { ICON_OPTIONS } from './constants';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuthStore } from '../../../../store/useAuthStore';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle?: VehicleType;
  onSuccess: () => void;
}

interface FormErrors {
  name?: string;
  code?: string;

  icon?: string;
}

export function VehicleFormModal({ isOpen, onClose, vehicle, onSuccess }: ModalProps) {
  const { user } = useAuthStore();
  const isEdit = !!vehicle;
  const DEFAULT_CODES = ['XEOTODIEN', 'XEMAYDIEN', 'XEOTO', 'XEMAY', 'XEDAP'];
  const isDefaultType = isEdit && DEFAULT_CODES.includes(vehicle!.code.toUpperCase());
  const [form, setForm] = useState<CreateVehicleTypePayload>({
    name: '',
    code: '',
    description: '',
    icon: '',
    requiresPlate: true,
    floors: [],
  });
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [floorsList, setFloorsList] = useState<Floor[]>([]);
  const [, setIsLoadingFacilities] = useState(false);
  const [selectedFacId, setSelectedFacId] = useState<string>('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFacOpen, setIsFacOpen] = useState(false);
  const [isFloorOpen, setIsFloorOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setErrors({});
      fetchFacilities();
      if (vehicle) {
        setForm({
          name: vehicle.name,
          code: vehicle.code,
          description: vehicle.description || '',
          icon: vehicle.icon || '',
          requiresPlate: vehicle.requiresPlate !== false,
          floors: vehicle.floors ? vehicle.floors.map((f) => f._id) : [],
        });
      } else {
        setForm({
          name: '',
          code: '',
          description: '',
          icon: '',
          requiresPlate: true,
          floors: [],
        });
      }
    }
  }, [isOpen, vehicle]);

  const fetchFacilities = async () => {
    setIsLoadingFacilities(true);
    try {
      const [facRes, floorRes] = await Promise.all([
        facilityService.getAll({ limit: 1000 }),
        floorService.getAll({ limit: 1000 }),
      ]);

      let filteredFacilities = facRes.data;
      if (user?.role === 'manager') {
        const assignedFacIds = (user.assignedFacilities || []).map((f: any) =>
          typeof f === 'string' ? f : f._id
        );
        filteredFacilities = filteredFacilities.filter((fac: Facility) =>
          assignedFacIds.includes(fac._id)
        );
      }
      setFacilities(filteredFacilities);
      setFloorsList(floorRes.data);

      if (vehicle) {
        const linkedFloorIds = floorRes.data
          .filter((fl: Floor) =>
            fl.allowedVehicleTypes.some(
              (vt: any) => (typeof vt === 'string' ? vt : vt._id) === vehicle._id
            )
          )
          .map((fl: Floor) => fl._id);
        setForm((f) => ({ ...f, floors: linkedFloorIds }));
      }
    } catch (err) {
      toast.error('Lỗi khi tải danh sách tòa nhà');
    } finally {
      setIsLoadingFacilities(false);
    }
  };

  const availableFloors = selectedFacId
    ? floorsList.filter((fl) => {
        const flFacId =
          typeof fl.facilityId === 'object' ? (fl.facilityId as any)._id : fl.facilityId;
        return flFacId === selectedFacId;
      })
    : [];

  const toggleFloor = (floorId: string) => {
    setForm((f) => {
      const floors = f.floors || [];
      if (floors.includes(floorId)) {
        return { ...f, floors: floors.filter((id) => id !== floorId) };
      }
      return { ...f, floors: [...floors, floorId] };
    });
  };

  const toggleAllFloorsInFacility = (facId: string) => {
    const facilityFloorIds = floorsList
      .filter((fl) => {
        const flFacId =
          typeof fl.facilityId === 'object' ? (fl.facilityId as any)._id : fl.facilityId;
        return flFacId === facId;
      })
      .map((fl) => fl._id);

    if (facilityFloorIds.length === 0) return;

    const allSelected = facilityFloorIds.every((id) => (form.floors || []).includes(id));

    setForm((f) => {
      let currentFloors = f.floors || [];
      if (allSelected) {
        currentFloors = currentFloors.filter((id) => !facilityFloorIds.includes(id));
      } else {
        currentFloors = Array.from(new Set([...currentFloors, ...facilityFloorIds]));
      }
      return { ...f, floors: currentFloors };
    });
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.name.trim()) newErrors.name = 'Vui lòng nhập tên loại xe';
    if (!isEdit && !form.code.trim()) newErrors.code = 'Vui lòng nhập mã loại xe';

    if (!form.icon) newErrors.icon = 'Vui lòng chọn biểu tượng';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      if (isEdit && vehicle) {
        // Loại xe mặc định chỉ được sửa requiresPlate và floors
        const payload: UpdateVehicleTypePayload = isDefaultType
          ? { floors: form.floors }
          : {
              name: form.name,
              code: form.code,
              description: form.description,
              icon: form.icon,
              requiresPlate: form.requiresPlate,
              floors: form.floors,
            };
        await vehicleTypeService.update(vehicle._id, payload);
        toast.success('Cập nhật loại xe thành công');
      } else {
        await vehicleTypeService.create(form);
        toast.success('Tạo loại xe mới thành công');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Đã xảy ra lỗi');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clear error on field change
  const setName = (val: string) => {
    setForm((f) => ({ ...f, name: val }));
    if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
  };
  const setCode = (val: string) => {
    setForm((f) => ({ ...f, code: val.toUpperCase() }));
    if (errors.code) setErrors((e) => ({ ...e, code: undefined }));
  };

  const inputBase =
    'w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all';
  const inputOk = 'border-gray-200 focus:ring-[#9FE870]';
  const inputErr = 'border-red-400 focus:ring-red-300 bg-red-50/30';

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-lg font-bold text-[#062F28]">
                  {isEdit ? 'Chỉnh Sửa Loại Xe' : 'Thêm Loại Xe Mới'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isEdit ? 'Cập nhật thông tin loại phương tiện' : 'Tạo mới danh mục phương tiện'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="p-6 overflow-y-auto flex-1 space-y-4"
            >
              {isDefaultType && (
                <div className="bg-blue-50 text-blue-700 text-sm p-3 rounded-xl border border-blue-100 flex items-start gap-2 mb-2">
                  <span className="font-semibold whitespace-nowrap mt-0.5">Lưu ý:</span>
                  <span>Đây là loại xe mặc định. Bạn chỉ có thể sửa cấu hình tầng đỗ.</span>
                </div>
              )}
              {/* Icon picker */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Biểu Tượng <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {ICON_OPTIONS.map(({ name, label, Icon }) => {
                    const isSelected = form.icon === name;
                    const isDefault = isDefaultType;
                    return (
                      <button
                        key={name}
                        type="button"
                        title={label}
                        disabled={isDefault}
                        onClick={() => {
                          setForm({ ...form, icon: name });
                          setErrors((e) => ({ ...e, icon: undefined }));
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
                          isSelected
                            ? 'border-[#9FE870] bg-[#9FE870]/15 text-[#062F28] shadow-sm'
                            : 'border-gray-200 text-gray-500 hover:border-[#9FE870]/50 hover:bg-[#9FE870]/5 hover:text-[#062F28]'
                        } ${isDefault && !isSelected ? 'opacity-50 cursor-not-allowed' : ''} ${isDefault && isSelected ? 'cursor-not-allowed' : ''}`}
                      >
                        <Icon size={18} strokeWidth={1.5} className="shrink-0" />
                        <span className="text-xs font-semibold whitespace-nowrap">{label}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.icon && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <span>⚠</span> {errors.icon}
                  </p>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Tên Loại Xe <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={isDefaultType}
                  value={form.name}
                  onChange={(e) => setName(e.target.value)}
                  className={`${inputBase} ${errors.name ? inputErr : inputOk} disabled:opacity-60 disabled:cursor-not-allowed`}
                  placeholder="Xe máy, Ô tô, Xe đạp"
                />
                {errors.name && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <span>⚠</span> {errors.name}
                  </p>
                )}
              </div>

              {/* Code */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Mã Loại Xe <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={isEdit}
                  value={form.code}
                  onChange={(e) => setCode(e.target.value)}
                  className={`${inputBase} ${errors.code ? inputErr : inputOk} disabled:opacity-60 disabled:cursor-not-allowed uppercase`}
                  placeholder="MOTORBIKE, CAR, BICYCLE"
                />
                {errors.code && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <span>⚠</span> {errors.code}
                  </p>
                )}
                {!isEdit && !errors.code && (
                  <p className="text-xs text-gray-400 mt-1">Mã không thể thay đổi sau khi tạo</p>
                )}
              </div>

              {/* Requires Plate Toggle */}
              <div>
                <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Yêu cầu Biển số</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {form.requiresPlate !== false
                        ? 'Loại xe này cần quét biển số khi vào/ra'
                        : 'Xe không cần biển số (VD: xe đạp) — dùng ảnh đối chiếu'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isDefaultType}
                    onClick={() => setForm((f) => ({ ...f, requiresPlate: !f.requiresPlate }))}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                      form.requiresPlate !== false ? 'bg-[#8bc34a]' : 'bg-gray-300'
                    } ${isDefaultType ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                        form.requiresPlate !== false ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Facilities & Floors */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tòa Nhà & Tầng Hỗ Trợ
                </label>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    {/* Facility Select */}
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                        <Building2 size={16} className="text-gray-500" />
                      </div>
                      <div
                        onClick={() => {
                          setIsFacOpen(!isFacOpen);
                          setIsFloorOpen(false);
                        }}
                        className={`w-full pl-9 pr-12 py-2 bg-white border rounded-xl text-sm transition-all cursor-pointer flex items-center justify-between shadow-sm relative z-10
                        ${isFacOpen ? 'border-transparent ring-2 ring-[#9FE870]' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        <span
                          className={
                            selectedFacId
                              ? 'font-medium text-gray-700 truncate'
                              : 'text-gray-500 font-medium'
                          }
                        >
                          {selectedFacId
                            ? facilities.find((f) => f._id === selectedFacId)?.name
                            : 'Chọn tòa nhà'}
                        </span>
                      </div>
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1 z-20">
                        {selectedFacId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFacId('');
                              setIsFacOpen(false);
                              setIsFloorOpen(false);
                            }}
                            className="text-gray-400 hover:text-red-500 p-0.5 rounded-full transition-colors"
                          >
                            <X size={14} />
                          </button>
                        )}
                        <ChevronDown
                          size={16}
                          className={`text-gray-400 pointer-events-none transition-transform ${isFacOpen ? 'rotate-180' : ''}`}
                        />
                      </div>

                      <AnimatePresence>
                        {isFacOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setIsFacOpen(false)}
                            />
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              transition={{ duration: 0.15 }}
                              className="absolute top-[calc(100%+8px)] left-0 w-full bg-white border border-gray-100 rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] pb-2 z-50 max-h-40 overflow-y-auto overflow-x-hidden custom-scrollbar"
                            >
                              <div className="px-3 pt-2.5 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                                Danh Sách Tòa Nhà
                              </div>
                              {facilities
                                .filter((fac) =>
                                  floorsList.some((fl) => {
                                    const flFacId =
                                      typeof fl.facilityId === 'object'
                                        ? (fl.facilityId as any)._id
                                        : fl.facilityId;
                                    return flFacId === fac._id;
                                  })
                                )
                                .map((fac) => (
                                  <div
                                    key={fac._id}
                                    onClick={() => {
                                      setSelectedFacId(fac._id);
                                      setIsFacOpen(false);
                                    }}
                                    className={`px-4 py-2 text-sm cursor-pointer transition-colors flex items-center gap-2 whitespace-normal break-words ${selectedFacId === fac._id ? 'bg-[#9FE870]/20 text-[#062F28] font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                                  >
                                    {fac.name}
                                  </div>
                                ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Floor Select */}
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                        <Layers size={16} className="text-gray-500" />
                      </div>
                      <div
                        onClick={() => {
                          if (availableFloors.length > 0) {
                            setIsFloorOpen(!isFloorOpen);
                            setIsFacOpen(false);
                          }
                        }}
                        className={`w-full pl-9 pr-8 py-2 bg-white border rounded-xl text-sm transition-all flex items-center justify-between shadow-sm relative z-10
                        ${availableFloors.length === 0 ? 'opacity-50 cursor-not-allowed border-gray-200' : 'cursor-pointer hover:bg-gray-50'}
                        ${isFloorOpen ? 'border-transparent ring-2 ring-[#9FE870]' : 'border-gray-200'}`}
                      >
                        <span className="text-gray-500 font-medium">Thêm tầng...</span>
                      </div>
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none z-10">
                        <ChevronDown
                          size={16}
                          className={`text-gray-400 transition-transform ${isFloorOpen ? 'rotate-180' : ''}`}
                        />
                      </div>

                      <AnimatePresence>
                        {isFloorOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setIsFloorOpen(false)}
                            />
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              transition={{ duration: 0.15 }}
                              className="absolute top-[calc(100%+8px)] left-0 w-full bg-white border border-gray-100 rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] pb-2 z-50 max-h-40 overflow-y-auto overflow-x-hidden custom-scrollbar"
                            >
                              <div className="px-3 pt-2.5 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                                Danh Sách Tầng
                              </div>
                              {availableFloors.length === 0 && (
                                <div className="px-4 py-2 text-sm text-gray-400">
                                  Không có tầng nào
                                </div>
                              )}
                              {availableFloors.map((fl) => {
                                const isSelected = form.floors?.includes(fl._id);
                                return (
                                  <div
                                    key={fl._id}
                                    onClick={() => {
                                      if (!isSelected) {
                                        setForm((f) => ({
                                          ...f,
                                          floors: [...(f.floors || []), fl._id],
                                        }));
                                        setIsFloorOpen(false);
                                      }
                                    }}
                                    className={`px-4 py-2 text-sm transition-colors flex items-center justify-between whitespace-normal break-words
                                    ${isSelected ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'cursor-pointer text-gray-600 hover:bg-[#9FE870]/20 hover:text-[#062F28] hover:font-medium'}`}
                                  >
                                    {fl.name}
                                    {isSelected && (
                                      <span className="text-xs font-semibold text-gray-400 shrink-0 ml-2">
                                        Đã chọn
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Selected Floors Chips */}
                  {form.floors && form.floors.length > 0 ? (
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 min-h-[60px]">
                      {form.floors.map((floorId) => {
                        const fl = floorsList.find((f) => f._id === floorId);
                        const fac = facilities.find(
                          (f) =>
                            f._id ===
                            (typeof fl?.facilityId === 'object'
                              ? (fl.facilityId as any)._id
                              : fl?.facilityId)
                        );
                        if (!fl) return null;
                        return (
                          <div
                            key={floorId}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm shadow-sm hover:border-red-200 hover:shadow-md transition-all group"
                          >
                            <span className="font-medium text-gray-700">{fac?.name}</span>
                            <span className="text-gray-300 text-xs">/</span>
                            <span className="text-emerald-600 font-semibold">{fl.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setForm((f) => ({
                                  ...f,
                                  floors: (f.floors || []).filter((id) => id !== floorId),
                                }));
                                if (fac && selectedFacId === fac._id) {
                                  setSelectedFacId('');
                                  setIsFloorOpen(false);
                                }
                              }}
                              className="ml-1 text-gray-300 group-hover:text-red-500 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mô Tả</label>
                <textarea
                  rows={2}
                  disabled={isDefaultType}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={`${inputBase} ${inputOk} resize-none disabled:opacity-60 disabled:cursor-not-allowed`}
                  placeholder="Mô tả ngắn về loại xe..."
                />
              </div>

              {/* Footer */}
              <div className="pt-2 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-60"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-sm font-bold text-[#062F28] bg-[#9FE870] rounded-xl hover:bg-[#9FE870]/80 transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  {isEdit ? 'Lưu Thay Đổi' : 'Tạo Loại Xe'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
