import React from 'react';
import { toast } from "sonner";
import { apiClient } from "../../../../../services/api";
import { sessionService } from "../../../../../services/session.service";
import { useCheckInState } from "./useCheckInState";
import { formatPlate } from "../../../../../utils/format";

export function useCheckInLogic(onCheckIn: (data: any) => void) {
  const state = useCheckInState();

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    state.setPreviewUrl(localUrl);
    state.setOcrSuccess(false);
    state.setPlate("");
    state.setCheckInError(null);
    state.setIsUploading(true);
    const formData = new FormData();
    formData.append("image", file);

    const selectedType = state.vehicleTypes.find((v) => v._id === state.selectedVehicleTypeId);
    const isNoPlate = selectedType?.requiresPlate === false;

    try {
      if (isNoPlate) {
        const response: any = await apiClient.post('/upload/image', formData, { headers: { "Content-Type": "multipart/form-data" } });
        if (response.success && response.data?.imageUrl) state.setCheckInImage(response.data.imageUrl);
        else state.setCheckInImage(localUrl);
      } else {
        const response: any = await apiClient.post('/alpr/scan', formData, { headers: { "Content-Type": "multipart/form-data" }, timeout: 35000 } as any);
        if (response.success && response.data?.normalizedPlate) {
          const recognized = formatPlate(response.data.normalizedPlate);
          state.setPlate(recognized);
          if (response.data.imageUrl) state.setCheckInImage(response.data.imageUrl);
          state.setOcrSuccess(true);
          if (!state.reservationInfo && state.facilityId) {
            try {
              const resLookup: any = await apiClient.get(
                `/reservations/by-plate/${encodeURIComponent(recognized)}`,
                { params: { facilityId: state.facilityId } }
              );
              if (resLookup.success && resLookup.data) {
                state.setReservationInfo(resLookup.data);
                state.setReservationCode(resLookup.data.code);
                if (resLookup.data.vehicleTypeId?._id) {
                  state.setSelectedVehicleTypeId(resLookup.data.vehicleTypeId._id);
                }
                state.setPlateMatchStatus('match');
                toast.success(`🎫 Tự động nhận diện đặt chỗ — ${resLookup.data.code}`);
              }
            } catch {
            }
          } else if (state.reservationInfo?.licensePlate) {
            const clean = (s: string) => s.replace(/[^A-Z0-9]/g, '').toUpperCase();
            const matched = clean(recognized) === clean(state.reservationInfo.licensePlate);
            state.setPlateMatchStatus(matched ? 'match' : 'mismatch');
            if (!matched) toast.warning(`⚠ Biển OCR (${recognized}) ≠ Đặt chỗ (${state.reservationInfo.licensePlate})`);
          }
        } else {
          if (response.data?.imageUrl) state.setCheckInImage(response.data.imageUrl);
          else state.setCheckInImage(localUrl);
        }
      }
    } catch (err: any) {
      state.setCheckInImage(localUrl);
    } finally {
      state.setIsUploading(false);
      if (state.fileInputRef.current) state.fileInputRef.current.value = "";
    }
  };

  const clearPreview = () => {
    state.setPreviewUrl(null); state.setOcrSuccess(false); state.setCheckInImage(null);
    state.setPlateMatchStatus('idle'); state.setCheckInError(null);
  };

  const lookupReservation = async (code: string) => {
    if (!code.trim()) return;
    state.setIsLookingUp(true); state.setReservationInfo(null); state.setPlateMatchStatus('idle');
    try {
      const res: any = await apiClient.get(`/reservations/by-code/${code.trim().toUpperCase()}`);
      if (res.success && res.data) {
        state.setReservationInfo(res.data);
        if (res.data.vehicleTypeId?._id) state.setSelectedVehicleTypeId(res.data.vehicleTypeId._id);
        // if (!state.plate && res.data.licensePlate) state.setPlate(res.data.licensePlate);
        toast.success(`✓ Tìm thấy đặt chỗ — ${res.data.licensePlate}`);
        if (state.plate) {
          const clean = (s: string) => s.replace(/[^A-Z0-9]/g, '').toUpperCase();
          const matched = clean(state.plate) === clean(res.data.licensePlate);
          state.setPlateMatchStatus(matched ? 'match' : 'mismatch');
        }
      }
    } catch (err: any) {
      const msg = err.message || "Mã QR không hợp lệ hoặc không tìm thấy đặt chỗ.";
      toast.error(msg);
      state.setCheckInError(msg);
    } finally {
      state.setIsLookingUp(false);
    }
  };

  const handleCheckIn = async () => {
    const selectedVehicleType = state.vehicleTypes.find((v) => v._id === state.selectedVehicleTypeId);
    const isNoPlate = selectedVehicleType?.requiresPlate === false;

    if (!isNoPlate && !state.plate.trim()) { toast.error("Vui lòng nhập biển số xe!"); return; }
    if (!state.checkInImage) { toast.error("BẮT BUỘC phải chụp ảnh xe lúc vào bãi!"); return; }
    if (!state.facilityId || !state.selectedVehicleTypeId) { toast.error("Thiếu thông tin vị trí trực hoặc loại xe. Vui lòng đăng nhập lại!"); return; }
    if (state.reservationInfo && state.plateMatchStatus === 'mismatch') {
      toast.error("Biển số xe thực tế không khớp với thông tin đặt chỗ!"); return;
    }

    state.setIsSubmitting(true);
    try {
      const actualPlate = isNoPlate ? `KBS-${Math.floor(100000 + Math.random() * 900000)}` : state.plate;
      const res = await sessionService.checkIn({
        facilityId: state.facilityId, vehicleTypeId: state.selectedVehicleTypeId,
        licensePlate: actualPlate, gateIn: state.gateIn,
        ...(state.reservationCode ? { reservationCode: state.reservationCode } : {}),
        ...(state.checkInImage ? { checkInImage: state.checkInImage } : {}),
      });

      if (res.success) {
        const floorName = (res.data.floorId as any)?.name || "Tầng Auto";
        const slotCode = (res.data.slotId as any)?.code || "Slot Auto";
        const now = new Date();
        const actualCheckInTime = res.data.checkInTime ? new Date(res.data.checkInTime) : now;
        onCheckIn({
          cardCode: res.data.cardCode, plate: res.data.licensePlate,
          vehicleType: state.vehicleTypes.find((v) => v._id === state.selectedVehicleTypeId)?.name || "",
          checkInTime: actualCheckInTime.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          checkInDate: actualCheckInTime.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
          gate: state.gateIn, zone: `${floorName} - Slot: ${slotCode}`,
          ...(state.reservationCode ? { fromReservation: true, reservationCode: state.reservationCode } : {}),
        });
        toast.success(`Đã cấp phát: ${floorName} - Slot: ${slotCode}. Đang tự động mở chắn...`);
        state.setPendingClear(true);

        if (isNoPlate) {
          const defaultType = state.vehicleTypes.find(v => v.requiresPlate !== false) || state.vehicleTypes[0];
          if (defaultType) state.setSelectedVehicleTypeId(defaultType._id);
        }

        // AUTO CLEAR after 1.5s
        setTimeout(() => {
          state.setPlate(""); state.setCheckInImage(null); state.setPreviewUrl(null); state.setOcrSuccess(false);
          state.setReservationCode(""); state.setReservationInfo(null); state.setPlateMatchStatus('idle');
          state.setPendingClear(false); state.setCheckInError(null);
          onCheckIn(null);
        }, 1500);
      }
    } catch (error: any) {
      state.setCheckInError(error.message || "Lỗi khi tạo phiên đỗ xe!");
    } finally {
      state.setIsSubmitting(false);
    }
  };

  const isSubmittingRef = React.useRef(false);

  const handleCheckInClick = () => {
    if (state.pendingClear) return;
    if (isSubmittingRef.current) return;
    
    isSubmittingRef.current = true;
    handleCheckIn().finally(() => {
      isSubmittingRef.current = false;
    });
  };

  return { ...state, handleImageUpload, clearPreview, lookupReservation, handleCheckInClick };
}
