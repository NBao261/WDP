export const ExceptionDetailReviewBlocks = ({ selectedException, isResolved }: any) => {
  return (
    <>
      {isResolved && (
        <div>
          <h4 className="text-[12px] font-bold text-[#060606] uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[#9FE870] rounded-sm"></span>Thông tin xử lý
          </h4>
          <div className="bg-white border border-[#e8e9e8] rounded-[10px] p-4 space-y-3 shadow-sm">
            <div className="flex justify-between text-[13px]">
              <span className="text-[#6b6b6b]">Người xử lý:</span>
              <span className="font-medium text-[#060606]">
                {selectedException.resolvedByStaffName || 'Hệ thống'}
              </span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-[#6b6b6b]">Thời gian xử lý:</span>
              <span className="font-medium text-[#060606]">{selectedException.updatedAt}</span>
            </div>
            {selectedException.staffNote && (
              <div className="mt-3 pt-3 border-t border-[#e8e9e8]">
                <span className="text-[12px] text-[#6b6b6b] block mb-1">Ghi chú của Staff:</span>
                <p className="text-[13px] text-[#060606] italic bg-gray-50 p-2 rounded border border-gray-100">
                  "{selectedException.staffNote}"
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {selectedException.managerNote && (
        <div>
          <h4 className="text-[12px] font-bold text-[#060606] uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[#3498db] rounded-sm"></span>Review từ Quản lý
          </h4>
          <div className="bg-[#f0f7fb] border border-[#bce0fd] rounded-[10px] p-4 shadow-sm">
            <div className="flex justify-between text-[13px] mb-2">
              <span className="text-[#1a5fa8] font-medium">Quản lý ghi chú:</span>
              {selectedException.managerName && (
                <span className="text-[#6b6b6b] text-[12px]">{selectedException.managerName}</span>
              )}
            </div>
            <p className="text-[13px] text-[#060606] leading-relaxed">
              {selectedException.managerNote}
            </p>
          </div>
        </div>
      )}
    </>
  );
};
