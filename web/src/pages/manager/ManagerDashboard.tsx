import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  Download,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
} from 'lucide-react';
import { Skeleton } from '../../components/ui/skeleton';
import { Loading } from '../../components/ui/Loading';
import { userService } from '../../services/user.service';
import { useAuthStore } from '../../store/useAuthStore';
import { User, AssignedFacility } from '../../types/user.types';
import { UserRole } from '../../../../shared/types';
import {
  reportService,
  TrafficReportData,
  RevenueReportData,
  OccupancyReportData,
  PeakHoursReportData,
} from '../../services/report.service';
import { vehicleTypeService, VehicleType } from '../../services/vehicleType.service';
import { toast } from 'sonner';

import { FacilityListWidget } from './components/FacilityListWidget';
import { TrafficChartWidget } from './components/DashboardCharts';
import { TabbedInsightWidget } from './components/TabbedInsightWidget';
import { AIChatWidget } from './components/AIChatWidget';
import { CustomDropdown } from '../../components/ui/CustomDropdown';

/* ── Helpers ─────────────────────────────────────────────── */

function getDateRange(filter: string): {
  startDate: string;
  endDate: string;
  groupBy: 'day' | 'week' | 'month';
} {
  const now = new Date();
  const endDate = now.toISOString();
  switch (filter) {
    case 'today': {
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { startDate: s.toISOString(), endDate, groupBy: 'day' };
    }
    case 'month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: s.toISOString(), endDate, groupBy: 'day' };
    }
    case 'year': {
      const s = new Date(now.getFullYear(), 0, 1);
      return { startDate: s.toISOString(), endDate, groupBy: 'month' };
    }
    case 'week':
    default: {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      s.setHours(0, 0, 0, 0);
      return { startDate: s.toISOString(), endDate, groupBy: 'day' };
    }
  }
}

const TIME_LABELS: Record<string, string> = {
  today: 'Hôm nay',
  week: '7 ngày qua',
  month: 'Tháng này',
  year: 'Năm nay',
};

function getRevenueFontSize(value: number): string {
  const formatted = value.toLocaleString('vi-VN');
  const len = formatted.length;
  if (len <= 7) return 'text-[36px] xl:text-[40px]';
  if (len <= 11) return 'text-[30px] xl:text-[34px]';
  return 'text-[26px] xl:text-[30px]';
}

/* ── Main Dashboard ──────────────────────────────────────── */

