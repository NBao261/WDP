import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { AssignedFacility } from '../../../types/user.types';

import {
  ShieldAlert,
  AlertCircle,
  FileText,
  SearchX,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  exceptionService,
  IException,
  ExceptionType,
  ExceptionStatus,
  EXCEPTION_TYPE_LABELS,
  EXCEPTION_STATUS_LABELS,
} from '../../../services/exception.service';
import { ExceptionFilterBar } from './components/ExceptionFilterBar';
import { ExceptionReviewModal } from './components/ExceptionReviewModal';
import { Loading } from '../../../components/ui/Loading';

export default function ExceptionsManagerPage() {
  const [allExceptions, setAllExceptions] = useState<IException[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<ExceptionType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ExceptionStatus | 'all'>('all');
  const { user } = useAuthStore();
  const facilities = useMemo(() => (user?.assignedFacilities ?? []) as AssignedFacility[], [user?.assignedFacilities]);
  const [filterFacility, setFilterFacility] = useState<string>('all');
  const [sortValue, setSortValue] = useState('createdAt_desc');

  const toggleSort = (field: string) => {
    const [currentField, currentOrder] = sortValue.split('_');
    if (currentField !== field) {
      setSortValue(`${field}_${field === 'createdAt' ? 'desc' : 'asc'}`);
    } else {
      if (field === 'createdAt') {
        if (currentOrder === 'desc') setSortValue('createdAt_asc');
        else setSortValue('createdAt_desc');
      } else {
        if (currentOrder === 'asc') setSortValue(`${field}_desc`);
        else setSortValue('createdAt_desc');
      }
    }
  };

  const [sortField, sortDir] = sortValue.split('_');

  const [page, setPage] = useState(1);
  const LIMIT = 10;

  // Review Modal state
  const [selectedException, setSelectedException] = useState<IException | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchExceptions();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filterType, filterStatus, filterFacility, searchTerm, sortValue]);


  const fetchExceptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await exceptionService.getExceptions({ limit: 1000 });
      if (res.success) {
        const listData = Array.isArray(res.data) ? res.data : res.data?.data;
        setAllExceptions(listData || []);
      } else {
        setError(res.message || 'Lỗi khi tải danh sách sự cố');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = [...allExceptions];

    if (filterStatus !== 'all') {
      result = result.filter((e) => e.status === filterStatus);
    }
    if (filterType !== 'all') {
      result = result.filter((e) => e.type === filterType);
    }
    if (filterFacility !== 'all') {
      result = result.filter((e) => {
        if (typeof e.sessionId === 'object' && e.sessionId?.facilityId?._id) {
          return e.sessionId.facilityId._id === filterFacility;
        }
        return false;
      });
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((e) => {
        const code = typeof e.sessionId === 'object' ? e.sessionId?.code : '';
        const plate = typeof e.sessionId === 'object' ? e.sessionId?.licensePlate : '';
        return (
          (code && code.toLowerCase().includes(term)) ||
          (plate && plate.toLowerCase().includes(term))
        );
      });
    }

    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;
      switch (sortField) {
        case 'sessionId':
          aVal = typeof a.sessionId === 'object' ? a.sessionId?.code || '' : '';
          bVal = typeof b.sessionId === 'object' ? b.sessionId?.code || '' : '';
          break;
        case 'licensePlate':
          aVal = typeof a.sessionId === 'object' ? a.sessionId?.licensePlate || '' : '';
          bVal = typeof b.sessionId === 'object' ? b.sessionId?.licensePlate || '' : '';
          break;
        case 'type':
          aVal = a.type || '';
          bVal = b.type || '';
          break;
        case 'facilityId':
          aVal = typeof a.sessionId === 'object' ? a.sessionId?.facilityId?.name || '' : '';
          bVal = typeof b.sessionId === 'object' ? b.sessionId?.facilityId?.name || '' : '';
          break;
        case 'staffId':
          aVal = typeof a.staffId === 'object' ? a.staffId?.name || '' : '';
          bVal = typeof b.staffId === 'object' ? b.staffId?.name || '' : '';
          break;
        case 'createdAt':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [allExceptions, filterStatus, filterType, filterFacility, searchTerm, sortValue]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / LIMIT));
  const exceptions = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  const handleReviewSubmit = async (exceptionId: string, managerNote: string) => {
    setIsSubmitting(true);
    try {
      const res = await exceptionService.addManagerReview(exceptionId, { managerNote });
      if (res.success) {
        toast.success('Đã lưu đánh giá sự cố');
        setIsModalOpen(false);
        fetchExceptions(); // Reload list
      } else {
        toast.error(res.message || 'Lỗi khi lưu đánh giá');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDetails = (ex: IException) => {
    setSelectedException(ex);
    setIsModalOpen(true);
  };

  const getStatusColor = (status: ExceptionStatus) => {
    switch (status) {
      case ExceptionStatus.NEW:
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case ExceptionStatus.PROCESSING:
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case ExceptionStatus.RESOLVED:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case ExceptionStatus.REJECTED:
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Quản lý Sự cố
          </h1>
          <p className="text-gray-500 mt-1.5">
            Theo dõi, đánh giá và quản lý các sự cố phát sinh tại bãi xe
          </p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <ExceptionFilterBar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterType={filterType}
          setFilterType={setFilterType}
          filterFacility={filterFacility}
          setFilterFacility={setFilterFacility}
          facilities={facilities}
          sortValue={sortValue}
          setSortValue={setSortValue}
        />
      </motion.div>

      {/* Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
        <div className="w-full relative">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#9FE870] text-[#062F28] text-[13px] border-b border-[#9FE870] font-semibold uppercase tracking-wider">
              <tr>
                <th
                  className="px-6 py-4 rounded-tl-2xl w-[15%] cursor-pointer select-none hover:text-[#062F28] transition-colors"
                  onClick={() => toggleSort('sessionId')}
                >
                  <span className="flex items-center gap-1.5">
                    Mã lượt gửi
                    <ArrowUpDown
                      size={14}
                      className={sortField === 'sessionId' ? 'text-white' : 'text-[#062F28]/40'}
                    />
                    {sortField === 'sessionId' && (
                      <span className="text-[10px] text-white font-bold">
                        {sortDir === 'asc' ? 'A-Z' : 'Z-A'}
                      </span>
                    )}
                  </span>
                </th>
                <th
                  className="px-6 py-4 w-[15%] cursor-pointer select-none hover:text-[#062F28] transition-colors"
                  onClick={() => toggleSort('licensePlate')}
                >
                  <span className="flex items-center gap-1.5">
                    Xe
                    <ArrowUpDown
                      size={14}
                      className={sortField === 'licensePlate' ? 'text-white' : 'text-[#062F28]/40'}
                    />
                    {sortField === 'licensePlate' && (
                      <span className="text-[10px] text-white font-bold">
                        {sortDir === 'asc' ? 'A-Z' : 'Z-A'}
                      </span>
                    )}
                  </span>
                </th>
                <th className="px-6 py-4 w-[15%]">Loại sự cố</th>
                <th className="px-6 py-4 w-[15%]">Tòa nhà</th>
                <th
                  className="px-6 py-4 w-[15%] cursor-pointer select-none hover:text-[#062F28] transition-colors"
                  onClick={() => toggleSort('staffId')}
                >
                  <span className="flex items-center gap-1.5">
                    Người tạo
                    <ArrowUpDown
                      size={14}
                      className={sortField === 'staffId' ? 'text-white' : 'text-[#062F28]/40'}
                    />
                    {sortField === 'staffId' && (
                      <span className="text-[10px] text-white font-bold">
                        {sortDir === 'asc' ? 'A-Z' : 'Z-A'}
                      </span>
                    )}
                  </span>
                </th>
                <th
                  className="px-6 py-4 w-[15%] cursor-pointer select-none hover:text-[#062F28] transition-colors"
                  onClick={() => toggleSort('createdAt')}
                >
                  <span className="flex items-center gap-1.5">
                    Ngày tạo
                    <ArrowUpDown
                      size={14}
                      className={sortField === 'createdAt' ? 'text-white' : 'text-[#062F28]/40'}
                    />
                    {sortField === 'createdAt' && (
                      <span className="text-[10px] text-white font-bold">
                        {sortDir === 'desc' ? 'Mới' : 'Cũ'}
                      </span>
                    )}
                  </span>
                </th>
                <th className="px-6 py-4 w-[15%]">Trạng thái</th>
                <th className="px-6 py-4 text-right rounded-tr-2xl w-[10%]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 relative">
              {loading && exceptions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center">
                    <Loading text="Đang tải danh sách sự cố..." />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-rose-500">
                    <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="font-medium text-sm">{error}</p>
                    <button
                      onClick={fetchExceptions}
                      className="mt-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors text-sm font-bold"
                    >
                      Thử lại
                    </button>
                  </td>
                </tr>
              ) : exceptions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-gray-400">
                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-gray-100">
                      <SearchX className="w-6 h-6 text-gray-300" />
                    </div>
                    <p className="font-medium text-gray-900">Không có dữ liệu</p>
                    <p className="text-sm">Không tìm thấy sự cố nào phù hợp</p>
                  </td>
                </tr>
              ) : (
                exceptions.map((ex) => {
                  const sessionCode =
                    typeof ex.sessionId === 'object' && ex.sessionId
                      ? ex.sessionId.code
                      : ex.sessionId || 'N/A';
                  const licensePlate =
                    typeof ex.sessionId === 'object' && ex.sessionId
                      ? ex.sessionId.licensePlate
                      : '';
                  const staffName =
                    typeof ex.staffId === 'object' && ex.staffId
                      ? ex.staffId.name
                      : ex.staffId || 'Hệ thống';

                  return (
                    <motion.tr
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={ex._id}
                      className="hover:bg-[#9FE870]/10 transition-colors group cursor-pointer"
                      onClick={() => handleViewDetails(ex)}
                    >
                      <td className="px-6 py-4 font-medium text-gray-800">{sessionCode}</td>
                      <td className="px-6 py-4 text-gray-700">{licensePlate || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 font-medium">
                          {EXCEPTION_TYPE_LABELS[ex.type]}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {typeof ex.sessionId === 'object' && ex.sessionId?.facilityId?.name
                          ? ex.sessionId.facilityId.name
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-gray-700">{staffName}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(ex.createdAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(ex.status)}`}
                        >
                          {EXCEPTION_STATUS_LABELS[ex.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedException(ex);
                            setIsModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <FileText size={16} />
                          Xem lại
                        </button>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-lime-100/50 flex items-center justify-between bg-lime-50/50 rounded-b-2xl">
            <p className="text-sm text-gray-500">
              Hiển thị <span className="font-medium text-gray-900">{(page - 1) * LIMIT + 1}</span>{' '}
              đến{' '}
              <span className="font-medium text-gray-900">
                {Math.min(page * LIMIT, totalItems)}
              </span>{' '}
              trong tổng số <span className="font-medium text-gray-900">{totalItems}</span> kết quả
            </p>
            <div className="flex gap-1.5">
              {totalPages >= 5 && (
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white"
                  title="Trang đầu"
                >
                  <ChevronsLeft size={16} />
                </button>
              )}
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white"
                title="Trang trước"
              >
                <ChevronLeft size={16} />
              </button>
              {(() => {
                let pages: (number | string)[] = [];
                if (totalPages <= 4) {
                  pages = Array.from({ length: totalPages }, (_, i) => i + 1);
                } else if (page <= 3) {
                  pages = [1, 2, 3, '...', totalPages];
                } else if (page >= totalPages - 2) {
                  pages = [1, '...', totalPages - 2, totalPages - 1, totalPages];
                } else {
                  pages = [1, '...', page - 1, page, page + 1, '...', totalPages];
                }

                return pages.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => typeof p === 'number' && setPage(p)}
                    disabled={p === '...'}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      p === '...'
                        ? 'text-gray-400 bg-transparent cursor-default'
                        : page === p
                          ? 'bg-[#9FE870] text-[#062F28] border border-[#9FE870]/70 font-bold shadow-sm'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                ));
              })()}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white"
                title="Trang sau"
              >
                <ChevronRight size={16} />
              </button>
              {totalPages >= 5 && (
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
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

      <ExceptionReviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        exception={selectedException}
        onSubmitReview={handleReviewSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
