import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { facilityService } from '../../../../../services/facility.service';
import { apiClient } from '../../../../../services/api';
import { useCheckInLogic } from './useCheckInLogic';
import { CheckInHeader } from './CheckInHeader';
import { CheckInOCR } from './CheckInOCR';
import { CheckInReservation } from './CheckInReservation';
import { CheckInForm } from './CheckInForm';
import { CheckInAction } from './CheckInAction';

export function CheckInContainer({ onCheckIn }: { onCheckIn: (data: any) => void }) {
  const logic = useCheckInLogic(onCheckIn);

  useEffect(() => {
    const onF1 = () => {
      logic.setPlate('');
      logic.setCheckInImage(null);
      logic.setPreviewUrl(null);
      logic.setOcrSuccess(false);
      logic.setReservationCode('');
      logic.setReservationInfo(null);
      logic.setPlateMatchStatus('idle');
    };

    const onSpace = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        logic.handleCheckInClick();
      }
    };

    window.addEventListener('keydown', onSpace);
    window.addEventListener('HOTKEY_F1', onF1);
    return () => {
      window.removeEventListener('keydown', onSpace);
      window.removeEventListener('HOTKEY_F1', onF1);
    };
  }, [
    logic.plate,
    logic.isSubmitting,
    logic.vehicleTypes,
    logic.selectedVehicleTypeId,
    logic.checkInImage,
    logic.reservationCode,
    logic.reservationInfo,
    logic.plateMatchStatus,
    logic.pendingClear,
  ]);

  useEffect(() => {
    if (!logic.facilityId) return;
    facilityService
      .getOperationsConfig(logic.facilityId)
      .then((res) => {
        if (res.success && res.data.allowedVehicleTypes.length > 0) {
          logic.setVehicleTypes(res.data.allowedVehicleTypes);
          logic.setSelectedVehicleTypeId(res.data.allowedVehicleTypes[0]._id);
        } else {
          logic.setVehicleTypes([]);
          logic.setSelectedVehicleTypeId('');
          toast.warning('Toà nhà này chưa được cấu hình loại xe. Liên hệ Admin.');
        }
      })
      .catch(() => toast.error('Không thể tải cấu hình loại xe'));
  }, [logic.facilityId]);

  useEffect(() => {
    if (!logic.facilityId) return;
    const fetchCapacity = async () => {
      try {
        const res: any = await apiClient.get(
          `/public/facilities/${logic.facilityId}/available-slots`
        );
        if (res.success && Array.isArray(res.data)) logic.setSlotAvailability(res.data);
      } catch {
        /* ignore */
      }
      logic.setCapacityLoaded(true);
    };
    fetchCapacity();

    const socketUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1').replace(
      '/api/v1',
      ''
    );
    const socket: Socket = io(socketUrl, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      socket.emit('join:facility', logic.facilityId);
    });

    socket.on('slot:statusChanged', () => {
      fetchCapacity();
    });

    return () => {
      socket.disconnect();
    };
  }, [logic.facilityId]);

  useEffect(() => {
    if (logic.reservationInfo && logic.reservationInfo.licensePlate) {
      if (!logic.plate) {
        logic.setPlateMatchStatus('idle');
      } else {
        const clean = (s: string) => s.replace(/[^A-Z0-9]/g, '').toUpperCase();
        const matched = clean(logic.plate) === clean(logic.reservationInfo.licensePlate);
        logic.setPlateMatchStatus(matched ? 'match' : 'mismatch');
      }
    }
  }, [logic.plate, logic.reservationInfo]);

  useEffect(() => {
    if (!logic.plate || logic.vehicleTypes.length === 0) return;
    const guessVehicleCategory = (plateStr: string) => {
      if (plateStr.startsWith('KBS-')) return null;

      const upper = plateStr.toUpperCase().replace(/\./g, '');
      const parts = upper.split(/[-\s]+/);

      let series = '';
      if (parts.length >= 3) {
        series = parts[1];
      } else {
        const clean = upper.replace(/[-\s]/g, '');

        const m = clean.match(/^(\d{2})([A-ZĐ]+[0-9]?)(\d{4,5})$/);
        if (m) {
          series = m[2];

          if (clean.length === 8 && series.length === 2 && /\d/.test(series)) {
            series = series.charAt(0);
          }
        }
      }

      if (!series) return 'Motorbike';

      if (series === 'C' || series === 'H' || series === 'D') return 'Truck';
      if (series.length === 1) return 'Car';
      const carSpecialSeries = ['LD', 'KT', 'NN', 'NG', 'CV', 'DA', 'HC', 'MK', 'TĐ', 'TD'];
      if (carSpecialSeries.includes(series)) return 'Car';
      if (series.startsWith('MĐ') || series.startsWith('MD')) return 'ElectricMotorbike';
      return 'Motorbike';
    };
    const category = guessVehicleCategory(logic.plate);
    if (!category) return;
    let targetType = logic.vehicleTypes.find((v) => {
      const norm = v.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]/g, '');
      if (category === 'Truck') return norm.includes('tai') || norm.includes('truck');
      if (category === 'ElectricMotorbike')
        return norm.includes('maydien') || norm.includes('xedien');
      if (category === 'Car')
        return (norm.includes('oto') && !norm.includes('moto')) || norm.includes('car');
      if (category === 'Motorbike')
        return norm.includes('may') || norm.includes('motorbike') || norm.includes('moto');
      return false;
    });
    if (!targetType) {
      if (category === 'Truck' || category === 'Car') {
        targetType = logic.vehicleTypes.find((v) => {
          const norm = v.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
          return (norm.includes('oto') && !norm.includes('moto')) || norm.includes('car');
        });
      } else {
        targetType = logic.vehicleTypes.find((v) => {
          const norm = v.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
          return norm.includes('may') || norm.includes('motorbike') || norm.includes('moto');
        });
      }
    }
    console.log('CheckIn OCR Debug:', {
      plate: logic.plate,
      category,
      targetType: targetType?.name,
      allTypes: logic.vehicleTypes.map((v) => v.name),
    });
    if (targetType && targetType._id !== logic.selectedVehicleTypeId)
      logic.setSelectedVehicleTypeId(targetType._id);
  }, [logic.plate, logic.vehicleTypes]);

  useEffect(() => {
    const toggleQrScannerAsync = async () => {
      if (logic.showQrScanner) {
        setTimeout(async () => {
          try {
            const { Html5Qrcode } = await import('html5-qrcode');
            const scanner = new Html5Qrcode('ci-qr-reader');
            logic.qrScannerRef.current = scanner;
            await scanner.start(
              { facingMode: 'environment' },
              { fps: 10, qrbox: 180 },
              (decodedText: string) => {
                scanner.stop().catch(() => {});
                logic.setShowQrScanner(false);
                const code = decodedText.trim().toUpperCase();
                logic.setReservationCode(code);
                logic.lookupReservation(code);
              },
              undefined
            );
          } catch {
            toast.error('Không mở được camera QR');
            logic.setShowQrScanner(false);
          }
        }, 200);
      } else {
        try {
          await logic.qrScannerRef.current?.stop();
        } catch {}
      }
    };
    toggleQrScannerAsync();
  }, [logic.showQrScanner]);

  useEffect(
    () => () => {
      logic.qrScannerRef.current?.stop().catch(() => {});
    },
    []
  );

  const isNoPlateVt =
    logic.vehicleTypes.find((v) => v._id === logic.selectedVehicleTypeId)?.requiresPlate === false;
  const displayPlate = isNoPlateVt ? 'KBS-AUTO' : logic.plate;

  const toggleQrScanner = () => logic.setShowQrScanner((prev) => !prev);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <CheckInHeader
        facilityName={logic.facilityName}
        gateIn={logic.gateIn}
        checkInImage={logic.checkInImage}
        ocrSuccess={logic.ocrSuccess}
      />
      <div className="flex flex-col gap-3 flex-1 min-h-[300px]">
        <div className="flex gap-3 flex-1 min-h-0">
          <CheckInOCR
            previewUrl={logic.previewUrl}
            fileInputRef={logic.fileInputRef}
            isUploading={logic.isUploading}
            clearPreview={logic.clearPreview}
            handleImageUpload={logic.handleImageUpload}
          />
          <CheckInReservation
            inputReservationMode={logic.inputReservationMode}
            setInputReservationMode={logic.setInputReservationMode}
            reservationInfo={logic.reservationInfo}
            setReservationInfo={logic.setReservationInfo}
            plateMatchStatus={logic.plateMatchStatus}
            setPlateMatchStatus={logic.setPlateMatchStatus}
            setReservationCode={logic.setReservationCode}
            manualReservationCode={logic.manualReservationCode}
            setManualReservationCode={logic.setManualReservationCode}
            lookupReservation={logic.lookupReservation}
            showQrScanner={logic.showQrScanner}
            toggleQrScanner={toggleQrScanner}
          />
        </div>
        <CheckInForm
          displayPlate={displayPlate}
          plate={logic.plate}
          setPlate={logic.setPlate}
          checkInError={logic.checkInError}
          setCheckInError={logic.setCheckInError}
          isSubmitting={logic.isSubmitting}
          pendingClear={logic.pendingClear}
          handleCheckInEnter={logic.handleCheckInClick}
          selectedVehicleTypeId={logic.selectedVehicleTypeId}
          setSelectedVehicleTypeId={logic.setSelectedVehicleTypeId}
          vehicleTypes={logic.vehicleTypes}
          ownerName={
            logic.reservationInfo?.userId?.fullName || logic.reservationInfo?.userId?.name || ''
          }
        />
        <CheckInAction
          vehicleTypes={logic.vehicleTypes}
          selectedVehicleTypeId={logic.selectedVehicleTypeId}
          slotAvailability={logic.slotAvailability}
          capacityLoaded={logic.capacityLoaded}
          checkInError={logic.checkInError}
          isSubmitting={logic.isSubmitting}
          pendingClear={logic.pendingClear}
          plate={logic.plate}
          handleCheckInClick={logic.handleCheckInClick}
        />
      </div>
    </div>
  );
}
