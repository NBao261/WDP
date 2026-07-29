import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Loading } from '../../../components/ui/Loading';
import { RevenueReportData, OccupancyReportData } from '../../../services/report.service';
import { VehicleType } from '../../../services/vehicleType.service';

/* ── Custom Tooltip ── */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#060606] rounded-xl px-4 py-3 shadow-xl border border-white/10 min-w-[120px]">
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
          <span className="flex items-center gap-1.5 text-[12px] text-white/70">
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: entry.color || entry.payload?.fill }}
            />
            {entry.name}
          </span>
          <span className="text-[13px] font-semibold text-white tabular-nums">
            {typeof entry.value === 'number' ? entry.value.toLocaleString('vi-VN') : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ── Occupancy Segments ── */
const OCC_SEGMENTS = [
  { key: 'available', name: 'Chỗ trống', color: '#e5e7eb' },
  { key: 'reserved', name: 'Đã đặt', color: '#86cd3d' },
  { key: 'occupied', name: 'Đang dùng', color: '#0a2012' },
  { key: 'maintenance', name: 'Bảo trì', color: '#9ca3af' },
];

interface TabbedInsightWidgetProps {
  vehicleTypes: VehicleType[];
  revenueData: RevenueReportData | null;
  occupancyData: OccupancyReportData | null;
  facilityFilter: string;
  loading: boolean;
}

export function TabbedInsightWidget({
  vehicleTypes,
  revenueData,
  occupancyData,
  facilityFilter,
  loading,
}: TabbedInsightWidgetProps) {
  const [activeTab, setActiveTab] = useState<'vehicle' | 'occupancy'>('vehicle');

  /* ── Vehicle Type Pie Data ── */
  const filteredTypes =
    facilityFilter !== 'all'
      ? vehicleTypes.filter((v) =>
          v.floors?.some((f) => {
            const fId = typeof f.facilityId === 'string' ? f.facilityId : f.facilityId._id;
            return fId === facilityFilter;
          })
        )
      : vehicleTypes;

  const colorPalette = ['#0a2012', '#86cd3d', '#e8f5e9', '#e5e7eb', '#9ca3af'];

  const pieData = filteredTypes.map((vt, index) => {
    const rev = revenueData?.byVehicleType?.find((r) => r.vehicleTypeId === vt._id);
    return {
      name: vt.name,
      value: rev ? rev.count : 0,
      color: colorPalette[index % colorPalette.length],
    };
  });
  const totalVehicles = pieData.reduce((acc, curr) => acc + curr.value, 0);

  /* ── Occupancy Donut Data ── */
  const totalMaintenance =
    occupancyData?.byFloor?.reduce((sum, f) => sum + (f.maintenance || 0) + (f.locked || 0), 0) ||
    0;

  const occPieData = occupancyData?.summary
    ? [
        { name: 'Chỗ trống', value: occupancyData.summary.totalAvailable },
        { name: 'Đã đặt', value: occupancyData.summary.totalReserved },
        { name: 'Đang dùng', value: occupancyData.summary.totalOccupied },
        { name: 'Bảo trì', value: totalMaintenance },
      ].filter((item) => item.value > 0)
    : [];
  const totalSlots = occupancyData?.summary?.totalSlots || 0;

  const tabs = [
    { key: 'vehicle' as const, label: 'Phân loại xe' },
    { key: 'occupancy' as const, label: 'Trạng thái chỗ đỗ' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm h-[420px] flex flex-col overflow-hidden relative">
      {loading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-xl">
          <Loading size="md" />
        </div>
      )}

      {/* Header with tabs */}
      <div className="px-5 pt-5 pb-0 flex-shrink-0">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-4 min-h-0 overflow-hidden">
        {activeTab === 'vehicle' ? (
          /* ── Vehicle Type Donut ── */
          <>
            <div className="h-[180px] w-full relative flex-shrink-0">
              {pieData.length === 0 && !loading ? (
                <div className="flex items-center justify-center h-full">
                  <span className="text-gray-400 text-[13px]">Chưa có dữ liệu</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={
                        totalVehicles === 0 ? pieData.map((p) => ({ ...p, value: 1 })) : pieData
                      }
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {totalVehicles === 0
                        ? pieData.map((_, i) => <Cell key={`cell-${i}`} fill="#f3f4f6" />)
                        : pieData.map((entry, i) => <Cell key={`cell-${i}`} fill={entry.color} />)}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] text-gray-500 font-medium">Tổng xe</span>
                <span className="text-[20px] font-bold text-gray-900 tabular-nums">
                  {totalVehicles.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="w-full mt-2 space-y-1.5 overflow-y-auto flex-shrink min-h-0">
              {pieData.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-9 py-0.5 rounded-md text-[10px] font-bold text-center flex-shrink-0"
                      style={{
                        backgroundColor: item.color,
                        color: item.color === '#0a2012' ? '#fff' : '#0a2012',
                      }}
                    >
                      {totalVehicles > 0 ? Math.round((item.value / totalVehicles) * 100) : 0}%
                    </div>
                    <span className="text-[12px] font-medium text-gray-700 truncate">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-[12px] font-bold text-gray-900 tabular-nums">
                    {item.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* ── Occupancy Donut ── */
          <>
            <div className="h-[200px] w-full relative flex-shrink-0">
              {occPieData.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <span className="text-gray-400 text-[13px]">Chưa có dữ liệu</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={occPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {occPieData.map((entry, index) => {
                        const seg = OCC_SEGMENTS.find((s) => s.name === entry.name);
                        return <Cell key={`cell-${index}`} fill={seg?.color || '#9ca3af'} />;
                      })}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[28px] font-bold text-gray-900 leading-none tabular-nums">
                  {totalSlots.toLocaleString('vi-VN')}
                </span>
                <span className="text-[11px] text-gray-500 mt-1">Tổng chỗ</span>
              </div>
            </div>

            {/* Legend */}
            <div className="w-full mt-2 space-y-1.5 overflow-y-auto flex-shrink min-h-0">
              {OCC_SEGMENTS.map((seg) => {
                const item = occPieData.find((d) => d.name === seg.name);
                const val = item?.value || 0;
                return (
                  <div key={seg.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="text-[12px] font-medium text-gray-600">{seg.name}</span>
                    </div>
                    <span className="text-[12px] font-bold text-gray-900 tabular-nums">
                      {val.toLocaleString('vi-VN')}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
