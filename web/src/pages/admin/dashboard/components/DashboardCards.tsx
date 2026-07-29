import {
  TrendingUp,
  CarFront,
  GaugeCircle,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import {
  TrafficReportData,
  RevenueReportData,
  OccupancyReportData,
} from '../../../../services/report.service';

interface DashboardCardsProps {
  trafficData: TrafficReportData | null;
  revenueData: RevenueReportData | null;
  occupancyData: OccupancyReportData | null;
  isLoading?: boolean;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-white/30 rounded-md ${className ?? ''}`} />;
}

function getRevenueFontSize(value: number): string {
  const len = value.toLocaleString('vi-VN').length;
  if (len <= 7) return 'text-[38px] xl:text-[44px]';
  if (len <= 11) return 'text-[30px] xl:text-[36px]';
  return 'text-[24px] xl:text-[28px]';
}

export function DashboardCards({
  trafficData,
  revenueData,
  occupancyData,
  isLoading,
}: DashboardCardsProps) {
  const loading = isLoading ?? false;

  const formatCompactVND = (value: number) => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toLocaleString('vi-VN');
  };

  // ── Data ──
  const totalRevenue = revenueData?.summary.grandTotal ?? 0;
  const avgRevenue =
    revenueData?.summary.avgRevenuePeriod ?? revenueData?.summary.avgRevenuePerDay ?? 0;
  const periodLabel = revenueData?.summary.periodLabel ?? 'ngày';
  const totalTransactions = revenueData?.summary.totalTransactions ?? 0;

  const totalSlots = occupancyData?.summary.totalSlots ?? 0;
  const totalOccupied = occupancyData?.summary.totalOccupied ?? 0;
  const occupancyRate = occupancyData?.summary.overallEffectiveOccupancy ?? 0;

  const checkIn = trafficData?.summary.totalCheckIn ?? 0;
  const checkOut = trafficData?.summary.totalCheckOut ?? 0;
  // Clamp to 0 — currentlyParked can go negative when the time filter only covers
  // check-outs of vehicles that checked in before the filter window.
  const currentlyParked = Math.max(0, trafficData?.summary.currentlyParked ?? totalOccupied);

  let occupancyStatus = 'Trống';
  if (occupancyRate > 90) occupancyStatus = 'Quá tải';
  else if (occupancyRate > 70) occupancyStatus = 'Khá đông';
  else if (occupancyRate > 40) occupancyStatus = 'Bình thường';

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 xl:gap-4">
      {/* ── Card 1: Tổng doanh thu — Hero Green Gradient ── */}
      <div className="col-span-2 xl:col-span-1 relative overflow-hidden bg-gradient-to-br from-[#9ee671] to-[#72d645] rounded-xl p-5 text-black flex flex-col justify-between h-[168px] shadow-sm">
        {/* Decorative SVG waves */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <svg viewBox="0 0 400 170" preserveAspectRatio="none" className="w-full h-full">
            <path d="M 120 170 Q 280 -20 440 170 Q 280 40 120 170 Z" fill="rgba(255,255,255,0.2)" />
            <path d="M 150 170 Q 280 -40 410 170 Q 280 20 150 170 Z" fill="rgba(255,255,255,0.1)" />
            <path d="M -20 170 Q 80 40 180 170 Q 80 90 -20 170 Z" fill="rgba(255,255,255,0.15)" />
          </svg>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <TrendingUp size={15} className="text-[#0a1a12]/60" />
          <span className="text-[13px] font-semibold text-[#0a1a12]/70 uppercase tracking-wide">
            Tổng doanh thu
          </span>
        </div>

        <div className="relative z-10">
          {loading ? (
            <Skeleton className="h-10 w-32 mb-2" />
          ) : (
            <div
              className={`font-bold leading-none tracking-tight tabular-nums text-[#0a1a12] ${getRevenueFontSize(totalRevenue)}`}
            >
              {totalRevenue.toLocaleString('vi-VN')}
              {totalRevenue > 0 && (
                <span className="text-[18px] font-medium opacity-60 ml-1">đ</span>
              )}
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-[#0a1a12]/50 font-medium">TB/{periodLabel}</p>
              {loading ? (
                <Skeleton className="h-4 w-12 mt-0.5" />
              ) : (
                <p className="text-[13px] font-bold text-[#0a1a12]/80 tabular-nums">
                  {avgRevenue.toLocaleString('vi-VN')}đ
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] text-[#0a1a12]/50 font-medium">Giao dịch</p>
              {loading ? (
                <Skeleton className="h-4 w-10 mt-0.5" />
              ) : (
                <p className="text-[13px] font-bold text-[#0a1a12]/80 tabular-nums">
                  {totalTransactions.toLocaleString('vi-VN')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Card 2: Thống kê hoạt động ── */}
      <div className="col-span-2 bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex flex-col h-[168px]">
        <div className="text-[15px] font-bold text-gray-900 mb-3 flex items-center gap-2">
          <CarFront size={16} className="text-[#72d645]" />
          Thống kê hoạt động
        </div>
        <div className="flex gap-3 flex-1 min-h-0">
          {/* Xe vào */}
          <div className="flex-1 border border-gray-100 rounded-lg p-3 flex flex-col justify-center bg-gray-50/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-md bg-[#f0fdf4] border border-gray-100 flex items-center justify-center text-[#72d645]">
                <ArrowDownRight size={14} />
              </div>
              <span className="text-[13px] text-gray-500 font-medium">Xe vào</span>
            </div>
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-[28px] font-bold text-gray-900 leading-none tabular-nums truncate">
                {checkIn.toLocaleString('vi-VN')}
              </div>
            )}
          </div>
          {/* Xe ra */}
          <div className="flex-1 border border-gray-100 rounded-lg p-3 flex flex-col justify-center bg-gray-50/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-md bg-[#f0fdf4] border border-gray-100 flex items-center justify-center text-[#72d645]">
                <ArrowUpRight size={14} />
              </div>
              <span className="text-[13px] text-gray-500 font-medium">Xe ra</span>
            </div>
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-[28px] font-bold text-gray-900 leading-none tabular-nums truncate">
                {checkOut.toLocaleString('vi-VN')}
              </div>
            )}
          </div>
          {/* Đang gửi */}
          <div className="flex-1 border border-gray-100 rounded-lg p-3 flex flex-col justify-center bg-gray-50/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-md bg-[#f0fdf4] border border-gray-100 flex items-center justify-center text-[#72d645]">
                <Clock size={14} />
              </div>
              <span className="text-[13px] text-gray-500 font-medium">Đang gửi</span>
            </div>
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-[28px] font-bold text-gray-900 leading-none tabular-nums truncate">
                {currentlyParked.toLocaleString('vi-VN')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Card 3: Tỷ lệ lấp đầy ── */}
      <div className="col-span-2 xl:col-span-1 bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between h-[168px]">
        <div className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
          <GaugeCircle size={16} className="text-[#72d645]" />
          Tỷ lệ lấp đầy
        </div>
        <div>
          <p className="text-[12px] text-gray-400 font-medium mb-1">Trạng thái bãi đỗ</p>
          <div className="flex justify-between items-end mb-3">
            {loading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <div className="text-[24px] font-bold text-[#0a2012] tracking-tight truncate">
                {occupancyStatus}
              </div>
            )}
            {loading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <div className="text-[26px] font-semibold text-gray-700 tabular-nums">
                {occupancyRate}%
              </div>
            )}
          </div>
          {/* Progress bar — Manager style */}
          <div className="flex h-4 rounded-md overflow-hidden bg-[#a6e676]/30">
            <div
              className="bg-[#132c20] h-full transition-all duration-700"
              style={{ width: loading ? '0%' : `${occupancyRate}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-gray-400">
              {totalOccupied.toLocaleString('vi-VN')} xe
            </span>
            <span className="text-[10px] text-gray-400">
              / {totalSlots.toLocaleString('vi-VN')} chỗ
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
