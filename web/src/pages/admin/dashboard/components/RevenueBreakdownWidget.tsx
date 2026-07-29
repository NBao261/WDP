import { RevenueReportData } from '../../../../services/report.service';

interface RevenueBreakdownWidgetProps {
  revenueData: RevenueReportData | null;
}

function formatMethodLabel(method: string): string {
  const map: Record<string, string> = {
    cash: 'Tiền mặt',
    card: 'Thẻ NH',
    transfer: 'Chuyển khoản',
    online: 'Trực tuyến',
    qr: 'QR Code',
    momo: 'MoMo',
    vnpay: 'VNPay',
    zalopay: 'ZaloPay',
  };
  return map[method?.toLowerCase()] ?? method;
}

const METHOD_COLORS = ['#062F28', '#22c55e', '#3b82f6', '#f97316', '#8b5cf6', '#ec4899'];

const formatCompact = (v: number) => {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString('vi-VN');
};

export function RevenueBreakdownWidget({ revenueData }: RevenueBreakdownWidgetProps) {
  const methods = (revenueData?.byMethod ?? [])
    .filter((m) => m.totalRevenue > 0)
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
  const grandTotal = revenueData?.summary.grandTotal ?? 0;
  const totalTransactions = revenueData?.summary.totalTransactions ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[14px] font-semibold text-[#1a1a1a]">Phương thức thanh toán</h2>
          <p className="text-[12px] text-[#6b7280] mt-0.5">
            {totalTransactions.toLocaleString('vi-VN')} giao dịch
          </p>
        </div>
        {/* Total badge */}
        {grandTotal > 0 && (
          <span className="text-[12px] font-bold text-[#062F28] bg-[#f0f7f4] px-2.5 py-1 rounded-lg">
            {formatCompact(grandTotal)}đ
          </span>
        )}
      </div>

      {methods.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-6">
          <p className="text-[#9ca3af] text-[13px]">Chưa có dữ liệu</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {methods.map((item, i) => {
            const pct = grandTotal > 0 ? ((item.totalRevenue / grandTotal) * 100).toFixed(1) : '0';
            const color = METHOD_COLORS[i % METHOD_COLORS.length];
            return (
              <div key={item.method}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[12px] font-medium text-[#374151]">
                      {formatMethodLabel(item.method)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#9ca3af]">{item.count} GD</span>
                    <span className="text-[12px] font-bold text-[#1a1a1a] tabular-nums">
                      {pct}%
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <p className="text-[11px] text-[#9ca3af] mt-0.5 text-right tabular-nums">
                  {item.totalRevenue.toLocaleString('vi-VN')}đ
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
