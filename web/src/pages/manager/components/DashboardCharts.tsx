import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { Loading } from '../../../components/ui/Loading';
import {
  TrafficReportData,
  PeakHoursReportData,
} from '../../../services/report.service';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#060606] rounded-xl px-4 py-3 shadow-xl border border-white/10 min-w-[140px]">
      <p className="text-[11px] text-white/50 mb-2 font-medium tracking-wide uppercase">{label}</p>
      {payload.map((entry: any, i: number) => {
        let circleColor = entry.color;
        if (entry.name === 'Xe vào' || (typeof circleColor === 'string' && circleColor.includes('url'))) {
          circleColor = '#7ED321';
        } else if (entry.name === 'Xe ra') {
          circleColor = '#060606';
        }
        
        return (
          <div key={i} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
            <span className="flex items-center gap-1.5 text-[12px] text-white/70">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: circleColor }}
              />
              {entry.name}
            </span>
            <span className="text-[13px] font-semibold text-white tabular-nums">
              {typeof entry.value === 'number' ? Math.abs(entry.value).toLocaleString('vi-VN') : entry.value}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export function TrafficChartWidget({
  trafficData,
  peakHoursData,
  loading,
  timeFilter,
}: {
  trafficData: TrafficReportData | null;
  peakHoursData: PeakHoursReportData | null;
  loading: boolean;
  timeFilter: string;
}) {
  const chartTraffic = useMemo(() => {
    // 1. Chuyển đổi dữ liệu sang Map để tra cứu O(1)
    const trafficMap = new Map<string, { checkIn: number; checkOut: number }>();
    if (trafficData?.data) {
      for (const item of trafficData.data) {
        trafficMap.set(item.label, { checkIn: item.checkIn, checkOut: item.checkOut });
      }
    }

    const getTraffic = (label: string) => trafficMap.get(label) || { checkIn: 0, checkOut: 0 };
    const pad = (num: number) => String(num).padStart(2, '0');

    let result: any[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthStr = pad(now.getMonth() + 1);

    switch (timeFilter) {
      case 'today':
        if (peakHoursData?.hourlyDistribution) {
          result = peakHoursData.hourlyDistribution.map((item) => ({
            name: `${pad(item.hour)}:00`,
            'Xe vào': item.checkIn,
            'Xe ra': item.checkOut,
          }));
        } else {
          result = Array.from({ length: 24 }, (_, i) => ({
            name: `${pad(i)}:00`,
            'Xe vào': 0,
            'Xe ra': 0,
          }));
        }
        break;

      case 'week':
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const dayStr = pad(d.getDate());
          const monthStr = pad(d.getMonth() + 1);
          
          const labelFormat = `${d.getFullYear()}-${monthStr}-${dayStr}`;
          const traffic = getTraffic(labelFormat);
          
          result.push({
            name: `${dayStr}/${monthStr}`,
            'Xe vào': traffic.checkIn,
            'Xe ra': traffic.checkOut,
          });
        }
        break;

      case 'month': {
        const daysInMonth = now.getDate();
        for (let i = 1; i <= daysInMonth; i++) {
          const dayStr = pad(i);
          const labelFormat = `${currentYear}-${currentMonthStr}-${dayStr}`;
          const traffic = getTraffic(labelFormat);
          
          result.push({
            name: `${dayStr}/${currentMonthStr}`,
            'Xe vào': traffic.checkIn,
            'Xe ra': traffic.checkOut,
          });
        }
        break;
      }

      case 'year':
        for (let i = 1; i <= 12; i++) {
          const monthStr = pad(i);
          const labelFormat = `${currentYear}-${monthStr}`;
          const traffic = getTraffic(labelFormat);
          
          result.push({
            name: `Th ${i}`,
            'Xe vào': traffic.checkIn,
            'Xe ra': traffic.checkOut,
          });
        }
        break;

      default:
        result = trafficData?.data.map((item) => ({
          name: item.label,
          'Xe vào': item.checkIn,
          'Xe ra': item.checkOut,
        })) || [];
    }

    // Đệm thêm khoảng trống nếu dữ liệu chỉ có 1 điểm để biểu đồ (AreaChart) hiển thị mượt mà không bị lỗi layout
    if (result.length === 1 && timeFilter !== 'today') {
      return [
        { name: '', 'Xe vào': undefined, 'Xe ra': undefined },
        result[0],
        { name: ' ', 'Xe vào': undefined, 'Xe ra': undefined },
      ] as any[];
    }

    return result;
  }, [timeFilter, trafficData, peakHoursData]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm h-[420px] flex flex-col overflow-hidden relative">
      {loading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-xl">
          <Loading size="md" />
        </div>
      )}

      <div className="px-5 pt-5 pb-3 flex-shrink-0 flex items-start justify-between">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">Lưu lượng xe</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">Biến động vào/ra theo thời gian</p>
        </div>
        <div className="flex items-center gap-4 text-[12px] font-medium text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#7ED321]"></div>
            <span>Xe vào</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#060606]"></div>
            <span>Xe ra</span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-3 pb-3 min-h-0">
        {chartTraffic.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-gray-400 text-[13px] font-medium">Chưa có dữ liệu</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartTraffic} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                {/* Area Fill Gradient (green only) */}
                <linearGradient id="areaFillGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7ED321" stopOpacity={0.45} />
                  <stop offset="25%" stopColor="#7ED321" stopOpacity={0.25} />
                  <stop offset="55%" stopColor="#7ED321" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#7ED321" stopOpacity={0} />
                </linearGradient>

                {/* Line Stroke Gradient */}
                <linearGradient id="gradientLightGreen" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#9DE44D" />
                  <stop offset="50%" stopColor="#7ED321" />
                  <stop offset="100%" stopColor="#67B01A" />
                </linearGradient>

                {/* Drop Shadow (green line only) */}
                <filter id="shadowLightGreen" height="250%" width="250%" x="-50%" y="-50%">
                  <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#7ED321" floodOpacity="0.3" />
                </filter>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#f0f0f0" opacity={0.6} />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9B9B9B', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
                dy={12}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9B9B9B', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
                dx={-10}
              />
              <RechartsTooltip
                content={<CustomTooltip />}
                cursor={{ stroke: '#7ED321', strokeWidth: 1.5, strokeDasharray: '4 4' }}
              />

              {/* Dark/grey line — Xe ra */}
              <Area
                type="monotone"
                dataKey="Xe ra"
                stroke="#060606"
                strokeWidth={2}
                fill="none"
                dot={false}
                activeDot={{ r: 5, fill: '#212121', strokeWidth: 0 }}
              />

              {/* Green line + area fill — Xe vào */}
              <Area
                type="monotone"
                dataKey="Xe vào"
                stroke="url(#gradientLightGreen)"
                strokeWidth={2}
                fill="url(#areaFillGreen)"
                dot={false}
                activeDot={{ r: 6, fill: '#FFFFFF', strokeWidth: 3, stroke: '#7ED321' }}
                filter="url(#shadowLightGreen)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
