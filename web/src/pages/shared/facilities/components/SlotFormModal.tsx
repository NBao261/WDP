import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { X, Loader2, Check } from 'lucide-react';
import { ICON_MAP, DEFAULT_ICON } from '../../../shared/vehicles/components/constants';
import { slotService } from '../../../../services/slot.service';
import { VehicleType } from '../../../../services/vehicleType.service';

interface SlotFormModalProps {
  facilityId: string;
  floorId: string;
  vehicleTypes: VehicleType[];
  totalSlots?: number;
  currentSlotCount?: number;
  singleOnly?: boolean;
  existingSlots?: { _id: string; code: string; vehicleTypeId: string }[];
  onClose: () => void;
  onSuccess: () => void;
}

export function SlotFormModal({
  facilityId,
  floorId,
  vehicleTypes,
  totalSlots,
  currentSlotCount,
  singleOnly = false,
  existingSlots = [],
  onClose,
  onSuccess,
}: SlotFormModalProps) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [loading, setLoading] = useState(false);
  const [vehicleType, setVehicleType] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [originalPrefix, setOriginalPrefix] = useState<string>('');

  const handleNumberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
      e.preventDefault();
    }
  };

  useEffect(() => {
    if (!vehicleType || mode !== 'bulk') {
      setOriginalPrefix('');
      return;
    }
    const vtSlots = existingSlots.filter((s) => s.vehicleTypeId === vehicleType);
    if (vtSlots.length > 0) {
      const match = vtSlots[0].code.match(/^([A-Za-z]+)/);
      if (match) {
        setPrefix(match[1]);
        setOriginalPrefix(match[1]);
        let maxNum = 0;
        vtSlots.forEach((s) => {
          const numPart = s.code.replace(match[1], '');
          const num = parseInt(numPart, 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        });
        setStartNumber(maxNum + 1);
      }
    }
  }, [vehicleType, mode, existingSlots]);

  useEffect(() => {
    if (
      vehicleTypes.length > 0 &&
      vehicleType &&
      !vehicleTypes.some((vt) => vt._id === vehicleType)
    ) {
      setVehicleType('');
    }
  }, [vehicleTypes, vehicleType]);

  // Single
  const [code, setCode] = useState('');

  // Bulk
  const [prefix, setPrefix] = useState('');
  const [startNumber, setStartNumber] = useState<number | string>('');
  const [count, setCount] = useState<number | string>('');

  // Auto-fill code khi chọn loại xe (mode single)
  useEffect(() => {
    if (!vehicleType || mode !== 'single') return;
    const vtSlots = existingSlots.filter((s) => s.vehicleTypeId === vehicleType);
    const vt = vehicleTypes.find((v) => v._id === vehicleType);
    if (!vt) return;
    // Tìm prefix từ existing slots hoặc dùng tên loại xe viết hoa không dấu
    let codePrefix = '';
    if (vtSlots.length > 0) {
      const match = vtSlots[0].code.match(/^([A-Za-z]+)/);
      if (match) codePrefix = match[1];
    }
    if (!codePrefix) {
      codePrefix = vt.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .replace(/\s+/g, '')
        .toUpperCase();
    }
    let maxNum = 0;
    vtSlots.forEach((s) => {
      const numPart = s.code.replace(/^[A-Za-z]+/, '');
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    });
    setCode(`${codePrefix}${maxNum + 1}`);
  }, [vehicleType, mode, existingSlots, vehicleTypes]);

  // Compute slot info per vehicle type from existing slots
  const vtSlotInfo = useMemo(() => {
    const map: Record<string, { codes: string[]; count: number }> = {};
    existingSlots.forEach((s) => {
      const vtId = s.vehicleTypeId;
      if (!map[vtId]) map[vtId] = { codes: [], count: 0 };
      map[vtId].codes.push(s.code);
      map[vtId].count++;
    });
    // Sort codes naturally
    Object.values(map).forEach((g) =>
      g.codes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    );
    return map;
  }, [existingSlots]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!vehicleType) newErrors.vehicleType = 'Vui lòng chọn loại xe';

    if (mode === 'single') {
      if (!code.trim()) {
        newErrors.code = 'Vui lòng nhập mã slot';
      } else if (existingSlots.some((s) => s.code === code.trim().toUpperCase())) {
        newErrors.code = 'Mã vị trí này đã tồn tại';
      }
    } else {
      if (!prefix.trim()) newErrors.prefix = 'Vui lòng nhập tiền tố';
      if (!startNumber) newErrors.startNumber = 'Vui lòng nhập số bắt đầu';
      if (!count) newErrors.count = 'Vui lòng nhập số lượng';

      if (prefix && startNumber && count) {
        const numStart = Number(startNumber);
        const numCount = Number(count);
        const pfx = prefix.toUpperCase();
        const duplicates: string[] = [];
        for (let i = 0; i < numCount; i++) {
          const generatedCode = `${pfx}${numStart + i}`;
          if (existingSlots.some((s) => s.code === generatedCode)) {
            duplicates.push(generatedCode);
          }
        }
        if (duplicates.length > 0) {
          const dupesStr = duplicates.slice(0, 3).join(', ') + (duplicates.length > 3 ? '...' : '');
          newErrors.prefix = `Các mã sau đã tồn tại: ${dupesStr}`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === 'single') {
        if (!code.trim()) {
          toast.error('Vui lòng nhập mã slot');
          return;
        }
        await slotService.create({
          facilityId,
          floorId,
          vehicleTypeId: vehicleType,
          code: code.toUpperCase(),
        });
        toast.success(`Đã tạo slot ${code}`);
      } else {
        const numStart = Number(startNumber);
        const numCount = Number(count);
        const newPrefix = prefix.toUpperCase();

        if (originalPrefix && originalPrefix !== newPrefix) {
          const vtSlots = existingSlots.filter(
            (s) => s.vehicleTypeId === vehicleType && s.code.startsWith(originalPrefix)
          );
          for (const slot of vtSlots) {
            const newCode = slot.code.replace(originalPrefix, newPrefix);
            await slotService.update(slot._id, { code: newCode });
          }
        }

        const res = await slotService.createBulk({
          facilityId,
          floorId,
          vehicleType,
          prefix: newPrefix,
          startNumber: numStart,
          count: numCount,
        });
        toast.success(`Đã tạo ${(res as any).data.length ?? numCount} slot`);
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Tạo slot thất bại');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-[#062F28]">Gán Xe</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {singleOnly ? 'Gán loại xe cho vị trí trống' : 'Gán xe cho các vị trí mới'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col justify-between">
          <div className="space-y-4">
            {!singleOnly && (
              <div className="flex bg-gray-100 p-1 rounded-xl mb-2 mt-2">
                <button
                  onClick={() => {
                    setMode('single');
                    setErrors({});
                  }}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${mode === 'single' ? 'bg-[#9FE870] shadow-sm text-[#062F28]' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Gán 1 Vị Trí
                </button>
                <button
                  onClick={() => {
                    setMode('bulk');
                    setErrors({});
                  }}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${mode === 'bulk' ? 'bg-[#9FE870] shadow-sm text-[#062F28]' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Gán Nhiều Vị Trí
                </button>
              </div>
            )}

            {totalSlots !== undefined && currentSlotCount !== undefined && (
              <div
                className={`flex items-center gap-2 text-sm font-medium ${
                  currentSlotCount >= totalSlots
                    ? 'text-red-600'
                    : totalSlots - currentSlotCount <= 5
                      ? 'text-amber-600'
                      : 'text-[#062F28]'
                }`}
              >
                <span>Sức chứa tầng:</span>
                <span className="font-semibold">
                  {currentSlotCount} / {totalSlots} vị trí{' '}
                  {currentSlotCount >= totalSlots
                    ? '— Đã đầy'
                    : `(còn ${totalSlots - currentSlotCount})`}
                </span>
              </div>
            )}

            {/* Vehicle Type Selection — FIRST */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  Loại Xe <span className="text-red-500">*</span>
                </label>

                {vehicleTypes.length === 0 ? (
                  <p className="text-xs text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">
                    Tầng này chưa được cấu hình loại xe cho phép. Vui lòng cấu hình ở phần chỉnh sửa
                    tầng trước.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {vehicleTypes.map((vt) => {
                      const isSelected = vehicleType === vt._id;
                      const Icon =
                        vt.icon && ICON_MAP[vt.icon] ? ICON_MAP[vt.icon] : ICON_MAP[DEFAULT_ICON];
                      const info = vtSlotInfo[vt._id];
                      return (
                        <button
                          key={vt._id}
                          type="button"
                          onClick={() => {
                            setVehicleType(vt._id);
                            if (errors.vehicleType) setErrors({ ...errors, vehicleType: '' });
                          }}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all w-full text-left ${
                            isSelected
                              ? 'bg-[#9FE870] text-[#062F28] border-[#9FE870] scale-[1.01]'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-[#9FE870]'
                          }`}
                        >
                          <Icon size={16} className="shrink-0" />
                          <span className="flex-1">
                            {vt.name}
                            {info && (
                              <span
                                className={`text-xs font-normal ml-2 ${isSelected ? 'text-[#062F28]/60' : 'text-gray-400'}`}
                              >
                                Hiện tại có:{' '}
                                <span className="font-bold">
                                  {info.codes[0]} - {info.codes[info.codes.length - 1]}
                                </span>
                              </span>
                            )}
                          </span>
                          {isSelected && <Check size={14} className="shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
                {errors.vehicleType && (
                  <p className="text-xs text-red-500 mt-1.5">{errors.vehicleType}</p>
                )}
              </div>
            </div>

            {/* Slot Code / Bulk — AFTER vehicle type */}
            {vehicleType && (
              <div className="space-y-4">
                {mode === 'single' ? (
                  <div className="mb-4">
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      Mã Slot <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.toUpperCase());
                        if (errors.code) setErrors({ ...errors, code: '' });
                      }}
                      placeholder="A1, B2"
                      className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9FE870] ${errors.code ? 'border-red-400' : 'border-gray-200'}`}
                    />
                    {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code}</p>}
                  </div>
                ) : (
                  <div className="space-y-4 mb-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                          Tiền tố <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={prefix}
                          placeholder="A"
                          onChange={(e) => {
                            setPrefix(e.target.value.toUpperCase());
                            if (errors.prefix) setErrors({ ...errors, prefix: '' });
                          }}
                          maxLength={4}
                          className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9FE870] ${errors.prefix ? 'border-red-400' : 'border-gray-200'}`}
                        />
                        {errors.prefix && (
                          <p className="text-xs text-red-500 mt-1">{errors.prefix}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                          Bắt đầu từ <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          placeholder="1"
                          value={startNumber}
                          onKeyDown={handleNumberKeyDown}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStartNumber(val === '' ? '' : Number(val));
                            if (errors.startNumber) setErrors({ ...errors, startNumber: '' });
                          }}
                          className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9FE870] ${errors.startNumber ? 'border-red-400' : 'border-gray-200'}`}
                        />
                        {errors.startNumber && (
                          <p className="text-xs text-red-500 mt-1">{errors.startNumber}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                          Số lượng <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={999}
                          placeholder="10"
                          value={count}
                          onKeyDown={handleNumberKeyDown}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCount(val === '' ? '' : Number(val));
                            if (errors.count) setErrors({ ...errors, count: '' });
                          }}
                          className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9FE870] ${
                            errors.count ? 'border-red-400' : 'border-gray-200'
                          }`}
                        />
                        {errors.count && (
                          <p className="text-xs text-red-500 mt-1">{errors.count}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      Cấu trúc dự kiến:{' '}
                      <span className="font-mono font-semibold">
                        {prefix || 'A'}
                        {Number(startNumber) || 1}
                      </span>
                      ,{' '}
                      <span className="font-mono font-semibold">
                        {prefix || 'A'}
                        {(Number(startNumber) || 1) + 1}
                      </span>
                      , … (<span className="font-semibold">{Number(count) || 10}</span> slot)
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-4 mt-6 flex justify-end gap-3 border-t border-gray-100 shrink-0">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-60"
            >
              Hủy
            </button>
            <button
              disabled={loading}
              onClick={handleSubmit}
              className="px-5 py-2.5 text-sm font-bold text-[#062F28] bg-[#9FE870] rounded-xl hover:bg-[#062F28]/90 transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {mode === 'single' ? 'Gán Xe' : 'Gán Nhiều Vị Trí'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
