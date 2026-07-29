import { RevenueReportData } from '../../../../services/report.service';

interface RevenueBreakdownWidgetProps {
  revenueData: RevenueReportData | null;
}

// ── Format method key → Vietnamese label ──────────────────────────────────
function formatMethodLabel(method: string): string {
  const map: Record<string, string> = {
    cash:          'Tiền mặt',
    card:          'Thẻ ngân hàng',
    transfer:      'Chuyển khoản',
    online:        'Trực tuyến',
    qr:            'QR Code',
    momo:          'MoMo',
    vnpay:         'VNPay',
    zalopay:       'ZaloPay',
    e_wallet:      'Ví điện tử',
    ewallet:       'Ví điện tử',
    wallet:        'Ví điện tử',
    credit_card:   'Thẻ tín dụng',
    debit_card:    'Thẻ ghi nợ',
    bank_transfer: 'Chuyển khoản',
    paypal:        'PayPal',
  };
  const key = (method ?? '').toLowerCase().replace(/[-\s]/g, '_');
  return map[key] ?? method;
}

// ── Format full VND amount (đồng nhất với toàn dashboard) ──────────────
const formatVND = (v: number): string => `${v.toLocaleString('vi-VN')}đ`;

// ── Smart % formatter ─────────────────────────────────────────────────────
// Shows "<0.1%" when value is > 0 but rounds to 0.0%, avoids misleading display
const formatPct = (value: number, total: number): string => {
  if (total <= 0) return '0%';
  const pct = (value / total) * 100;
  if (pct <= 0)   return '0%';
  if (pct < 0.1)  return '<0.1%';
  if (pct < 1)    return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(1)}%`;
};

// ── Color palette ─────────────────────────────────────────────────────────
const METHOD_COLORS = ['#062F28', '#22c55e', '#3b82f6', '#f97316', '#8b5cf6', '#ec4899'];

export function RevenueBreakdownWidget({ revenueData }: RevenueBreakdownWidgetProps) {
  // Include ALL methods with revenue > 0, sorted desc by revenue
  const methods = (revenueData?.byMethod ?? [])
    .filter((m) => m.totalRevenue > 0)
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const grandTotal        = revenueData?.summary.grandTotal ?? 0;
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
        {grandTotal > 0 && (
          <span className="text-[12px] font-bold text-[#062F28] bg-[#f0f7f4] px-2.5 py-1 rounded-lg tabular-nums">
            {formatVND(grandTotal)}
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
            const color      = METHOD_COLORS[i % METHOD_COLORS.length];
            const rawPct     = grandTotal > 0 ? (item.totalRevenue / grandTotal) * 100 : 0;
            // Width for progress bar: at least 2% visually when there IS revenue
            const barWidth   = rawPct < 0.5 && item.totalRevenue > 0 ? 2 : rawPct;
            const pctLabel   = formatPct(item.totalRevenue, grandTotal);

            return (
              <div key={item.method}>
                {/* Top row: label + GD count + % */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[12px] font-medium text-[#374151] truncate">
                      {formatMethodLabel(item.method)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-[#9ca3af]">{item.count} GD</span>
                    <span className="text-[12px] font-bold text-[#1a1a1a] tabular-nums w-14 text-right">
                      {pctLabel}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${barWidth}%`, backgroundColor: color }}
                  />
                </div>

                {/* Amount */}
                <p className="text-[11px] text-[#9ca3af] mt-0.5 text-right tabular-nums">
                  {formatVND(item.totalRevenue)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
