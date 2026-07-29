import { useState } from 'react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Loading } from '../../../../components/ui/Loading';
import {
  TrafficReportData,
  RevenueReportData,
  OccupancyReportData,
  PeakHoursReportData,
} from '../../../../services/report.service';

interface DashboardChartsProps {
  trafficData: TrafficReportData | null;
  revenueData: RevenueReportData | null;
  occupancyData: OccupancyReportData | null;
  peakHoursData: PeakHoursReportData | null;
  isLoading?: boolean;
}

/* ── Custom Tooltip (dark theme) ── */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const totalSlots = payload[0]?.payload?._total;
  return (
    <div className="bg-[#060606] rounded-xl px-4 py-3 shadow-xl border border-white/10 min-w-[140px]">
      <p className="text-[11px] text-white/50 mb-2 font-medium tracking-wide uppercase">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
          <span className="flex items-center gap-1.5 text-[12px] text-white/70">
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: entry.color }}
            />
            {entry.name}
          </span>
          <span className="text-[13px] font-semibold text-white tabular-nums">
            {typeof entry.value === 'number' &&
            (entry.name === 'Doanh thu' || entry.name === 'Doanh thu (₫)')
              ? entry.value.toLocaleString('vi-VN') + '₫'
              : typeof entry.value === 'number'
                ? entry.value.toLocaleString('vi-VN')
                : entry.value}
          </span>
        </div>
      ))}
      {typeof totalSlots === 'number' && (
        <div className="flex items-center justify-between gap-4 mt-2 pt-2 border-t border-white/10">
          <span className="text-[12px] text-white/70 font-medium">Tổng chỗ</span>
          <span className="text-[13px] font-bold text-white tabular-nums">
            {totalSlots.toLocaleString('vi-VN')}
          </span>
        </div>
      )}
    </div>
  );
};

/* ── Tabs: Admin có thêm 2 tab độc quyền ── */
const TABS = [
  { key: 'overview', label: 'Tổng quan', activeColor: '#9ee671', textDark: true },
  { key: 'traffic', label: 'Lưu lượng', activeColor: '#9FE870', textDark: true },
  { key: 'revenue', label: 'Doanh thu', activeColor: '#132c20', textDark: false },
  { key: 'vehicletype', label: 'Loại xe', activeColor: '#4ade80', textDark: true }, // Admin-only
  { key: 'payment', label: 'Thanh toán', activeColor: '#166534', textDark: false }, // Admin-only
  { key: 'peakhours', label: 'Cao điểm', activeColor: '#a6e676', textDark: true },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/* ── Empty State ── */
function EmptyState({ bgColor, dotColor }: { bgColor: string; dotColor: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ backgroundColor: bgColor }}
      >
        <div className="w-6 h-6 rounded-sm" style={{ backgroundColor: dotColor }} />
      </div>
      <p className="text-[#9ca3af] text-[13px] font-medium">Chưa có dữ liệu</p>
    </div>
  );
}

/* ── Payment method label formatter ── */
function formatMethodLabel(method: string): string {
  const map: Record<string, string> = {
    cash: 'Tiền mặt',
    card: 'Thẻ ngân hàng',
    transfer: 'Chuyển khoản',
    online: 'Trực tuyến',
    qr: 'QR Code',
    momo: 'MoMo',
    vnpay: 'VNPay',
    zalopay: 'ZaloPay',
  };
  return map[method?.toLowerCase()] ?? method;
}

/* ── Vehicle type colors — lime green palette ── */
const VEHICLE_COLORS = ['#72d645', '#132c20', '#4ade80', '#166534', '#9ee671', '#a6e676'];
const PAYMENT_COLORS = ['#132c20', '#72d645', '#4ade80', '#166534', '#9ee671', '#bbf7d0'];

