import { useEffect, useState } from 'react';
import { TerminalSquare, AlertTriangle, CheckCircle, Clock, CreditCard, MapPin, FileWarning, Loader2 } from 'lucide-react';
import { exceptionService, IException, ExceptionType, ExceptionStatus, EXCEPTION_TYPE_LABELS } from '../../../../services/exception.service';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

/* ── Icon map theo loại sự cố ── */
function getExceptionMeta(type: ExceptionType, status: ExceptionStatus) {
  const iconMap: Record<ExceptionType, { icon: typeof AlertTriangle; iconColor: string; bg: string }> = {
    [ExceptionType.LOST_CARD]:   { icon: CreditCard,    iconColor: 'text-amber-500',  bg: 'bg-amber-50' },
    [ExceptionType.WRONG_PLATE]: { icon: AlertTriangle, iconColor: 'text-rose-500',   bg: 'bg-rose-50' },
    [ExceptionType.WRONG_FEE]:   { icon: CreditCard,    iconColor: 'text-blue-500',   bg: 'bg-blue-50' },
    [ExceptionType.OVERTIME]:    { icon: Clock,         iconColor: 'text-orange-500', bg: 'bg-orange-50' },
    [ExceptionType.WRONG_ZONE]:  { icon: MapPin,        iconColor: 'text-violet-500', bg: 'bg-violet-50' },
    [ExceptionType.UNPAID]:      { icon: CreditCard,    iconColor: 'text-red-600',    bg: 'bg-red-50' },
    [ExceptionType.OTHER]:       { icon: FileWarning,   iconColor: 'text-gray-500',   bg: 'bg-gray-100' },
  };

  const statusBadge: Record<ExceptionStatus, { label: string; cls: string }> = {
    [ExceptionStatus.NEW]:        { label: 'Mới',         cls: 'bg-rose-50 text-rose-600 border-rose-200' },
    [ExceptionStatus.PROCESSING]: { label: 'Đang xử lý', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    [ExceptionStatus.RESOLVED]:   { label: 'Đã xử lý',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    [ExceptionStatus.REJECTED]:   { label: 'Từ chối',    cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  };

  return { ...iconMap[type], badge: statusBadge[status] };
}

export function SystemAlertsWidget() {
  const [exceptions, setExceptions] = useState<IException[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await exceptionService.getExceptions({
          limit: 5,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });
        if (!cancelled && res.success) {
          // API có thể trả về res.data.data[] hoặc res.data[] tùy backend
          const rawData = res.data as any;
          const list: IException[] = Array.isArray(rawData?.data)
            ? rawData.data
            : Array.isArray(rawData)
              ? rawData
              : [];
          const totalCount: number =
            typeof rawData?.total === 'number'
              ? rawData.total
              : list.length;
          setExceptions(list);
          setTotal(totalCount);
        }
      } catch (err) {
        console.error('SystemAlertsWidget: failed to load exceptions', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, []);


  return (
    <div className="bg-white rounded-xl border border-[#e5e7eb] p-5 h-full flex flex-col shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#062F28]/5 flex items-center justify-center shrink-0">
            <TerminalSquare size={16} className="text-[#062F28]" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-[#1a1a1a]">Sự cố gần đây</h2>
            <p className="text-[12px] text-[#6b7280]">
              {total > 0 ? `${total} sự cố được ghi nhận trong hệ thống` : 'Các sự cố trong hoạt động bãi đỗ'}
            </p>
          </div>
        </div>
        {total > 0 && (
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-50 text-rose-600 text-[10px] font-bold uppercase tracking-wider border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            {total} sự cố
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col gap-3 overflow-auto pr-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Loader2 size={20} className="animate-spin text-[#062F28]" />
            <p className="text-[12px] text-[#6b7280]">Đang tải dữ liệu...</p>
          </div>
        ) : exceptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <CheckCircle size={28} className="text-emerald-400" />
            <p className="text-[13px] font-semibold text-[#1a1a1a]">Không có sự cố nào</p>
            <p className="text-[12px] text-[#9ca3af]">Hệ thống đang hoạt động bình thường</p>
          </div>
        ) : (
          exceptions.map((exc) => {
            const meta = getExceptionMeta(exc.type, exc.status);
            const Icon = meta.icon;
            const plate = exc.sessionId != null && typeof exc.sessionId === 'object' ? exc.sessionId.licensePlate : '—';
            const timeAgo = formatDistanceToNow(new Date(exc.createdAt), { addSuffix: true, locale: vi });
            return (
              <div key={exc._id} className="flex gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/50 items-start transition-colors hover:bg-gray-100/50">
                <div className={`mt-0.5 p-1.5 rounded-md ${meta.bg} shrink-0`}>
                  <Icon size={14} className={meta.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-[13px] text-[#1a1a1a] font-semibold truncate">
                      {EXCEPTION_TYPE_LABELS[exc.type]}
                      {plate && plate !== '—' && (
                        <span className="ml-1.5 text-[#6b7280] font-normal">· {plate}</span>
                      )}
                    </p>
                    <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${meta.badge.cls}`}>
                      {meta.badge.label}
                    </span>
                  </div>
                  {exc.description && (
                    <p className="text-[12px] text-[#6b7280] leading-snug line-clamp-1">{exc.description}</p>
                  )}
                  <p className="text-[11px] text-[#9ca3af] mt-1">{timeAgo}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {total > 5 && (
        <div className="mt-4 pt-3 border-t border-gray-100 text-center">
          <a href="/admin/exceptions" className="text-[12px] text-[#062F28] font-semibold hover:underline">
            Xem tất cả {total} sự cố →
          </a>
        </div>
      )}
    </div>
  );
}

