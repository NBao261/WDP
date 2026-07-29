import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiClient } from "../../../../../services/api";
import { sessionService } from "../../../../../services/session.service";
import { paymentService } from "../../../../../services/payment.service";
import { useCheckOutState } from "./useCheckOutState";
import { formatPlate } from "../../../../../utils/format";

export function useCheckOutLogic(
  plate: string,
  onChangePlate: (plate: string) => void,
  onCheckOut: (data: any) => void,
  onSearch?: (session: any) => void
) {
  const state = useCheckOutState();
  const socketRef = useRef<Socket | null>(null);
  const lastSearchedRef = useRef<{ input: string, url: string | null }>({ input: '', url: null });

  const finishCheckOutProcess = (checkOutResData: any, methodStr: string) => {
    const timeStr = checkOutResData.checkOutTime ? new Date(checkOutResData.checkOutTime) : new Date();
    const actualCheckOutTime = timeStr.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const actualCheckOutDate = timeStr.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    onCheckOut((prev: any) => ({ ...prev, checkOutTime: actualCheckOutTime, checkOutDate: actualCheckOutDate, paymentStatus: methodStr }));
    state.setPaymentSuccess(true);
  };

  useEffect(() => {
    if (
      state.step === 'SEARCH' && 
      state.searchMode === 'code' &&
      state.searchInput.trim().length >= 4 && 
      state.ocrPreviewUrl &&
      plate
    ) {
      if (
        lastSearchedRef.current.input !== state.searchInput || 
        lastSearchedRef.current.url !== state.ocrPreviewUrl
      ) {
        const timeout = setTimeout(() => {
          lastSearchedRef.current = { input: state.searchInput, url: state.ocrPreviewUrl };
          handleSearch();
        }, 500);
        return () => clearTimeout(timeout);
      }
    }
  }, [state.searchInput, state.ocrPreviewUrl, state.step, state.searchMode, plate]);

  useEffect(() => {
    const socketUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');
    const socket: Socket = io(socketUrl, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (state.currentSession?.facilityId) {
        const facId = typeof state.currentSession.facilityId === 'string' 
          ? state.currentSession.facilityId 
          : (state.currentSession.facilityId as any)._id;
        if (facId) socket.emit('join:facility', facId);
      }
    });

    socket.on('payment:completed', (data: any) => {
      if (state.transactionCode && data.transactionCode === state.transactionCode) {
        state.setMomoSuccess(true);
        if (state.pollIntervalRef.current) clearInterval(state.pollIntervalRef.current);
        setTimeout(() => {
          state.showMsg("Khách đã thanh toán Momo thành công!", "success");
          state.setMomoQR(null);
          state.setIsPolling(false);
          state.setMomoSuccess(false);
          finishCheckOutProcess({ ...state.currentSession, checkOutTime: new Date().toISOString() }, 'Momo');
        }, 2000);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [state.transactionCode, state.currentSession]);

  useEffect(() => {
    if (socketRef.current && socketRef.current.connected && state.currentSession?.facilityId) {
      const facId = typeof state.currentSession.facilityId === 'string' 
        ? state.currentSession.facilityId 
        : (state.currentSession.facilityId as any)._id;
      if (facId) socketRef.current.emit('join:facility', facId);
    }
  }, [state.currentSession]);

  useEffect(() => {
    if (state.isPolling && state.transactionCode) {
      state.pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await paymentService.checkStatus(state.transactionCode!);
          if (res?.success && res?.data?.isPaid) {
            state.setMomoSuccess(true);
            if (state.pollIntervalRef.current) clearInterval(state.pollIntervalRef.current);
            setTimeout(() => {
              state.showMsg("Khách đã thanh toán Momo thành công!", "success");
              state.setMomoQR(null);
              state.setIsPolling(false);
              state.setMomoSuccess(false);
              finishCheckOutProcess({ ...state.currentSession, checkOutTime: new Date().toISOString() }, 'Momo');
            }, 2000);
          }
        } catch (error) {
          // Ignore polling errors
        }
      }, 3000);
    }
    return () => {
      if (state.pollIntervalRef.current) clearInterval(state.pollIntervalRef.current);
    };
  }, [state.isPolling, state.transactionCode]);

  const handleSearch = async (overrideQuery?: string, overrideMode?: 'code' | 'plate') => {
    const query = (typeof overrideQuery === 'string' ? overrideQuery : state.searchInput).trim();
    const mode = overrideMode || state.searchMode;
    if (!query) {
      state.showMsg(mode === 'code' ? 'Vui lòng nhập mã thẻ!' : 'Vui lòng nhập biển số xe!');
      return;
    }
    state.setIsSubmitting(true);
    try {
      const params = mode === 'code' ? { cardCode: query } : { licensePlate: query };
      const res = await sessionService.searchSession(params);
      if (res.success && res.data) {
        const session = res.data;
        state.setCurrentSession(session);
        state.setPlateIn(session.licensePlate);
        const vehicleTypeObj = session.vehicleTypeId as any;
        state.setVehicleTypeName(vehicleTypeObj?.name || 'Không xác định');
        state.setIsNoPlateVehicle(vehicleTypeObj?.requiresPlate === false);
        const checkInTimeStr = new Date(session.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        state.setCheckInTimeDisplay(checkInTimeStr);

        const feeRes = await sessionService.calculateFee(session._id);
        let fee = 0; let feeDetails = null;
        if (feeRes.success) { fee = feeRes.data.totalFee; feeDetails = (feeRes.data as any).details ?? null; }
        state.setFee(fee);

        const checkOutTimeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const checkOutDateStr = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

        if (onCheckOut) {
          onCheckOut({
            ticketCode: session.code || '—', plateIn: session.licensePlate, plateOut: mode === 'plate' ? query : plate,
            checkInTime: checkInTimeStr, checkOutTime: checkOutTimeStr,
            checkInDate: new Date(session.checkInTime).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            checkOutDate: checkOutDateStr, gateIn: session.gateIn || '—', gateOut: state.gateOut.trim(),
            fee, feeDetails: feeDetails, paymentStatus: 'Chưa thanh toán', rawCheckInTime: session.checkInTime,
            zone: `${(session.floorId as any)?.name || "Tầng Auto"} - Slot: ${(session.slotId as any)?.code || "Slot Auto"}`,
          });
        }
        state.setStep('CONFIRM');
        if (onSearch) onSearch(session);

        const actualPlateOut = mode === 'plate' ? query : plate;
        const isNoPlate = vehicleTypeObj?.requiresPlate === false;
        if (!isNoPlate && actualPlateOut.toUpperCase() !== session.licensePlate.toUpperCase()) {
          state.showMsg(`CẢNH BÁO: Biển số xe ra (${actualPlateOut || 'Trống'}) KHÔNG KHỚP với lúc vào (${session.licensePlate})!`);
        }
      }
    } catch (error: any) {
      state.showMsg(error.message || 'Không tìm thấy trong hệ thống!');
      state.setPlateIn(''); state.setVehicleTypeName('Không có dữ liệu'); state.setCurrentSession(null);
      if (onSearch) onSearch(null);
    } finally {
      state.setIsSubmitting(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    state.setOcrPreviewUrl(localUrl); state.setOcrSuccess(false); state.setIsUploading(true);
    const formData = new FormData(); formData.append('image', file);
    try {
      if (state.isNoPlateVehicle) {
        const response: any = await apiClient.post('/upload/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (response.success && response.data?.imageUrl) state.setCheckoutImageUrl(response.data.imageUrl);
        else state.setCheckoutImageUrl(localUrl);
      } else {
        const response: any = await apiClient.post('/alpr/scan', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 35000 } as any);
        if (response.success && response.data?.normalizedPlate) {
          const fp = formatPlate(response.data.normalizedPlate);
          if (state.step === 'SEARCH') {
            if (state.searchMode === 'plate') { state.setSearchInput(fp); onChangePlate(fp); handleSearch(fp, 'plate'); }
            else { onChangePlate(fp); }
          } else if (state.step === 'CONFIRM') {
            onChangePlate(fp);
            if (fp.toUpperCase() !== state.plateIn.toUpperCase()) state.showMsg(`CẢNH BÁO: Biển số xe ra (${fp}) KHÔNG KHỚP với biển số vào (${state.plateIn})!`);
          }
          state.setOcrSuccess(true);
          if (response.data.imageUrl) state.setCheckoutImageUrl(response.data.imageUrl);
        } else {
          // ALPR không nhận diện được biển số — vẫn lưu ảnh để hiển thị
          if (response.data?.imageUrl) state.setCheckoutImageUrl(response.data.imageUrl);
          else state.setCheckoutImageUrl(localUrl);
        }
      }
    } catch (error: any) {
      // Lỗi ALPR — vẫn lưu ảnh preview
      state.setCheckoutImageUrl(localUrl);
    } finally {
      state.setIsUploading(false);
      if (state.fileInputRef.current) state.fileInputRef.current.value = '';
    }
  };

  const clearOcrPreview = () => { state.setOcrPreviewUrl(null); state.setCheckoutImageUrl(null); state.setOcrSuccess(false); };

  const handleReset = () => {
    if (state.pollIntervalRef.current) clearInterval(state.pollIntervalRef.current);
    state.setMomoQR(null); state.setIsPolling(false); state.setTransactionCode(null);
    state.setStep('SEARCH'); state.setSearchInput(''); state.setPlateIn(''); onChangePlate('');
    state.setCurrentSession(null); state.setVehicleTypeName('Không có dữ liệu'); state.setCheckInTimeDisplay('Không có dữ liệu');
    state.setFee(0);
    state.setOcrPreviewUrl(null); state.setOcrSuccess(false); state.setManualConfirmed(false); state.setPaymentSuccess(false);
    state.setPanelMsg(null); state.setIsNoPlateVehicle(false);
    lastSearchedRef.current = { input: '', url: null };
    if (state.fileInputRef.current) state.fileInputRef.current.value = '';
    if (onSearch) onSearch(null); if (onCheckOut) onCheckOut(null);
  };

  const validateMismatch = () => {
    const isMismatch = !state.isNoPlateVehicle && plate.toUpperCase() !== state.plateIn.toUpperCase();
    if (isMismatch && !state.manualConfirmed) { state.showMsg("LỖI: Biển số xe ra KHÔNG KHỚP với biển số vào. Xác nhận thủ công trước!"); return false; }
    return true;
  };

  const handleCashCheckOut = async () => {
    if (state.step === 'CONFIRM') {
      if (!state.currentSession || !validateMismatch()) return;
      state.setIsSubmitting(true);
      try {
        const checkOutRes = await paymentService.cashCheckout({ sessionId: state.currentSession._id, gateOut: state.gateOut.trim(), checkOutImage: state.checkoutImageUrl || undefined });
        if (checkOutRes.success) { state.showMsg("Đã thu tiền mặt & mở barie xe ra thành công!", "success"); finishCheckOutProcess(checkOutRes.data, 'Tiền mặt'); }
      } catch (error: any) { state.showMsg(error.message || 'Lỗi khi check-out bằng tiền mặt!'); }
      finally { state.setIsSubmitting(false); }
    }
  };

  const handleMomoCheckOut = async () => {
    if (state.step === 'CONFIRM') {
      if (!state.currentSession || !validateMismatch()) return;
      state.setIsSubmitting(true);
      try {
        const res = await paymentService.createIntent({ sessionId: state.currentSession._id, method: 'e_wallet', checkOutImage: state.checkoutImageUrl || undefined, gateOut: state.gateOut.trim() });
        if (res.success && (res.data?.qrCodeUrl || res.data?.paymentUrl)) {
          const finalQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(res.data.qrCodeUrl || res.data.paymentUrl)}`;
          state.setMomoQR(finalQrUrl); 
          state.setTransactionCode(res.data.payment.transactionCode); 
          state.setIsPolling(true);
        } else { state.showMsg("Không thể tạo mã QR Momo!"); }
      } catch (error: any) { state.showMsg(error.message || 'Lỗi khi tạo giao dịch Momo!'); }
      finally { state.setIsSubmitting(false); }
    }
  };

  return { ...state, handleSearch, handleImageUpload, clearOcrPreview, handleReset, handleCashCheckOut, handleMomoCheckOut };
}
