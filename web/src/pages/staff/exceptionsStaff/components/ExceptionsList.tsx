import { Search, Filter } from "lucide-react";
import { useExceptionsListLogic } from "./useExceptionsListLogic";
import { ExceptionsTable } from "./ExceptionsTable";
import { ExceptionsPagination } from "./ExceptionsPagination";

export interface ExceptionData {
  id: string; code: string; cardCode: string; plate: string; type: string; typeEnum: string;
  time: string; status: "NEW" | "PROCESSING" | "RESOLVED" | "REJECTED"; staffName: string;
  resolvedByStaffName: string | null; staffNote: string; managerName: string | null;
  managerNote: string | null; surcharge: number; description: string; vehicleType: string;
  checkInTime: string; slotCode: string; floorName: string; facilityName: string;
  facilityId: string; vehicleTypeIdStr: string; gateIn: string; sessionId: string; sessionStatus: string; updatedAt: string;
  actualPlate?: string; expectedPlate?: string; checkInImage?: string; checkOutImage?: string; excCardCode?: string;
  source?: string; driverName?: string; images?: string[];
}

interface ExceptionsListProps {
  exceptionsList: any[];
  isLoading: boolean;
  searchQuery: string;
  filterStatus: string;
  onSearchChange: (q: string) => void;
  onFilterChange: (status: string) => void;
  onSelectException: (exc: any) => void;
  onContinueCheckout: (plate: string) => void;
}

export default function ExceptionsList({
  exceptionsList, isLoading, searchQuery, filterStatus, onSearchChange, onFilterChange, onSelectException, onContinueCheckout: _onContinueCheckout,
}: ExceptionsListProps) {
  const logic = useExceptionsListLogic({ exceptionsList, searchQuery, filterStatus, onSearchChange, onFilterChange });

  const totalPages = Math.ceil(logic.filteredAndSortedList.length / logic.itemsPerPage) || 1;
  const currentData = logic.filteredAndSortedList.slice((logic.currentPage - 1) * logic.itemsPerPage, logic.currentPage * logic.itemsPerPage);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 min-h-0 overflow-hidden relative">
      <div className="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between gap-4 flex-wrap bg-[#f5f5f5]">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="Tìm kiếm biển số hoặc mã thẻ..."
            className="w-full pl-9 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#9FE870] focus:ring-1 focus:ring-[#9FE870]/40 transition-colors"
          />
        </div>
      </div>

      <ExceptionsTable
        isLoading={isLoading} exceptionsList={exceptionsList} currentData={currentData}
        sortConfig={logic.sortConfig} handleSort={logic.handleSort}
        filterType={logic.filterType} setFilterType={logic.setFilterType} uniqueTypes={logic.uniqueTypes}
        filterStatus={filterStatus} onFilterChange={onFilterChange}
        hasActiveFilters={logic.hasActiveFilters} handleResetFilters={logic.handleResetFilters}
        onSelectException={onSelectException} currentPage={logic.currentPage} itemsPerPage={logic.itemsPerPage}
      />

      <ExceptionsPagination currentPage={logic.currentPage} setCurrentPage={logic.setCurrentPage} totalPages={totalPages} filteredAndSortedList={logic.filteredAndSortedList} itemsPerPage={logic.itemsPerPage} />
    </div>
  );
}
