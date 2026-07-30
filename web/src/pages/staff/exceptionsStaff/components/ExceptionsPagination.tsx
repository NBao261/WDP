export function ExceptionsPagination({
  currentPage,
  setCurrentPage,
  totalPages,
  filteredAndSortedList,
  itemsPerPage,
}: any) {
  if (filteredAndSortedList.length === 0) return null;
  return (
    <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-white">
      <div className="text-sm text-gray-500">
        Hiển thị {(currentPage - 1) * itemsPerPage + 1} đến{' '}
        {Math.min(currentPage * itemsPerPage, filteredAndSortedList.length)} trên tổng số{' '}
        {filteredAndSortedList.length} mục
      </div>
      <div className="flex items-center gap-1">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((prev: any) => Math.max(1, prev - 1))}
          className="px-3 py-1.5 border border-gray-200 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Trước
        </button>
        <div className="flex gap-1 px-2">
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i + 1)}
              className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${currentPage === i + 1 ? 'bg-[#1a1a1a] text-[#9FE870]' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <button
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((prev: any) => Math.min(totalPages, prev + 1))}
          className="px-3 py-1.5 border border-gray-200 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Sau
        </button>
      </div>
    </div>
  );
}
