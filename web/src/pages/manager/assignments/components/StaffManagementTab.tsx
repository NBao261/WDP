import React, { useState, useRef, useEffect } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  AlertCircle,
  Settings2,
  MoreVertical,
  User as UserIcon,
  ChevronDown,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  ArrowUpDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loading } from '../../../../components/ui/Loading';
import { User, AssignedFacility } from '../../../../types/user.types';
import { StaffDetailModal } from './StaffDetailModal';

interface StaffManagementTabProps {
  staffList: User[];
  staffLoading: boolean;
  staffError: string;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  fetchStaff: () => void;
  managerFacilities: AssignedFacility[];
  facilityMap: Record<string, string>;
  onAssignClick: (staff: User) => void;
}

const getStaffFacilityNames = (staff: User, facilityMap: Record<string, string>): string => {
  const facilities = staff.assignedFacilities ?? [];
  if (facilities.length === 0) return 'Chưa phân công';

  const names = facilities
    .map((f: any) => {
      const id = typeof f === 'string' ? f : (f as AssignedFacility)._id;
      if (typeof f !== 'string' && (f as AssignedFacility).name) {
        return (f as AssignedFacility).name;
      }
      return facilityMap[id]; // Will be undefined if not found
    })
    .filter(Boolean); // Remove undefined/null items

  if (names.length === 0) return 'Chưa phân công';
  return names.join(', ');
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const inputBase: React.CSSProperties = {
  height: 40,
  background: '#ffffff',
  border: '1.5px solid #e2e3e2',
  borderRadius: 10,
  fontSize: 14,
  outline: 'none',
  cursor: 'pointer',
};

function DropFilter({
  value,
  onChange,
  options,
  width = 180,
  icon: Icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  width?: number | string;
  icon?: React.ElementType;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const active = value !== 'all' && value !== 'none';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div className="relative" style={{ width, flexShrink: 0 }} ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...inputBase,
          display: 'flex',
          alignItems: 'center',
          padding: Icon ? '0 32px 0 32px' : '0 32px 0 14px',
          border: isOpen || active ? '1.5px solid #cce242' : '1.5px solid #e2e3e2',
          boxShadow: isOpen ? '0 0 0 3px rgba(204,226,66,0.2)' : 'none',
          color: active ? '#060606' : '#6b6e6b',
          fontWeight: active ? 600 : 400,
          transition: 'all 0.2s ease',
          userSelect: 'none',
        }}
      >
        {Icon && <Icon size={14} style={{ position: 'absolute', left: 12, color: '#9ca3af' }} />}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption?.label}
        </span>
      </div>

      <ChevronDown
        size={15}
        style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: `translateY(-50%) ${isOpen ? 'rotate(180deg)' : ''}`,
          color: '#6b6e6b',
          pointerEvents: 'none',
          transition: 'transform 0.2s ease',
        }}
      />

      {isOpen && (
        <div
          className="custom-scrollbar"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#ffffff',
            border: '1px solid #e2e3e2',
            borderRadius: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            zIndex: 50,
            overflowY: 'auto',
            overflowX: 'hidden',
            maxHeight: 280,
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {options.map((o) => (
            <div
              key={o.value}
              onClick={() => {
                onChange(o.value);
                setIsOpen(false);
              }}
              style={{
                padding: '10px 14px',
                fontSize: 14,
                cursor: 'pointer',
                color: value === o.value ? '#060606' : '#4a4a4a',
                background: value === o.value ? '#f8fce2' : '#ffffff',
                fontWeight: value === o.value ? 500 : 400,
                display: 'flex',
                alignItems: 'center',
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (value !== o.value) {
                  e.currentTarget.style.background = '#f5f5f5';
                }
              }}
              onMouseLeave={(e) => {
                if (value !== o.value) {
                  e.currentTarget.style.background = '#ffffff';
                }
              }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
  },
};

interface StaffRowProps {
  staff: User;
  managerFacilities: AssignedFacility[];
  facilityMap: Record<string, string>;
  onAssignClick: (staff: User) => void;
  onViewClick: (staff: User) => void;
  isLast?: boolean;
}

function StaffRow({
  staff,
  managerFacilities,
  facilityMap,
  onAssignClick,
  onViewClick,
  isLast,
}: StaffRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const noFacilities = managerFacilities.length === 0;

  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="hover:bg-[#9FE870]/10 transition-colors group cursor-pointer"
      onClick={() => onViewClick(staff)}
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100 text-emerald-600 shrink-0">
            <UserIcon size={20} strokeWidth={1.5} />
          </div>
          <div>
            <p className="font-semibold text-[#060606] text-base">{staff.name}</p>
            <p className="text-xs text-gray-500">{staff.email}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="max-w-[200px] sm:max-w-[350px] xl:max-w-[500px] overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <span
            className={`text-sm ${staff.assignedFacilities?.length === 0 ? 'text-amber-500 font-semibold' : 'text-gray-600'}`}
          >
            {getStaffFacilityNames(staff, facilityMap)}
          </span>
        </div>
      </td>
      <td className="px-6 py-4">
        <span
          className={`px-2.5 py-1 rounded-md text-sm font-semibold border ${
            staff.status === 'active'
              ? 'bg-green-50 text-green-700 border-green-100'
              : staff.status === 'locked'
                ? 'bg-red-50 text-red-600 border-red-100'
                : 'bg-gray-50 text-gray-600 border-gray-200'
          }`}
        >
          {staff.status === 'active'
            ? 'Hoạt động'
            : staff.status === 'locked'
              ? 'Bị khóa'
              : 'Không hoạt động'}
        </span>
      </td>
      <td className="px-6 py-4 text-right relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <MoreVertical size={18} />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: isLast ? 8 : -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: isLast ? 8 : -8 }}
              transition={{ duration: 0.12 }}
              className={`absolute right-8 w-48 bg-white rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-gray-100 py-1.5 z-50 ${isLast ? 'bottom-10' : 'top-12'}`}
            >
              <div className="fixed inset-0 z-[-1]" onClick={() => setMenuOpen(false)} />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewClick(staff);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Eye size={14} /> Xem chi tiết
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!noFacilities) {
                    onAssignClick(staff);
                    setMenuOpen(false);
                  }
                }}
                disabled={noFacilities}
                title={
                  noFacilities
                    ? 'Vui lòng liên hệ Admin để được cấp quyền quản lý tòa nhà trước'
                    : ''
                }
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Settings2 size={14} /> Phân công tòa nhà
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </td>
    </motion.tr>
  );
}

