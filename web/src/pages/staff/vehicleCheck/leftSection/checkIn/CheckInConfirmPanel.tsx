import { CheckCircle2 } from 'lucide-react';

interface CheckInConfirmPanelProps {
  data?: {
    cardCode?: string;
    plate?: string;
    vehicleType?: string;
    checkInTime?: string;
    checkInDate?: string;
    gate?: string;
    zone?: string;
  };
}

export function CheckInConfirmPanel({ data }: CheckInConfirmPanelProps) {
  if (!data) {
    return (
      <div className="w-full h-[170px] border-2 border-[#A3E635] rounded-[8px] flex items-center justify-center bg-white mt-2 shrink-0">
        <img src="/Logo_chu.png" alt="LYNC PARK" className="h-32 object-contain" />
      </div>
    );
  }

  const {
    cardCode = '—',
    plate = '—',
    vehicleType = '—',
    checkInTime = '—',
    checkInDate = '—',
    gate = '—',
    zone = '—',
  } = data;

  return (
    <div className="flex flex-col justify-center h-[170px] shrink-0 overflow-hidden border-2 border-[#A3E635] rounded-[8px] px-5 mt-2 bg-white">
      {/* Header nhỏ gọn */}
      <div className="flex items-center gap-1.5 mb-3 shrink-0">
        <CheckCircle2 className="text-[#65A30D] w-[18px] h-[18px]" />
        <h2 className="text-[13px] font-bold text-[#65A30D] uppercase">Xác Nhận Xe Vào</h2>
      </div>

      {/* 5 trường dữ liệu — layout ngang gọn gàng */}
      <div className="grid grid-cols-3 gap-x-6 gap-y-3 text-[11px]">
        {/* Row 1 */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold text-[#6b6b6b]">Mã thẻ:</span>
          <span className="text-[11px] font-bold text-[#333] truncate">{cardCode}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold text-[#6b6b6b]">Ngày vào:</span>
          <span className="text-[11px] font-bold text-[#333]">{checkInDate}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold text-[#6b6b6b]">Cổng vào:</span>
          <span className="text-[11px] font-bold text-[#333] truncate">{gate}</span>
        </div>

        {/* Row 2 */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold text-[#6b6b6b]">Khu vực / Tầng:</span>
          <span className="text-[11px] font-bold text-[#333] truncate">{zone}</span>
        </div>
        <div className="flex flex-col gap-0.5 col-span-2">
          <span className="text-[9px] font-semibold text-[#6b6b6b]">Giờ vào:</span>
          <span className="text-[11px] font-bold text-[#333]">{checkInTime}</span>
        </div>
      </div>
    </div>
  );
}
