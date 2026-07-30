import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageLimit: number;
  onPageChange: (page: number) => void;

  itemLabel?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageLimit,
  onPageChange,
  itemLabel = 'mục',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = (currentPage - 1) * pageLimit + 1;
  const to = Math.min(currentPage * pageLimit, totalItems);

  return (
    <div className="flex items-center justify-between px-1">
      <p className="text-sm text-gray-500">
        Hiển thị{' '}
        <span className="font-semibold text-[#060606]">
          {from}–{to}
        </span>{' '}
        / <span className="font-semibold text-[#060606]">{totalItems}</span> {itemLabel}
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-2 text-sm font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Trước
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
          .map((page, idx, arr) => (
            <React.Fragment key={page}>
              {idx > 0 && arr[idx - 1] !== page - 1 && (
                <span className="text-gray-400 px-1">...</span>
              )}
              <button
                onClick={() => onPageChange(page)}
                className={`w-9 h-9 text-sm font-semibold rounded-xl transition-colors ${
                  page === currentPage
                    ? 'bg-[#d7ee46] text-[#060606]'
                    : 'border border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
              >
                {page}
              </button>
            </React.Fragment>
          ))}

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-2 text-sm font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Sau →
        </button>
      </div>
    </div>
  );
}