export function StaffManagementTab({
  staffList,
  staffLoading,
  staffError,
  searchTerm,
  setSearchTerm,
  fetchStaff,
  managerFacilities,
  facilityMap,
  onAssignClick,
}: StaffManagementTabProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFacility, setFilterFacility] = useState<string>('all');
  const [sortField, setSortField] = useState<'name' | 'email' | 'none'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (field: 'name' | 'email') => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortField('none');
      setSortDir('asc');
    }
  };

  const [detailStaff, setDetailStaff] = useState<User | undefined>();
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterFacility, sortField, sortDir]);

  const filteredStaff = staffList
    .filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || s.status === filterStatus;

      let matchesFacility = true;
      if (filterFacility === 'unassigned') {
        matchesFacility = !s.assignedFacilities || s.assignedFacilities.length === 0;
      } else if (filterFacility !== 'all') {
        const ids = (s.assignedFacilities ?? []).map((f: any) =>
          typeof f === 'string' ? f : (f as AssignedFacility)._id
        );
        matchesFacility = ids.includes(filterFacility);
      }

      return matchesSearch && matchesStatus && matchesFacility;
    })
    .sort((a, b) => {
      if (sortField === 'none') return 0;
      let aVal = a[sortField].toLowerCase();
      let bVal = b[sortField].toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const totalFiltered = filteredStaff.length;
  const totalPages = Math.ceil(totalFiltered / ITEMS_PER_PAGE);
  const paginatedStaff = filteredStaff.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const hasActiveFilter =
    searchTerm !== '' || filterStatus !== 'all' || filterFacility !== 'all';

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Search & Filter */}
      <motion.div
        variants={itemVariants}
        className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-3"
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm nhân viên theo tên hoặc email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#d7ee46] focus:border-transparent transition-all"
          />
        </div>

        <DropFilter
          value={filterFacility}
          onChange={setFilterFacility}
          options={[
            { value: 'all', label: 'Tất cả tòa nhà' },
            { value: 'unassigned', label: 'Chưa phân công' },
            ...managerFacilities.map((f) => ({ value: f._id, label: f.name })),
          ]}
          width={200}
        />

        <DropFilter
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { value: 'all', label: 'Tất cả trạng thái' },
            { value: 'active', label: 'Hoạt động' },
            { value: 'locked', label: 'Bị khóa' },
            { value: 'inactive', label: 'Không hoạt động' },
          ]}
          width={180}
        />

        {hasActiveFilter && (
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterStatus('all');
              setFilterFacility('all');
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors text-sm font-medium whitespace-nowrap border border-red-100"
          >
            <X size={15} strokeWidth={2.5} />
            Bỏ lọc
          </button>
        )}
      </motion.div>

      {/* Cảnh báo khi Manager chưa được gán tòa nhà */}
      {managerFacilities.length === 0 && (
        <motion.div
          variants={itemVariants}
          className="bg-amber-50 border border-amber-100 rounded-2xl px-6 py-4 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">
              Bạn chưa được phân công quản lý tòa nhà nào
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Vui lòng liên hệ Admin để được cấp quyền quản lý tòa nhà trước khi có thể phân công
              cho nhân viên.
            </p>
          </div>
        </motion.div>
      )}

      {/* Staff table */}
      <motion.div
        variants={itemVariants}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col"
      >
        {staffError ? (
          <div className="p-8 flex items-center justify-center gap-2 text-sm text-red-600 bg-red-50/50 rounded-2xl">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {staffError}
            <button onClick={fetchStaff} className="ml-2 underline font-bold hover:text-red-700">
              Thử lại
            </button>
          </div>
        ) : staffLoading ? (
          <Loading text="Đang tải danh sách nhân viên..." />
        ) : filteredStaff.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
              <Users className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-base font-medium text-gray-900 mb-1">Không có dữ liệu</p>
            <p className="text-sm">
              {searchTerm
                ? 'Không tìm thấy nhân viên nào khớp với từ khóa tìm kiếm.'
                : 'Chưa có nhân viên nào trong hệ thống.'}
            </p>
          </div>
        ) : (
          <div className="w-full">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#9FE870] text-[#062F28] text-[13px] border-b border-[#9FE870] font-semibold uppercase tracking-wider">
                <tr>
                  <th 
                    className="px-6 py-4 rounded-tl-2xl w-[25%] cursor-pointer select-none hover:text-[#062F28] transition-colors"
                    onClick={() => toggleSort('name')}
                  >
                    <span className="flex items-center gap-1.5">
                      Nhân viên
                      <ArrowUpDown size={14} className={sortField === 'name' ? 'text-white' : 'text-[#062F28]/40'} />
                      {sortField === 'name' && (
                        <span className="text-[10px] text-white font-bold">{sortDir === 'asc' ? 'A-Z' : 'Z-A'}</span>
                      )}
                    </span>
                  </th>
                  <th className="px-6 py-4 w-[50%]">Tòa nhà được phân công</th>
                  <th className="px-6 py-4 w-[15%]">Trạng thái</th>
                  <th className="px-6 py-4 text-right rounded-tr-2xl w-[10%]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedStaff.map((staff, index) => (
                  <StaffRow
                    key={staff._id}
                    staff={staff}
                    managerFacilities={managerFacilities}
                    facilityMap={facilityMap}
                    onAssignClick={onAssignClick}
                    onViewClick={(staff) => {
                      setDetailStaff(staff);
                      setIsDetailOpen(true);
                    }}
                    isLast={index >= paginatedStaff.length - 2}
                  />
                ))}
              </tbody>
            </table>

            {totalFiltered > 0 && totalPages > 1 && (
              <div className="px-6 py-4 border-t border-lime-100/50 flex items-center justify-between bg-lime-50/50 rounded-b-2xl">
                <p className="text-sm text-gray-500">
                  Hiển thị{' '}
                  <span className="font-medium text-gray-900">
                    {(currentPage - 1) * ITEMS_PER_PAGE + 1}
                  </span>{' '}
                  đến{' '}
                  <span className="font-medium text-gray-900">
                    {Math.min(currentPage * ITEMS_PER_PAGE, totalFiltered)}
                  </span>{' '}
                  trong tổng số <span className="font-medium text-gray-900">{totalFiltered}</span>{' '}
                  kết quả
                </p>
                <div className="flex gap-1.5">
                  {totalPages >= 5 && (
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white"
                      title="Trang đầu"
                    >
                      <ChevronsLeft size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white"
                    title="Trang trước"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {(() => {
                    let pages: (number | string)[] = [];
                    if (totalPages <= 4) {
                      pages = Array.from({ length: totalPages }, (_, i) => i + 1);
                    } else if (currentPage <= 3) {
                      pages = [1, 2, 3, '...', totalPages];
                    } else if (currentPage >= totalPages - 2) {
                      pages = [1, '...', totalPages - 2, totalPages - 1, totalPages];
                    } else {
                      pages = [
                        1,
                        '...',
                        currentPage - 1,
                        currentPage,
                        currentPage + 1,
                        '...',
                        totalPages,
                      ];
                    }

                    return pages.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => typeof p === 'number' && setCurrentPage(p)}
                        disabled={p === '...'}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          p === '...'
                            ? 'text-gray-400 bg-transparent cursor-default'
                            : currentPage === p
                              ? 'bg-[#9FE870] text-[#062F28] border border-[#9FE870]/70 font-bold shadow-sm'
                              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {p}
                      </button>
                    ));
                  })()}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white"
                    title="Trang sau"
                  >
                    <ChevronRight size={16} />
                  </button>
                  {totalPages >= 5 && (
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white"
                      title="Trang cuối"
                    >
                      <ChevronsRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>

      <StaffDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        staff={detailStaff}
        facilityMap={facilityMap}
      />
    </motion.div>
  );
}
