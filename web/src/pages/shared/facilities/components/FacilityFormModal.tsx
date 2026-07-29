import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Building2, MapPin, Clock, Layers, FileText, Loader2, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  facilityService,
  Facility,
  CreateFacilityPayload,
} from '../../../../services/facility.service';
import { useAddressSearch, NominatimResult } from '../hooks/useAddressSearch';

// ── Fix Leaflet default marker icon (webpack/vite bundler issue) ─────────────
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface FacilityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  facility?: Facility;
  onSuccess: () => void;
}

interface FormData extends Omit<CreateFacilityPayload, 'latitude' | 'longitude'> {
  latitude: number | null;
  longitude: number | null;
}

const DEFAULT_FORM: FormData = {
  name: '',
  address: '',
  totalFloors: '' as any,
  openTime: '',
  closeTime: '',
  description: '',
  latitude: null,
  longitude: null,
};

// TP.HCM center
const DEFAULT_CENTER: [number, number] = [10.7769, 106.7009];
const DEFAULT_ZOOM = 14;

// ── Reusable field wrapper ───────────────────────────────────────────────────
function FormField({
  label,
  required = false,
  error,
  icon: Icon,
  iconAlign = 'center',
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  icon: React.ElementType;
  iconAlign?: 'center' | 'top';
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <Icon
          size={16}
          className={`absolute left-3 text-gray-400 z-10 ${
            iconAlign === 'top' ? 'top-3' : 'top-1/2 -translate-y-1/2'
          }`}
        />
        {children}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ── Map click handler — reverse geocode on click ─────────────────────────────
function MapClickHandler({
  onLocationSelect,
}: {
  onLocationSelect: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ── FlyTo component — animates map to new coordinates ────────────────────────
function MapFlyTo({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], zoom ?? 17, { duration: 1.2 });
    }
  }, [lat, lng, zoom, map]);
  return null;
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export function FacilityFormModal({
  isOpen,
  onClose,
  facility,
  onSuccess,
}: FacilityFormModalProps) {
  const isEdit = !!facility;
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleNumberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
      e.preventDefault();
    }
  };

  // ── Address search hook (Nominatim autocomplete + reverse geocoding) ──
  const {
    query: addressQuery,
    setQuery: setAddressQuery,
    suggestions,
    isLoading: isSearching,
    showDropdown,
    hideDropdown,
    clearSearch,
    reverseGeocode,
  } = useAddressSearch();

  // ── Track map center for flyTo ─────────────────────────────────────────
  const [mapTarget, setMapTarget] = useState<{ lat: number; lng: number } | null>(null);

  const getInputClass = (fieldName: string, extra = '') => {
    const base = `w-full pl-9 pr-4 py-2.5 bg-gray-50 rounded-xl text-sm focus:outline-none transition-all ${extra}`;
    if (errors[fieldName]) {
      return `${base} border border-red-500 focus:ring-2 focus:ring-red-200 bg-red-50/10`;
    }
    return `${base} border border-gray-200 focus:ring-2 focus:ring-[#9FE870] focus:bg-white`;
  };

  // ── Reset form when modal opens ────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      if (facility) {
        // Edit mode: load existing data including coordinates
        const lat = facility.location?.coordinates?.[1] ?? null;
        const lng = facility.location?.coordinates?.[0] ?? null;
        setForm({
          name: facility.name,
          address: facility.address,
          totalFloors: facility.totalFloors,
          openTime: facility.openTime,
          closeTime: facility.closeTime,
          description: facility.description || '',
          latitude: lat && lat !== 0 ? lat : null,
          longitude: lng && lng !== 0 ? lng : null,
        });
        setAddressQuery(facility.address || '', true);
        if (lat && lng && lat !== 0 && lng !== 0) {
          setMapTarget({ lat, lng });
        }
      } else {
        setForm(DEFAULT_FORM);
        clearSearch();
        setMapTarget(null);
      }
      setErrors({});
    }
  }, [isOpen, facility]);

  // ── Select a suggestion from the dropdown (Forward Geocoding) ──────────
  const handleSelectSuggestion = useCallback(
    (result: NominatimResult) => {
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);

      // Update form with address and coordinates
      setForm((prev) => ({
        ...prev,
        address: result.display_name,
        latitude: lat,
        longitude: lng,
      }));

      // Update address input & hide dropdown
      setAddressQuery(result.display_name);
      hideDropdown();

      // Fly map to the selected location
      setMapTarget({ lat, lng });

      // Clear location error
      if (errors.location) setErrors((prev) => ({ ...prev, location: '' }));
      if (errors.address) setErrors((prev) => ({ ...prev, address: '' }));
    },
    [errors, hideDropdown, setAddressQuery]
  );

  // ── Handle map click — Reverse Geocoding ───────────────────────────────
  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      // Update coordinates immediately
      setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
      setMapTarget({ lat, lng });

      // Clear errors
      if (errors.location) setErrors((prev) => ({ ...prev, location: '' }));

      // Reverse geocode: get address from coordinates
      const address = await reverseGeocode(lat, lng);
      if (address) {
        setForm((prev) => ({ ...prev, address }));
        if (errors.address) setErrors((prev) => ({ ...prev, address: '' }));
      }
    },
    [errors, reverseGeocode]
  );

  // ── Handle address input change (linked to autocomplete) ───────────────
  const handleAddressChange = (value: string) => {
    setAddressQuery(value);
    setForm((prev) => ({ ...prev, address: value }));
    if (errors.address) setErrors((prev) => ({ ...prev, address: '' }));
  };

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Vui lòng nhập tên tòa nhà / bãi đỗ';
    if (!form.address.trim()) newErrors.address = 'Vui lòng nhập địa chỉ';
    if (!form.totalFloors) newErrors.totalFloors = 'Vui lòng nhập tổng số tầng';
    if (!form.openTime) newErrors.openTime = 'Vui lòng chọn giờ mở cửa';
    if (!form.closeTime) newErrors.closeTime = 'Vui lòng chọn giờ đóng cửa';
    if (form.latitude === null || form.longitude === null) {
      newErrors.location = 'Vui lòng chọn địa chỉ gợi ý hoặc click vào bản đồ';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    setIsSubmitting(true);
    try {
      // Check for duplicates
      const allRes = await facilityService.getAll({ limit: 1000 });
      if (allRes.success) {
        const existing = allRes.data.filter((f) => !isEdit || f._id !== facility?._id);
        const duplicateName = existing.find(
          (f) => f.name.toLowerCase() === form.name.trim().toLowerCase()
        );
        if (duplicateName) {
          setErrors({ name: 'Tên tòa nhà / bãi đỗ này đã tồn tại' });
          setIsSubmitting(false);
          return;
        }

        const duplicateAddress = existing.find(
          (f) => f.address.toLowerCase() === form.address.trim().toLowerCase()
        );
        if (duplicateAddress) {
          setErrors({ address: 'Địa chỉ này đã được đăng ký cho một cơ sở khác' });
          setIsSubmitting(false);
          return;
        }

        if (form.latitude !== 0 && form.longitude !== 0) {
          const duplicateLocation = existing.find(
            (f) =>
              f.location?.coordinates?.[0] === form.longitude &&
              f.location?.coordinates?.[1] === form.latitude
          );
          if (duplicateLocation) {
            setErrors({ location: 'Vị trí bản đồ này đã được sử dụng cho một cơ sở khác' });
            setIsSubmitting(false);
            return;
          }
        }
      }

      const payload = {
        name: form.name,
        address: form.address,
        totalFloors: form.totalFloors,
        openTime: form.openTime,
        closeTime: form.closeTime,
        description: form.description,
        latitude: form.latitude!,
        longitude: form.longitude!,
      };

      if (isEdit && facility) {
        await facilityService.update(facility._id, payload);
        toast.success('Cập nhật tòa nhà / bãi đỗ thành công');
      } else {
        await facilityService.create(payload);
        toast.success('Tạo tòa nhà / bãi đỗ thành công');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Đã xảy ra lỗi');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
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
          className="relative w-full max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h2 className="text-lg font-bold text-[#062F28]">
                {isEdit ? 'Sửa tòa nhà / bãi đỗ' : 'Thêm tòa nhà / bãi đỗ mới'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {isEdit ? 'Cập nhật thông tin tòa nhà / bãi đỗ' : 'Tạo tòa nhà / bãi đỗ mới'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            noValidate
            className="p-6 overflow-y-auto flex-1 flex flex-col justify-between"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* ═══════════════ LEFT COLUMN ═══════════════ */}
              <div className="space-y-4">
                {/* Facility Name */}
                <FormField
                  label="Tên tòa nhà / bãi đỗ"
                  required
                  icon={Building2}
                  error={errors.name}
                >
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => {
                      setForm({ ...form, name: e.target.value });
                      if (errors.name) setErrors({ ...errors, name: '' });
                    }}
                    className={getInputClass('name')}
                    placeholder="Vincom Center"
                  />
                </FormField>

                {/* ── ADDRESS WITH AUTOCOMPLETE ── */}
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Địa chỉ <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3 top-3 text-gray-400 z-10" />
                    <textarea
                      rows={2}
                      value={addressQuery}
                      onChange={(e) => handleAddressChange(e.target.value)}
                      onFocus={() => {
                        if (suggestions.length > 0) hideDropdown();
                      }}
                      className={getInputClass('address', 'resize-none pr-10')}
                      placeholder="Gõ để tìm kiếm địa chỉ..."
                    />
                    {/* Search indicator */}
                    {isSearching && (
                      <Loader2
                        size={16}
                        className="absolute right-3 top-3 text-gray-400 animate-spin"
                      />
                    )}
                    {!isSearching && addressQuery.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          handleAddressChange('');
                          clearSearch();
                        }}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}

                  {/* ── AUTOCOMPLETE DROPDOWN ── */}
                  {showDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 max-h-52 overflow-y-auto z-50">
                      {suggestions.map((result) => (
                        <button
                          key={result.place_id}
                          type="button"
                          onClick={() => handleSelectSuggestion(result)}
                          className="w-full text-left px-4 py-3 hover:bg-[#9FE870]/10 transition-colors flex items-start gap-3 border-b border-gray-50 last:border-0"
                        >
                          <MapPin size={14} className="text-[#5E8F25] mt-0.5 shrink-0" />
                          <span className="text-sm text-gray-700 leading-snug line-clamp-2">
                            {result.display_name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total Floors */}
                <FormField label="Tổng số tầng" required icon={Layers} error={errors.totalFloors}>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    placeholder="5"
                    value={form.totalFloors}
                    onKeyDown={handleNumberKeyDown}
                    onChange={(e) => {
                      setForm({
                        ...form,
                        totalFloors:
                          e.target.value === '' ? ('' as any) : parseInt(e.target.value, 10),
                      });
                      if (errors.totalFloors) setErrors({ ...errors, totalFloors: '' });
                    }}
                    className={getInputClass('totalFloors')}
                  />
                </FormField>
              </div>

              {/* ═══════════════ RIGHT COLUMN ═══════════════ */}
              <div className="space-y-4 flex flex-col h-full">
                {/* Operating Hours */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      Giờ hoạt động <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-1 bg-gray-100/80 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setForm({ ...form, openTime: '00:00', closeTime: '23:59' });
                          if (errors.openTime || errors.closeTime)
                            setErrors({ ...errors, openTime: '', closeTime: '' });
                        }}
                        className={`text-[10px] px-2.5 py-1 rounded-md font-semibold transition-all ${
                          form.openTime === '00:00' && form.closeTime === '23:59'
                            ? 'bg-[#9FE870] text-[#062F28] shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                        }`}
                        title="Mở cửa cả ngày"
                      >
                        24/24h
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setForm({ ...form, openTime: '06:00', closeTime: '18:00' });
                          if (errors.openTime || errors.closeTime)
                            setErrors({ ...errors, openTime: '', closeTime: '' });
                        }}
                        className={`text-[10px] px-2.5 py-1 rounded-md font-semibold transition-all ${
                          form.openTime === '06:00' && form.closeTime === '18:00'
                            ? 'bg-[#9FE870] text-[#062F28] shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                        }`}
                        title="Mở cửa ban ngày"
                      >
                        6h - 18h
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setForm({ ...form, openTime: '08:00', closeTime: '22:00' });
                          if (errors.openTime || errors.closeTime)
                            setErrors({ ...errors, openTime: '', closeTime: '' });
                        }}
                        className={`text-[10px] px-2.5 py-1 rounded-md font-semibold transition-all ${
                          form.openTime === '08:00' && form.closeTime === '22:00'
                            ? 'bg-[#9FE870] text-[#062F28] shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                        }`}
                        title="Mở cửa hành chính & tối"
                      >
                        8h - 22h
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="flex-1">
                      <div className="relative">
                        <Clock
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="time"
                          value={form.openTime}
                          onChange={(e) => {
                            setForm({ ...form, openTime: e.target.value });
                            if (errors.openTime) setErrors({ ...errors, openTime: '' });
                          }}
                          className={getInputClass('openTime')}
                        />
                      </div>
                      {errors.openTime && (
                        <p className="text-xs text-red-500 mt-1">{errors.openTime}</p>
                      )}
                    </div>
                    <span className="text-gray-400 font-medium text-sm mt-2.5">đến</span>
                    <div className="flex-1">
                      <div className="relative">
                        <Clock
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="time"
                          value={form.closeTime}
                          onChange={(e) => {
                            setForm({ ...form, closeTime: e.target.value });
                            if (errors.closeTime) setErrors({ ...errors, closeTime: '' });
                          }}
                          className={getInputClass('closeTime')}
                        />
                      </div>
                      {errors.closeTime && (
                        <p className="text-xs text-red-500 mt-1">{errors.closeTime}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="flex-1 flex flex-col min-h-[120px]">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mô tả</label>
                  <div className="relative flex-1 flex">
                    <FileText size={16} className="absolute left-3 top-3 text-gray-400 z-10" />
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full flex-1 pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:bg-white transition-all resize-none"
                      placeholder="Mô tả ngắn gọn về tòa nhà / bãi đỗ..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ═══════════════ MAP SECTION (full width) ═══════════════ */}
            <div className="mt-6">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                <Navigation size={14} className="inline mr-1.5 text-gray-400" />
                Vị trí trên bản đồ <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Chọn một địa chỉ gợi ý phía trên để tự động cắm ghim, hoặc click trực tiếp vào bản
                đồ.
              </p>

              <div
                className={`rounded-xl overflow-hidden border-2 transition-colors ${
                  errors.location ? 'border-red-400' : 'border-gray-200'
                }`}
              >
                <MapContainer
                  center={DEFAULT_CENTER}
                  zoom={DEFAULT_ZOOM}
                  style={{ height: 300, width: '100%' }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {/* Click anywhere on map → reverse geocode */}
                  <MapClickHandler onLocationSelect={handleMapClick} />
                  {/* FlyTo when selecting a suggestion or clicking map */}
                  {mapTarget && <MapFlyTo lat={mapTarget.lat} lng={mapTarget.lng} />}
                  {/* Marker at selected coordinates */}
                  {form.latitude !== null && form.longitude !== null && (
                    <Marker position={[form.latitude, form.longitude]} icon={defaultIcon} />
                  )}
                </MapContainer>
              </div>

              {/* Coordinates display */}
              {form.latitude !== null && form.longitude !== null ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <MapPin size={12} className="text-[#5E8F25]" />
                  <span className="font-mono">
                    {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
                  </span>
                  <span className="text-green-600 font-medium">✓ Đã chọn vị trí</span>
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-gray-400 italic">
                  Chưa chọn vị trí — chọn địa chỉ gợi ý hoặc click vào bản đồ
                </p>
              )}
              {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location}</p>}
            </div>

            {/* Footer */}
            <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6 shrink-0">
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
                className="px-5 py-2.5 text-sm font-bold text-[#062F28] bg-[#9FE870] rounded-xl hover:bg-[#9FE870]/90 transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2"
              >
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                {isEdit ? 'Lưu Thay Đổi' : 'Tạo Cơ Sở'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
