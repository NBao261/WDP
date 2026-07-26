import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { RefreshCw, Plus } from 'lucide-react';
import ExceptionsList, { ExceptionData } from './components/ExceptionsList';
import ExceptionDetailDrawer from './components/ExceptionDetailDrawer';
import CreateExceptionModal from './components/CreateExceptionModal';
import {
  exceptionService,
  ExceptionType,
  EXCEPTION_TYPE_LABELS,
} from '../../../services/exception.service';
import { pricingService } from '../../../services/pricing.service';

// ─── Map API Response → ExceptionData (UI) ───────────────────────────
function mapApiException(exc: any, pricingMap?: Map<string, number>): ExceptionData {
  const session = typeof exc.sessionId === 'object' ? exc.sessionId : null;
  const staff = typeof exc.staffId === 'object' ? exc.staffId : null;
  const manager = typeof exc.managerId === 'object' && exc.managerId ? exc.managerId : null;
  const driver = typeof exc.driverId === 'object' && exc.driverId ? exc.driverId : null;
  const resolvedBy =
    typeof exc.resolvedByStaffId === 'object' && exc.resolvedByStaffId
      ? exc.resolvedByStaffId
      : null;

  let finalSurcharge = exc.surcharge || 0;
  // Nếu là mất vé và surcharge = 0, thử lấy lostCardFee từ PricingPlan
  if (exc.type === ExceptionType.LOST_CARD && finalSurcharge === 0 && session?.pricingPlanId) {
    const fee = pricingMap?.get(session.pricingPlanId.toString());
    if (fee) finalSurcharge = fee;
  }

  return {
    id: exc._id,
    code: session?.code || exc._id,
    cardCode: session?.cardCode || '—',
    plate: session?.licensePlate || '—',
    type: EXCEPTION_TYPE_LABELS[exc.type as ExceptionType] || exc.type,
    typeEnum: exc.type,
    time: new Date(exc.createdAt).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    status: exc.status.toUpperCase() as ExceptionData['status'],
    staffName: staff?.name || '—',
    resolvedByStaffName: resolvedBy?.name || null,
    staffNote: exc.staffNote || '',
    managerName: manager?.name || null,
    managerNote: exc.managerNote || null,
    surcharge: finalSurcharge,
    description: exc.description || '',
    // Session details
    vehicleType: (session?.vehicleTypeId as any)?.name || '—',
    checkInTime: session?.checkInTime
      ? new Date(session.checkInTime).toLocaleString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—',
    slotCode: (session?.slotId as any)?.code || '—',
    floorName: (session?.floorId as any)?.name || '—',
    facilityName: (session?.facilityId as any)?.name || '—',
    facilityId: (session?.facilityId as any)?._id || '',
    vehicleTypeIdStr: (session?.vehicleTypeId as any)?._id || '',
    gateIn: session?.gateIn || '—',
    sessionId: session?._id || (typeof exc.sessionId === 'string' ? exc.sessionId : ''),
    sessionStatus: session?.status || 'UNKNOWN',
    updatedAt: new Date(exc.updatedAt).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    actualPlate: exc.actualPlate,
    expectedPlate: exc.expectedPlate,
    checkInImage: exc.checkInImage,
    checkOutImage: exc.checkOutImage,
    excCardCode: exc.cardCode,
    source: exc.source,
    driverName: driver?.name || '—',
    images: exc.images || [],
  };
}

export default function ExceptionsStaffPage() {
  const [selectedException, setSelectedException] = useState<ExceptionData | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [exceptionsList, setExceptionsList] = useState<ExceptionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const navigate = useNavigate();

  const fetchExceptions = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentFacilityId = sessionStorage.getItem('staff_facility_id');
      const params: any = {
        sortBy: 'createdAt',
        sortOrder: 'desc',
        limit: 100,
        ...(currentFacilityId ? { facilityId: currentFacilityId } : {}),
      };

      // Sử dụng API thực tế thay vì mock data để có thể thấy sự cố mới tạo
      const [res, pricingRes]: [any, any] = await Promise.all([
        exceptionService.getExceptions(params),
        pricingService.getAll({ limit: 100 }),
      ]);

      const pricingMap = new Map<string, number>();
      if (pricingRes.success && pricingRes.data) {
        // Backend pagination data might be in res.data or res.data.data
        const plans = Array.isArray(pricingRes.data) ? pricingRes.data : pricingRes.data.data;
        if (Array.isArray(plans)) {
          plans.forEach((p: any) => {
            if (p._id && p.lostCardFee !== undefined) {
              pricingMap.set(p._id.toString(), p.lostCardFee);
            }
          });
        }
      }

      // Backend returns { success: true, data: [...], pagination: {...} }
      // The array is in res.data directly, not res.data.data
      const listData = Array.isArray(res.data) ? res.data : res.data?.data;

      if (res.success && listData) {
        const mappedList = listData.map((exc: any) => mapApiException(exc, pricingMap));
        setExceptionsList(mappedList);
        
        setSelectedException(prev => {
          if (!prev) return null;
          const updated = mappedList.find((e: any) => e.id === prev.id);
          return updated || prev;
        });
      }
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải danh sách sự cố!');
      setExceptionsList([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExceptions();
  }, [fetchExceptions]);

  // Search filter (client-side)
  const filteredList = exceptionsList.filter((exc) => {
    if (filterStatus !== 'ALL' && exc.status !== filterStatus) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      exc.plate.toLowerCase().includes(q) ||
      exc.code.toLowerCase().includes(q) ||
      exc.cardCode.toLowerCase().includes(q) ||
      exc.type.toLowerCase().includes(q)
    );
  });

  const handleContinueCheckout = (plate: string) => {
    navigate('/staff', { state: { plate } });
  };

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden p-4 lg:p-6">
      <div className="shrink-0 px-1 pt-1 flex justify-between items-start">
        <div>
          <h1 className="text-[25px] font-bold text-[#060606]">Xử lý sự cố</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">
            Các sự cố bạn đã báo cáo và trạng thái giải quyết.
          </p>
        </div>
        <div className="flex items-center gap-[12px]">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-[8px] px-[20px] py-[10px] rounded-[10px] bg-[#a6e676] text-[#132c20] border-none text-[16px] font-bold hover:opacity-[0.88] active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={17} />
            Tạo Sự Cố
          </button>
          <button
            onClick={fetchExceptions}
            disabled={isLoading}
            className="flex items-center gap-[8px] px-[20px] py-[10px] rounded-[10px] bg-white border-[1.5px] border-gray-200 text-[#1a1a1a] text-[16px] font-medium hover:opacity-[0.88] active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={17} className={isLoading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      <ExceptionsList
        exceptionsList={filteredList}
        isLoading={isLoading}
        searchQuery={searchQuery}
        filterStatus={filterStatus}
        onSearchChange={setSearchQuery}
        onFilterChange={setFilterStatus}
        onSelectException={setSelectedException}
        onContinueCheckout={handleContinueCheckout}
      />

      <ExceptionDetailDrawer
        selectedException={selectedException}
        onClose={() => setSelectedException(null)}
        onContinueCheckout={handleContinueCheckout}
        onResolved={fetchExceptions}
      />

      <CreateExceptionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchExceptions}
      />
    </div>
  );
}
