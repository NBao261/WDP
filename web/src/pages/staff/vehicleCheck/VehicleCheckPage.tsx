import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { LeftContainer } from './leftSection/LeftContainer';
import { RightContainer } from './rightSection/RightContainer';

export default function VehicleCheckPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // State from exceptions routing if any
  const initialPlate = location.state?.plate || '';
  const [coPlateCam, setCoPlateCam] = useState(initialPlate);

  const [checkInResult, setCheckInResult] = useState<any>(null);
  const [checkOutResult, setCheckOutResult] = useState<any>(null);
  const [currentCheckOutSession, setCurrentCheckOutSession] = useState<any>(null);

  const isNoPlateVehicleCO = currentCheckOutSession?.vehicleTypeId?.requiresPlate === false;
  const isMismatchCO =
    !!currentCheckOutSession &&
    !isNoPlateVehicleCO &&
    coPlateCam.toUpperCase() !== currentCheckOutSession.licensePlate.toUpperCase();

  // GLOBAL HOTKEYS
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'F1':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('HOTKEY_F1'));
          break;
        case 'F10':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('HOTKEY_F10'));
          break;
        case 'F11':
          e.preventDefault();
          if (!document.fullscreenElement)
            document.documentElement.requestFullscreen().catch(() => {});
          else if (document.exitFullscreen) document.exitFullscreen();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-col flex-1 h-full min-h-0 bg-[#eff0ef] font-sans p-2 overflow-y-auto xl:overflow-hidden"
    >
      <Toaster position="top-right" richColors />
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-3 min-h-0 overflow-y-auto xl:overflow-hidden">
        <LeftContainer checkInResult={checkInResult} setCheckInResult={setCheckInResult} />
        <RightContainer
          coPlateCam={coPlateCam}
          setCoPlateCam={setCoPlateCam}
          checkOutResult={checkOutResult}
          setCheckOutResult={setCheckOutResult}
          setCurrentCheckOutSession={setCurrentCheckOutSession}
          isMismatchCO={isMismatchCO}
          currentCheckOutSession={currentCheckOutSession}
        />
      </div>
    </div>
  );
}
