import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { FacilityFormModal } from './components/FacilityFormModal';
import { FloorFormModal } from './components/FloorFormModal';
import { FacilityCard, FacilityListItem } from './components/FacilityCard';
import { FacilityDetailModal } from './components/FacilityDetailModal';
import { SlotMappingEditorView } from './components/SlotMappingEditorView';
import { useFacilitiesData } from './hooks/useFacilitiesData';
import { FacilityFilterBar } from './components/FacilityFilterBar';
import { FacilityFloorsView } from './components/FacilityFloorsView';
import { slotService, type ParkingSlot } from '../../../services/slot.service';
import { toast } from 'sonner';
import { Facility } from '../../../services/facility.service';
import { Floor } from '../../../services/floor.service';
import { vehicleTypeService } from '../../../services/vehicleType.service';

import { PageLoader } from '../../../components/PageLoader';

export default function FacilitiesPage() {
  const data = useFacilitiesData();
  const location = useLocation();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Nếu navigate từ dashboard với selectedFacilityId, tự mở view quản lý tầng
  useEffect(() => {
    const state = location.state as { selectedFacilityId?: string } | null;
    if (state?.selectedFacilityId && data.facilities.length > 0) {
      const facility = data.facilities.find((f) => f._id === state.selectedFacilityId);
      if (facility) {
        data.setViewFacility(facility);
        // Xóa state để không trigger lại khi re-render
        window.history.replaceState({}, '');
      }
    }
  }, [location.state, data.facilities]);

  // Modals state
  const [isFacilityModalOpen, setIsFacilityModalOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | undefined>();
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
  const [editingFloor, setEditingFloor] = useState<Floor | undefined>();
  const vtMap = Object.fromEntries(data.vehicleTypes.map((v) => [v._id, v.name]));

  return (
    <div className="space-y-6 pb-12">
      {/* ══ View 1: Facility List ══ */}
      {!data.viewFacility && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-5"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <div>
              <h1 className="text-2xl font-bold text-[#060606]">Tòa nhà & Bãi đỗ</h1>
              <p className="text-gray-400 text-sm">
                Quản lý các tòa nhà và bãi đỗ xe trong hệ thống
              </p>
            </div>
            {!data.isManager && (
              <button
                onClick={() => {
                  setEditingFacility(undefined);
                  setIsFacilityModalOpen(true);
                }}
                className="bg-[#062F28] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#062F28]/80 transition-colors flex items-center gap-2 shadow-sm self-start sm:self-auto"
              >
                <Plus size={20} /> Thêm Tòa Nhà
              </button>
            )}
          </div>

          <FacilityFilterBar
            search={data.search}
            setSearch={data.setSearch}
            statusFilter={data.statusFilter}
            setStatusFilter={data.setStatusFilter}
            viewMode={viewMode}
            setViewMode={setViewMode}
          />

          {data.isLoading ? (
            <PageLoader />
          ) : data.paginatedFacilities.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] py-20 flex flex-col items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white border-[1.5px] border-[#f0f0f0]"
              >
                <Building2 size={28} className="text-[#9FE870]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[#060606]">Không tìm thấy cơ sở nào</p>
                <p className="text-xs text-gray-400 mt-1">
                  Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm
                </p>
              </div>
              <button
                onClick={() => {
                  data.setSearch('');
                  data.setStatusFilter('all');
                }}
                className="bg-gray-100 text-[#062F28] font-medium px-5 py-2.5 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Xóa bộ lọc
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.paginatedFacilities.map((facility) => (
                <FacilityCard
                  key={facility._id}
                  facility={facility}
                  stats={data.facilityStats[facility._id]}
                  onEdit={(f) => {
                    setEditingFacility(f);
                    setIsFacilityModalOpen(true);
                  }}
                  onViewFloors={(f) => {
                    data.setViewFacility(f);
                    data.setMapFloor(null);
                  }}
                  onUpdate={data.updateFacilityLocal}
                  onRemove={data.removeFacilityLocal}
                  onViewDetail={data.setDetailFacility}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {data.paginatedFacilities.map((facility) => (
                <FacilityListItem
                  key={facility._id}
                  facility={facility}
                  stats={data.facilityStats[facility._id]}
                  onViewFloors={(f) => {
                    data.setViewFacility(f);
                    data.setMapFloor(null);
                  }}
                  onViewDetail={data.setDetailFacility}
                />
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {data.totalFiltered > 0 && data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-100">
              <span className="text-sm text-gray-500">
                Hiển thị{' '}
                <span className="font-medium text-gray-900">
                  {(data.currentPage - 1) * data.itemsPerPage + 1}
                </span>{' '}
                đến{' '}
                <span className="font-medium text-gray-900">
                  {Math.min(data.currentPage * data.itemsPerPage, data.totalFiltered)}
                </span>{' '}
                trong tổng số{' '}
                <span className="font-medium text-gray-900">{data.totalFiltered}</span> kết quả
              </span>
              <div className="flex gap-1.5">
                {data.totalPages >= 5 && (
                  <button
                    onClick={() => data.setCurrentPage(1)}
                    disabled={data.currentPage === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white"
                    title="Trang đầu"
                  >
                    <ChevronsLeft size={16} />
                  </button>
                )}
                <button
                  onClick={() => data.setCurrentPage((p: number) => Math.max(1, p - 1))}
                  disabled={data.currentPage === 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white"
                  title="Trang trước"
                >
                  <ChevronLeft size={16} />
                </button>
                {(() => {
                  let pages: (number | string)[] = [];
                  if (data.totalPages <= 4) {
                    pages = Array.from({ length: data.totalPages }, (_, i) => i + 1);
                  } else if (data.currentPage <= 3) {
                    pages = [1, 2, 3, '...', data.totalPages];
                  } else if (data.currentPage >= data.totalPages - 2) {
                    pages = [1, '...', data.totalPages - 2, data.totalPages - 1, data.totalPages];
                  } else {
                    pages = [
                      1,
                      '...',
                      data.currentPage - 1,
                      data.currentPage,
                      data.currentPage + 1,
                      '...',
                      data.totalPages,
                    ];
                  }

                  return pages.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => typeof p === 'number' && data.setCurrentPage(p)}
                      disabled={p === '...'}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${p === '...'
                        ? 'text-gray-400 bg-transparent cursor-default'
                        : data.currentPage === p
                          ? 'bg-[#062F28] text-white font-bold shadow-sm'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      {p}
                    </button>
                  ));
                })()}
                <button
                  onClick={() =>
                    data.setCurrentPage((p: number) => Math.min(data.totalPages, p + 1))
                  }
                  disabled={data.currentPage === data.totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white"
                  title="Trang sau"
                >
                  <ChevronRight size={16} />
                </button>
                {data.totalPages >= 5 && (
                  <button
                    onClick={() => data.setCurrentPage(data.totalPages)}
                    disabled={data.currentPage === data.totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white"
                    title="Trang cuối"
                  >
                    <ChevronsRight size={16} />
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ══ View 2: Floor List for a Facility ══ */}
      {data.viewFacility && !data.mapFloor && (
        <FacilityFloorsView
          viewFacility={data.viewFacility}
          setViewFacility={data.setViewFacility}
          filteredFloors={data.filteredFloors}
          vehicleTypes={data.vehicleTypes}
          facilityStats={data.facilityStats}
          slotStatsByFloor={data.slotStatsByFloor}
          isLoading={data.isLoading}
          setEditingFloor={setEditingFloor}
          setIsFloorModalOpen={setIsFloorModalOpen}
          handleEditMapping={(f) => {
            setEditingFloor(f);
            setIsFloorModalOpen(true);
          }}
          updateFloorLocal={data.updateFloorLocal}
          removeFloorLocal={data.removeFloorLocal}
          fetchAll={data.fetchAll}
          handleViewMap={data.handleViewMap}
        />
      )}

      {/* ══ View 3: Slot Mapping Editor Inline ══ */}
      {data.mapFloor && data.viewFacility && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          id="slot-editor"
        >
          <SlotMappingEditorView
            floor={data.mapFloor}
            slots={data.mapSlots}
            vtMap={vtMap}
            vehicleTypes={data.vehicleTypes}
            loading={data.mapLoading}
            isFacilityActive={data.viewFacility.status !== 'inactive'}
            onRefreshSlots={async (silent = false) => {
              if (!silent) data.setMapLoading(true);
              try {
                const [res, vtRes] = await Promise.all([
                  slotService.getByFloor(data.mapFloor!._id),
                  vehicleTypeService.getAll({ limit: 100 }),
                ]);
                data.setVehicleTypes(vtRes.data);

                const sorted = res.data.sort((a, b) =>
                  a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' })
                );
                data.setMapSlots(sorted);
                data.setAllSlots((prev: ParkingSlot[]) => [
                  ...prev.filter((s) => s.floorId !== data.mapFloor!._id),
                  ...sorted,
                ]);
              } catch {
                toast.error('Lỗi tải dữ liệu');
              } finally {
                if (!silent) data.setMapLoading(false);
              }
            }}
            onClose={() => data.setMapFloor(null)}
          />
        </motion.div>
      )}

      {/* ── Modals ── */}
      <FacilityFormModal
        isOpen={isFacilityModalOpen}
        onClose={() => setIsFacilityModalOpen(false)}
        facility={editingFacility}
        onSuccess={data.fetchAll}
      />

      <FacilityDetailModal
        isOpen={!!data.detailFacility}
        onClose={() => data.setDetailFacility(null)}
        facility={data.detailFacility ?? undefined}
        stats={data.detailFacility ? data.facilityStats[data.detailFacility._id] : undefined}
        currentFloors={
          data.detailFacility
            ? data.floors.filter((f) => f.facilityId === data.detailFacility!._id).length
            : 0
        }
        vehicleTypes={data.detailFacilityVehicleTypes}
        allVehicleTypes={data.vehicleTypes}
      />

      {data.viewFacility && (
        <FloorFormModal
          isOpen={isFloorModalOpen}
          onClose={() => {
            setIsFloorModalOpen(false);
            setEditingFloor(undefined);
          }}
          floor={editingFloor}
          facilityId={data.viewFacility._id}
          vehicleTypes={data.vehicleTypes}
          onSuccess={() => data.fetchAll(true)}
          currentFloorCount={data.filteredFloors.length}
          maxFloors={data.viewFacility.totalFloors}
        />
      )}
    </div>
  );
}
