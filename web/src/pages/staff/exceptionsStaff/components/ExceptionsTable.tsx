import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, ShieldAlert, X } from 'lucide-react';
import { SortButton, FilterDropdown } from './ExceptionsFilters';
import { PageLoader } from '../../../../components/PageLoader';

const STATUS_BADGE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  RESOLVED: {
    bg: 'bg-[#f4fce3]',
    text: 'text-[#14532d]',
    border: 'border-[#84cc16]/60',
    label: 'Đã xử lý',
  },
  NEW: {
    bg: 'bg-[#fef9c3]',
    text: 'text-[#713f12]',
    border: 'border-[#f59e0b]/60',
    label: 'Chờ xử lý',
  },
  PROCESSING: {
    bg: 'bg-[#eff6ff]',
    text: 'text-[#1e3a8a]',
    border: 'border-[#3b82f6]/60',
    label: 'Đang xử lý',
  },
  REJECTED: {
    bg: 'bg-[#fef2f2]',
    text: 'text-[#7f1d1d]',
    border: 'border-[#ef4444]/60',
    label: 'Từ chối',
  },
};

const TYPE_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  lost_card: { bg: 'bg-[#fef2f2]', text: 'text-[#7f1d1d]', border: 'border-[#ef4444]/60' },
  overtime: { bg: 'bg-[#fef9c3]', text: 'text-[#713f12]', border: 'border-[#f59e0b]/60' },
  default: { bg: 'bg-[#f5f5f5]', text: 'text-[#374151]', border: 'border-[#9ca3af]/60' },
};

export function ExceptionsTable({
  isLoading,
  exceptionsList,
  currentData,
  sortConfig,
  handleSort,
  filterType,
  setFilterType,
  uniqueTypes,
  filterStatus,
  onFilterChange,
  hasActiveFilters,
  handleResetFilters,
  onSelectException,
  currentPage,
  itemsPerPage,
}: any) {
  return (
    <>
      {isLoading ? (
        <PageLoader />
      ) : (
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm text-left table-fixed whitespace-nowrap">
        <thead className="sticky top-0 bg-white z-10">
          <tr className="bg-[#f5f5f5] border-b border-[#e8e9e8] text-left">
            <th className="px-4 py-3 text-[#6b6b6b] text-[11px] uppercase font-semibold w-[50px] text-center align-middle">
              #
            </th>
            <th className="px-2 py-2 w-[160px]">
              <SortButton
                label="Mã Lượt Gửi / Thẻ"
                sortKey="cardCode"
                currentSort={sortConfig}
                onSort={handleSort}
              />
            </th>
            <th className="px-2 py-2 w-[120px]">
              <SortButton
                label="Biển số"
                sortKey="plate"
                currentSort={sortConfig}
                onSort={handleSort}
              />
            </th>
            <th className="px-2 py-2 w-[120px]">
              <FilterDropdown
                label="Loại"
                options={uniqueTypes.map((t: any) => ({ value: t, label: t }))}
                value={filterType}
                onChange={setFilterType}
              />
            </th>
            <th className="px-4 py-2 w-[160px] text-[#6b6b6b] text-[11px] uppercase font-semibold align-middle">
              Mô tả
            </th>
            <th className="px-2 py-2 w-[150px]">
              <SortButton
                label="Ghi nhận lúc"
                sortKey="time"
                currentSort={sortConfig}
                onSort={handleSort}
              />
            </th>
            <th className="px-2 py-2 w-[120px]">
              <SortButton
                label="Phụ phí"
                sortKey="surcharge"
                currentSort={sortConfig}
                onSort={handleSort}
              />
            </th>
            <th className="px-2 py-2 w-[120px]">
              <FilterDropdown
                label="Trạng thái"
                options={[
                  { value: 'NEW', label: 'Chờ xử lý' },
                  { value: 'RESOLVED', label: 'Đã xử lý' },
                ]}
                value={filterStatus === 'ALL' ? 'All' : filterStatus}
                onChange={(val) => onFilterChange(val === 'All' ? 'ALL' : val)}
              />
            </th>
            <th className="px-4 py-2 w-[100px] text-[#6b6b6b] text-[11px] uppercase font-semibold text-center align-middle">
              {hasActiveFilters ? (
                <button
                  onClick={handleResetFilters}
                  className="flex items-center justify-center w-full px-2 py-1.5 rounded-md text-[11px] font-bold text-red-500 hover:bg-red-50 transition-colors"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Xóa bộ lọc
                </button>
              ) : (
                'Thao tác'
              )}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 relative">
          {exceptionsList.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-6 py-16 text-center">
                <div className="flex flex-col items-center justify-center text-[#6b6b6b]">
                  <ShieldAlert className="w-12 h-12 text-gray-300 mb-3" strokeWidth={1.5} />
                  <span className="text-sm font-medium">Danh sách báo cáo sự cố đang trống.</span>
                </div>
              </td>
            </tr>
          ) : (
            currentData.map((exc: any, index: number) => {
              const statusBadge = STATUS_BADGE[exc.status] || STATUS_BADGE.NEW;
              const typeBadge = TYPE_BADGE[exc.typeEnum] || TYPE_BADGE.default;
              const stt = (currentPage - 1) * itemsPerPage + index + 1;
              return (
              <motion.tr 
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                key={exc.id}
                className="hover:bg-[#f5ffe8] transition-colors group cursor-pointer"
              >
                    <td className="px-4 py-4 text-[#6b6b6b] text-[13px] text-center font-medium truncate">
                      {stt}
                    </td>
                    <td className="px-4 py-4 text-[#060606] font-medium text-[13px] truncate">
                      <div className="font-medium text-[#060606] truncate">{exc.code}</div>
                      <div className="text-[12px] text-[#6b6b6b] truncate mt-0.5">
                        {exc.cardCode}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono font-bold text-[14px] text-[#060606] truncate">
                      {exc.plate}
                    </td>
                    <td className="px-4 py-4 text-[13px] truncate">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide border ${typeBadge.bg} ${typeBadge.text} ${typeBadge.border}`}
                      >
                        {exc.type}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[#060606] text-[13px]">
                      <div className="flex flex-col gap-1">
                        <div className="truncate max-w-[150px]" title={exc.description}>
                          {exc.description}
                        </div>
                        {exc.source === 'driver' && (
                          <span className="inline-flex items-center text-[10px] text-[#4f46e5] font-bold bg-[#e0e7ff] px-2 py-0.5 rounded-full w-max border border-[#c7d2fe]">
                            📱 Khách phản hồi
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-[#6b6b6b] text-[12px] tabular-nums truncate">
                      {exc.time}
                    </td>
                    <td className="px-4 py-4 text-[#060606] text-[13px] font-medium tabular-nums truncate">
                      {exc.surcharge > 0 ? `${exc.surcharge.toLocaleString('vi-VN')} ₫` : '—'}
                    </td>
                    <td className="px-4 py-4 text-[13px] truncate">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                      >
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectException(exc);
                        }}
                        className="px-3 py-1 bg-white border border-gray-200 text-[#060606] font-medium rounded-lg hover:bg-[#f5ffe8] hover:border-[#9FE870] transition-all text-xs shadow-sm"
                      >
                        Chi tiết
                      </button>
                    </td>
              </motion.tr>
            );
            })
          )}
        </tbody>
      </table>
    </div>
    )}
    </>
  );
}