export default function ManagerDashboard() {
  const { user } = useAuthStore();
  const managerFacilities = useMemo(
    () => (user?.assignedFacilities ?? []) as AssignedFacility[],
    [user?.assignedFacilities]
  );

  const [timeFilter, setTimeFilter] = useState('today');
  const [facilityFilter, setFacilityFilter] = useState('all');

  const [staffList, setStaffList] = useState<User[]>([]);
  const [trafficData, setTrafficData] = useState<TrafficReportData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueReportData | null>(null);
  const [occupancyData, setOccupancyData] = useState<OccupancyReportData | null>(null);
  const [peakHoursData, setPeakHoursData] = useState<PeakHoursReportData | null>(null);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [facilityRevenues, setFacilityRevenues] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  /* ── Fetch Staff ── */
  const fetchStaff = useCallback(async () => {
    try {
      const res = await userService.getAllUsers({ role: UserRole.STAFF, limit: 100 });
      setStaffList(res.data ?? []);
    } catch (err) {
      console.error('Failed to fetch staff', err);
    }
  }, []);

  /* ── Fetch Dashboard Data ── */
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    const { startDate, endDate, groupBy } = getDateRange(timeFilter);
    const facilityId = facilityFilter !== 'all' ? facilityFilter : undefined;
    try {
      const [trafficRes, revenueRes, occupancyRes, peakRes, vehicleTypesRes] =
        await Promise.allSettled([
          reportService.getTrafficReport({ startDate, endDate, groupBy, facilityId }),
          reportService.getRevenueReport({ startDate, endDate, groupBy, facilityId }),
          reportService.getOccupancyReport({ facilityId }),
          reportService.getPeakHoursReport({ startDate, endDate, facilityId }),
          vehicleTypeService.getAll({ limit: 100 }),
        ]);
      setTrafficData(trafficRes.status === 'fulfilled' ? trafficRes.value.data : null);
      setRevenueData(revenueRes.status === 'fulfilled' ? revenueRes.value.data : null);
      setOccupancyData(occupancyRes.status === 'fulfilled' ? occupancyRes.value.data : null);
      setPeakHoursData(peakRes.status === 'fulfilled' ? peakRes.value.data : null);
      setVehicleTypes(vehicleTypesRes.status === 'fulfilled' ? vehicleTypesRes.value.data : []);

      const revPromises = managerFacilities.map((f: AssignedFacility) =>
        reportService
          .getRevenueReport({ startDate, endDate, groupBy, facilityId: f._id })
          .then((res) => ({ id: f._id, total: res.data.summary.grandTotal }))
          .catch(() => ({ id: f._id, total: 0 }))
      );
      const revResults = await Promise.all(revPromises);
      const revRecord: Record<string, number> = {};
      revResults.forEach((r: { id: string; total: number }) => (revRecord[r.id] = r.total));
      setFacilityRevenues(revRecord);
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
    }
  }, [timeFilter, facilityFilter, managerFacilities]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  /* ── Export ── */
  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      setExporting(true);
      toast.info(`Đang xuất báo cáo tổng hợp ra ${format === 'pdf' ? 'PDF' : 'Excel'}...`);
      const { startDate, endDate, groupBy } = getDateRange(timeFilter);
      const facilityId = facilityFilter !== 'all' ? facilityFilter : undefined;
      const blob = await reportService.exportReport({
        reportType: 'comprehensive',
        format,
        startDate,
        endDate,
        groupBy,
        facilityId,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bao_cao_tong_hop_${Date.now()}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Xuất báo cáo thành công!');
    } catch (err) {
      toast.error('Lỗi xuất báo cáo');
    } finally {
      setExporting(false);
    }
  };

  /* ── Computed values ── */
  const totalCheckIn = trafficData?.summary.totalCheckIn ?? 0;
  const totalCheckOut = trafficData?.summary.totalCheckOut ?? 0;
  const grandTotal = revenueData?.summary.grandTotal ?? 0;
  const avgRevenue =
    revenueData?.summary.avgRevenuePeriod ?? revenueData?.summary.avgRevenuePerDay ?? 0;
  const periodLabel = revenueData?.summary.periodLabel ?? 'ngày';
  const totalTransactions = revenueData?.summary.totalTransactions ?? 0;
  const occupancyRate =
    occupancyData?.summary.overallEffectiveOccupancy ??
    occupancyData?.summary.overallOccupancyRate ??
    0;
  const totalOccupied = occupancyData?.summary.totalOccupied ?? 0;
  const totalSlots = occupancyData?.summary.totalSlots ?? 0;
  // Clamp to 0 — currentlyParked can go negative when the filter window only covers check-outs
  const currentlyParked = Math.max(0, trafficData?.summary.currentlyParked ?? totalOccupied);

  let occupancyStatus = 'Trống';
  if (occupancyRate > 90) occupancyStatus = 'Quá tải';
  else if (occupancyRate > 70) occupancyStatus = 'Khá đông';
  else if (occupancyRate > 40) occupancyStatus = 'Bình thường';

  /* ── Render ── */
  return (
    <div className="min-h-screen">
      {/* ═══ HEADER BAR ═══ */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-[#1a1a1a] font-bold text-[26px] tracking-tight">Tổng quan</h1>
            <p className="text-[15px] text-[#6b7280] mt-0.5">
              Theo dõi và phân tích các chỉ số hoạt động của bãi đỗ xe
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Facility Filter */}
          <CustomDropdown
            value={facilityFilter}
            onChange={setFacilityFilter}
            options={[
              { label: 'Tất cả tòa nhà', value: 'all' },
              ...managerFacilities.map((f: AssignedFacility) => ({ label: f.name, value: f._id })),
            ]}
          />

          {/* Time Filter */}
          <CustomDropdown
            value={timeFilter}
            onChange={setTimeFilter}
            options={Object.entries(TIME_LABELS).map(([value, label]) => ({ label, value }))}
          />

          {/* Export Buttons */}
          <div className="flex gap-[12px]">
            <button
              onClick={() => handleExport('excel')}
              disabled={exporting || loading}
              className="flex items-center gap-[8px] px-[20px] py-[10px] rounded-[10px] bg-white border-[1.5px] border-gray-200 text-[#1a1a1a] text-[16px] font-medium hover:opacity-[0.88] active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <Loading variant="inline" size="sm" text="" />
              ) : (
                <FileSpreadsheet size={17} />
              )}
              Excel
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting || loading}
              className="flex items-center gap-[8px] px-[20px] py-[10px] rounded-[10px] bg-[#a6e676] text-[#132c20] border-none text-[16px] font-medium hover:opacity-[0.88] active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? <Loading variant="inline" size="sm" text="" /> : <Download size={17} />}
              PDF
            </button>
          </div>
        </div>
      </header>

      {/* ═══ CONTENT ═══ */}
      <div className="space-y-6 pb-8">
        {/* ROW 1: KPI Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 xl:gap-4">
          {/* Card 1: Tổng doanh thu — match admin hero card */}
          <div className="col-span-2 xl:col-span-1 relative overflow-hidden bg-gradient-to-br from-[#9ee671] to-[#72d645] rounded-xl p-5 text-black flex flex-col justify-between h-[168px] shadow-sm">
            {/* Decorative SVG waves */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <svg viewBox="0 0 400 170" preserveAspectRatio="none" className="w-full h-full">
                <path
                  d="M 120 170 Q 280 -20 440 170 Q 280 40 120 170 Z"
                  fill="rgba(255,255,255,0.2)"
                />
                <path
                  d="M 150 170 Q 280 -40 410 170 Q 280 20 150 170 Z"
                  fill="rgba(255,255,255,0.1)"
                />
                <path
                  d="M -20 170 Q 80 40 180 170 Q 80 90 -20 170 Z"
                  fill="rgba(255,255,255,0.15)"
                />
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
                  className={`font-bold leading-none tracking-tight tabular-nums text-[#0a1a12] ${getRevenueFontSize(grandTotal)}`}
                >
                  {grandTotal.toLocaleString('vi-VN')}
                  {grandTotal > 0 && (
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
                    <Skeleton className="h-4 w-8 mt-0.5" />
                  ) : (
                    <p className="text-[13px] font-bold text-[#0a1a12]/80 tabular-nums">
                      {totalTransactions.toLocaleString('vi-VN')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Activity Stats */}
          <div className="col-span-2 bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex flex-col h-[160px] overflow-hidden">
            <div className="text-[16px] font-bold text-gray-900 mb-3">Thống kê hoạt động</div>
            <div className="flex gap-3 flex-1 min-h-0">
              <div className="flex-1 border border-gray-100 rounded-lg p-3 flex flex-col justify-center bg-gray-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-md bg-[#f0f9eb] border border-gray-100 shadow-sm flex items-center justify-center text-[#72d645]">
                    <ArrowDownRight size={14} />
                  </div>
                  <span className="text-[14px] text-gray-500 font-medium">Xe vào</span>
                </div>
                <div className="text-[28px] font-bold text-gray-900 leading-none tabular-nums truncate">
                  {loading ? (
                    <Loading variant="inline" size="sm" text="" />
                  ) : (
                    totalCheckIn.toLocaleString('vi-VN')
                  )}
                </div>
              </div>
              <div className="flex-1 border border-gray-100 rounded-lg p-3 flex flex-col justify-center bg-gray-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-md bg-[#f0f9eb] border border-gray-100 shadow-sm flex items-center justify-center text-[#72d645]">
                    <ArrowUpRight size={14} />
                  </div>
                  <span className="text-[14px] text-gray-500 font-medium">Xe ra</span>
                </div>
                <div className="text-[28px] font-bold text-gray-900 leading-none tabular-nums truncate">
                  {loading ? (
                    <Loading variant="inline" size="sm" text="" />
                  ) : (
                    totalCheckOut.toLocaleString('vi-VN')
                  )}
                </div>
              </div>
              <div className="flex-1 border border-gray-100 rounded-lg p-3 flex flex-col justify-center bg-gray-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-md bg-[#f0f9eb] border border-gray-100 shadow-sm flex items-center justify-center text-[#72d645]">
                    <Clock size={14} />
                  </div>
                  <span className="text-[14px] text-gray-500 font-medium">Đang gửi</span>
                </div>
                <div className="text-[28px] font-bold text-gray-900 leading-none tabular-nums truncate">
                  {loading ? (
                    <Loading variant="inline" size="sm" text="" />
                  ) : (
                    currentlyParked.toLocaleString('vi-VN')
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Tỷ lệ lấp đầy — match admin style */}
          <div className="col-span-2 xl:col-span-1 bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between h-[168px] overflow-hidden">
            <div>
              <p className="text-[12px] text-[#6b7280] font-medium">Tỷ lệ lấp đầy</p>
              <p className="text-[11px] text-[#9ca3af] mt-0.5">Trạng thái bãi đỗ</p>
            </div>
            <div>
              <div className="flex justify-between items-end mb-2">
                {loading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <span className="text-[26px] font-bold text-[#0a2012] tracking-tight">
                    {occupancyStatus}
                  </span>
                )}
                {loading ? (
                  <Skeleton className="h-6 w-14" />
                ) : (
                  <span className="text-[20px] font-bold text-gray-700 tabular-nums">
                    {occupancyRate.toFixed(2)}%
                  </span>
                )}
              </div>
              <div className="h-2 rounded-full overflow-hidden bg-[#e9fad9]">
                <div
                  className="h-full bg-[#132c20] rounded-full transition-all duration-700"
                  style={{ width: loading ? '0%' : `${Math.min(occupancyRate, 100)}%` }}
                />
              </div>
              {!loading && (
                <p className="text-[11px] text-[#9ca3af] mt-1.5 text-right">
                  {totalOccupied} xe / {totalSlots} chỗ
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ROW 2: Visual Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7">
            <TrafficChartWidget
              trafficData={trafficData}
              peakHoursData={peakHoursData}
              loading={loading}
              timeFilter={timeFilter}
            />
          </div>
          <div className="lg:col-span-5">
            <TabbedInsightWidget
              vehicleTypes={vehicleTypes}
              revenueData={revenueData}
              occupancyData={occupancyData}
              facilityFilter={facilityFilter}
              loading={loading}
            />
          </div>
        </div>

        {/* ROW 3: Facilities */}
        <div className="pt-4 border-t border-gray-100">
          <FacilityListWidget
            managerFacilities={managerFacilities}
            staffList={staffList}
            facilityRevenues={facilityRevenues}
          />
        </div>
      </div>

      {/* ── Floating AI Chatbot ── */}
      <AIChatWidget />
    </div>
  );
}