/* ── Main Component ── */
export function DashboardCharts({
  trafficData,
  revenueData,
  occupancyData,
  peakHoursData,
  isLoading,
}: DashboardChartsProps) {
  const [activeChart, setActiveChart] = useState<TabKey>('overview');
  const currentTab = TABS.find((t) => t.key === activeChart)!;
  const loading = isLoading ?? false;

  /* Overview: Occupancy by facility */
  const chartOverview = (() => {
    if (!occupancyData?.byFloor?.length) return [];
    const facilityMap = new Map<
      string,
      {
        name: string;
        'Đang dùng': number;
        'Đã đặt': number;
        'Chỗ trống': number;
        'Bảo trì': number;
        _total: number;
      }
    >();
    for (const floor of occupancyData.byFloor) {
      const existing = facilityMap.get(floor.facilityId);
      if (existing) {
        existing['Đang dùng'] += floor.occupied;
        existing['Đã đặt'] += floor.reserved;
        existing['Chỗ trống'] += floor.available;
        existing['Bảo trì'] += floor.maintenance + floor.locked;
        existing._total += floor.total;
      } else {
        facilityMap.set(floor.facilityId, {
          name: floor.facilityName,
          'Đang dùng': floor.occupied,
          'Đã đặt': floor.reserved,
          'Chỗ trống': floor.available,
          'Bảo trì': floor.maintenance + floor.locked,
          _total: floor.total,
        });
      }
    }
    return Array.from(facilityMap.values());
  })();

  /* Traffic chart */
  let chartTraffic: any[] = [];
  if (trafficData?.data.length === 1 && peakHoursData?.hourlyDistribution) {
    chartTraffic = peakHoursData.hourlyDistribution.map((item) => ({
      name: `${String(item.hour).padStart(2, '0')}:00`,
      'Xe vào': item.checkIn,
      'Xe ra': item.checkOut,
    }));
  } else {
    chartTraffic =
      trafficData?.data.map((item) => ({
        name: item.label,
        'Xe vào': item.checkIn,
        'Xe ra': item.checkOut,
      })) || [];
    if (chartTraffic.length === 1) {
      chartTraffic = [
        { name: '', 'Xe vào': undefined, 'Xe ra': undefined },
        chartTraffic[0],
        { name: ' ', 'Xe vào': undefined, 'Xe ra': undefined },
      ] as any[];
    }
  }

  /* Revenue chart */
  let chartRevenue =
    revenueData?.byTimePeriod.map((item) => ({
      name: item.label,
      'Doanh thu': item.totalRevenue,
    })) || [];
  if (chartRevenue.length === 1) {
    chartRevenue = [
      { name: '', 'Doanh thu': undefined },
      chartRevenue[0],
      { name: ' ', 'Doanh thu': undefined },
    ] as any[];
  }

  /* Vehicle type chart — ADMIN ONLY */
  const chartVehicleType = (revenueData?.byVehicleType ?? [])
    .filter((v) => v.totalRevenue > 0)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .map((v) => ({ name: v.vehicleTypeName, 'Doanh thu (₫)': v.totalRevenue, count: v.count }));

  /* Payment method chart — ADMIN ONLY */
  const chartPayment = (revenueData?.byMethod ?? [])
    .filter((m) => m.totalRevenue > 0)
    .map((m) => ({ name: formatMethodLabel(m.method), value: m.totalRevenue, count: m.count }));

  /* Peak hours chart */
  let chartPeak =
    peakHoursData?.hourlyDistribution.map((item) => ({
      name: `${String(item.hour).padStart(2, '0')}:00`,
      Tổng: item.totalActivity,
    })) || [];
  if (chartPeak.length === 1) {
    chartPeak = [
      { name: '', Tổng: undefined },
      chartPeak[0],
      { name: ' ', Tổng: undefined },
    ] as any[];
  }

  const formatYAxis = (v: number) =>
    v >= 1_000_000
      ? `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`
      : v >= 1_000
        ? `${(v / 1_000).toFixed(0)}K`
        : String(v);

  const descriptions: Record<TabKey, string> = {
    overview: 'Phân bổ chỗ đỗ theo tòa nhà thời điểm hiện tại',
    traffic: 'Xu hướng lưu lượng xe ra/vào theo thời gian',
    revenue: 'Xu hướng doanh thu theo thời gian',
    vehicletype: 'So sánh doanh thu theo từng loại phương tiện',
    payment: 'Phân bổ doanh thu theo phương thức thanh toán',
    peakhours: 'Phân bổ hoạt động theo khung giờ trong ngày',
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3 mb-5">
        <div>
          <h2 className="text-[18px] font-semibold text-[#1a1a1a]">Biểu đồ phân tích</h2>
          <p className="text-[13px] text-[#6b7280]">{descriptions[activeChart]}</p>
        </div>
        {/* Toggle pills — wrap thành 2 hàng trên mobile */}
        <div className="flex flex-wrap bg-[#f5f5f3] p-1 rounded-lg gap-0.5 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveChart(tab.key)}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-md transition-all whitespace-nowrap"
              style={
                activeChart === tab.key
                  ? { backgroundColor: tab.activeColor, color: tab.textDark ? '#060606' : '#fff' }
                  : { color: '#6b7280' }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-[300px] relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-lg">
            <Loading size="md" />
          </div>
        )}

        {/* Overview — Stacked Bar */}
        {activeChart === 'overview' &&
          (chartOverview.length === 0 && !loading ? (
            <EmptyState bgColor="#f0fdf4" dotColor="#bbf7d0" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartOverview}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                barCategoryGap="30%"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  dx={-10}
                />
                <RechartsTooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: '#f5f5f3', opacity: 0.6 }}
                />
                <Legend
                  verticalAlign="top"
                  height={28}
                  iconSize={8}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', color: '#6b7280' }}
                />
                <Bar dataKey="Đang dùng" stackId="a" fill="#132c20" />
                <Bar dataKey="Đã đặt" stackId="a" fill="#72d645" />
                <Bar dataKey="Bảo trì" stackId="a" fill="#9ca3af" />
                <Bar dataKey="Chỗ trống" stackId="a" fill="#9ee671" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ))}

        {/* Traffic — Bar Chart */}
        {activeChart === 'traffic' &&
          (chartTraffic.length === 0 && !loading ? (
            <EmptyState bgColor="#f5f5f3" dotColor="#e5e7eb" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartTraffic}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                barGap={8}
                barCategoryGap="20%"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  dx={-10}
                  domain={[0, (d: number) => (d === 0 ? 10 : Math.ceil(d * 1.2))]}
                />
                <RechartsTooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: '#f5f5f3', opacity: 0.6 }}
                />
                <Bar dataKey="Xe vào" fill="#9FE870" radius={[6, 6, 0, 0]} maxBarSize={48} />
                <Bar dataKey="Xe ra" fill="#1a1a1a" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          ))}

        {/* Revenue — Area Chart */}
        {activeChart === 'revenue' &&
          (chartRevenue.length === 0 && !loading ? (
            <EmptyState bgColor="#f0f6ff" dotColor="#bfdbfe" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartRevenue} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="adminRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  dx={-10}
                  domain={[0, (d: number) => (d === 0 ? 10 : Math.ceil(d * 1.2))]}
                  tickFormatter={formatYAxis}
                />
                <RechartsTooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area
                  type="monotone"
                  dataKey="Doanh thu"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fill="url(#adminRevenueGradient)"
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ))}

        {/* ─── Vehicle Type — ADMIN ONLY — Horizontal Bar ─── */}
        {activeChart === 'vehicletype' &&
          (chartVehicleType.length === 0 && !loading ? (
            <EmptyState bgColor="#f5f3ff" dotColor="#ddd6fe" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartVehicleType}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickFormatter={formatYAxis}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                  width={80}
                />
                <RechartsTooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: '#f5f5f3', opacity: 0.6 }}
                />
                <Bar dataKey="Doanh thu (₫)" radius={[0, 6, 6, 0]} maxBarSize={32}>
                  {chartVehicleType.map((_entry, index) => (
                    <Cell
                      key={`cell-vt-${index}`}
                      fill={VEHICLE_COLORS[index % VEHICLE_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ))}

        {/* ─── Payment Method — ADMIN ONLY — Donut ─── */}
        {activeChart === 'payment' &&
          (chartPayment.length === 0 && !loading ? (
            <EmptyState bgColor="#f0fdf9" dotColor="#bbf7d0" />
          ) : (
            <div className="h-full flex items-center gap-6">
              <div className="flex-shrink-0 relative" style={{ width: 200, height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartPayment}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {chartPayment.map((_entry, index) => (
                        <Cell
                          key={`cell-pm-${index}`}
                          fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        fontSize: '12px',
                        backgroundColor: '#060606',
                        color: '#fff',
                      }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend với % */}
              <div className="flex-1 flex flex-col gap-2.5 min-w-0">
                {(() => {
                  const total = chartPayment.reduce((s, d) => s + d.value, 0);
                  return chartPayment.map((item, i) => {
                    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                    return (
                      <div key={item.name} className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[12px] font-medium text-[#374151] truncate">
                              {item.name}
                            </span>
                            <span className="text-[12px] font-bold text-[#1a1a1a] tabular-nums shrink-0">
                              {pct}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: PAYMENT_COLORS[i % PAYMENT_COLORS.length],
                              }}
                            />
                          </div>
                          <span className="text-[11px] text-[#9ca3af]">
                            {item.value.toLocaleString('vi-VN')}₫ · {item.count} GD
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          ))}

        {/* Peak Hours — Bar Chart */}
        {activeChart === 'peakhours' &&
          (chartPeak.length === 0 && !loading ? (
            <EmptyState bgColor="#fff7ed" dotColor="#fed7aa" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartPeak}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                barCategoryGap="20%"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  dx={-10}
                  domain={[0, (d: number) => (d === 0 ? 10 : Math.ceil(d * 1.2))]}
                />
                <RechartsTooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: '#f5f5f3', opacity: 0.6 }}
                />
                <Bar dataKey="Tổng" fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          ))}
      </div>
    </div>
  );
}
