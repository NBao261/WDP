import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Building2, MapPin, Plus, Clock, Layers } from 'lucide-react';
import { Facility } from '../../../../services/facility.service';
import { Floor } from '../../../../services/floor.service';
import { VehicleType } from '../../../../services/vehicleType.service';
import { FloorGrid, type FloorSlotStats } from './FloorCard';
import { FloorDetailModal } from './FloorDetailModal';

interface FacilityFloorsViewProps {
  viewFacility: Facility;
  setViewFacility: (f: Facility | null) => void;
  filteredFloors: Floor[];
  vehicleTypes: VehicleType[];
  facilityStats: Record<string, { totalSlots: number; occupied: number; fillRate: number }>;
  slotStatsByFloor: Record<string, FloorSlotStats>;
  isLoading: boolean;
  setEditingFloor: (f: Floor | undefined) => void;
  setIsFloorModalOpen: (b: boolean) => void;
  handleEditMapping: (f: Floor) => void;
  updateFloorLocal: (f: Floor) => void;
  removeFloorLocal: (id: string) => void;
  fetchAll: () => void;
  handleViewMap: (f: Floor) => void;
}

export function FacilityFloorsView({
  viewFacility,
  setViewFacility,
  filteredFloors,
  vehicleTypes,
  facilityStats,
  slotStatsByFloor,
  isLoading,
  setEditingFloor,
  setIsFloorModalOpen,
  handleEditMapping,
  updateFloorLocal,
  removeFloorLocal,
  fetchAll,
  handleViewMap,
}: FacilityFloorsViewProps) {
  const [detailFloor, setDetailFloor] = useState<Floor | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-5"
    >
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Back button */}
          <button
            onClick={() => setViewFacility(null)}
            className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-[#f4fbe9]"
            style={{ borderColor: '#9FE870', color: '#062F28', background: 'white' }}
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#062F28] flex items-center gap-2">
              <Building2 size={20} style={{ color: '#062F28' }} />
              {viewFacility.name}
            </h1>
            <p className="text-gray-400 text-sm flex items-center gap-1 mt-0.5">
              <MapPin size={11} /> {viewFacility.address}
            </p>
          </div>
        </div>
        {viewFacility.status !== 'inactive' && (
          <button
            onClick={() => {
              setEditingFloor(undefined);
              setIsFloorModalOpen(true);
            }}
            className="bg-[#062F28] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#062F28]/80 transition-colors flex items-center gap-2 shadow-sm self-start sm:self-auto"
          >
            <Plus size={20} /> Thêm Tầng
          </button>
        )}
      </div>

      {/* Facility summary strip */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] px-5 py-3.5 flex flex-wrap items-center gap-5">
        <div className="flex items-center gap-1.5 text-[14px] font-medium text-gray-500">
          <Clock size={16} /> Thời gian hoạt động: {viewFacility.openTime} –{' '}
          {viewFacility.closeTime}
        </div>
        <div
          className="flex items-center gap-1.5 text-[14px] font-medium text-gray-500"
          title={`Cơ sở này giới hạn tối đa ${viewFacility.totalFloors} tầng`}
        >
          <Layers size={16} /> {filteredFloors.length}/{viewFacility.totalFloors} tầng
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-[14px] font-medium tabular-nums text-gray-500">
            {facilityStats[viewFacility._id]?.occupied || 0}/
            {facilityStats[viewFacility._id]?.totalSlots || 0} đang dùng
          </span>
          <div className="flex items-center gap-2">
            <div
              style={{
                width: 100,
                background: '#eff0ef',
                height: 8,
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${facilityStats[viewFacility._id]?.fillRate || 0}%`,
                  height: '100%',
                  background:
                    (facilityStats[viewFacility._id]?.fillRate || 0) > 85
                      ? '#E24B4A'
                      : (facilityStats[viewFacility._id]?.fillRate || 0) >= 60
                        ? '#BA7517'
                        : '#3B6D11',
                  borderRadius: 999,
                }}
              />
            </div>
            <span
              className="text-sm tabular-nums font-bold"
              style={{
                color:
                  (facilityStats[viewFacility._id]?.fillRate || 0) > 85
                    ? '#E24B4A'
                    : (facilityStats[viewFacility._id]?.fillRate || 0) >= 60
                      ? '#BA7517'
                      : '#3B6D11',
              }}
            >
              {facilityStats[viewFacility._id]?.fillRate || 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Floor cards - grouped list view */}
      <FloorGrid
        isLoading={isLoading}
        floors={filteredFloors}
        vehicleTypes={vehicleTypes}
        slotStats={slotStatsByFloor}
        onAddFloor={() => {
          setEditingFloor(undefined);
          setIsFloorModalOpen(true);
        }}
        onEditFloor={handleEditMapping}
        onViewFloor={setDetailFloor}
        onUpdate={updateFloorLocal}
        onRemove={removeFloorLocal}
        onRefresh={fetchAll}
        onViewMap={handleViewMap}
        onViewDetail={setDetailFloor}
        isFacilityActive={viewFacility.status !== 'inactive'}
      />

      <FloorDetailModal
        isOpen={!!detailFloor}
        onClose={() => setDetailFloor(null)}
        floor={detailFloor || undefined}
        stats={detailFloor ? slotStatsByFloor[detailFloor._id] : undefined}
        vehicleTypes={
          detailFloor
            ? vehicleTypes.filter((vt) =>
                (detailFloor.allowedVehicleTypes || []).some(
                  (item: any) => (typeof item === 'string' ? item : item._id) === vt._id
                )
              )
            : []
        }
      />
    </motion.div>
  );
}
