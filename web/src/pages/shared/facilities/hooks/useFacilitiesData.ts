import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { facilityService, Facility } from '../../../../services/facility.service';
import { floorService, Floor } from '../../../../services/floor.service';
import { vehicleTypeService, VehicleType } from '../../../../services/vehicleType.service';
import { slotService, type ParkingSlot } from '../../../../services/slot.service';
import { type FloorSlotStats } from '../components/FloorCard';
import { useAuthStore } from '../../../../store/useAuthStore';
import { AssignedFacility } from '../../../../types/user.types';

export function useFacilitiesData() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'manager';
  const assignedFacilityIds = useMemo(() => {
    if (!isManager || !user?.assignedFacilities) return null;
    return new Set(
      (user.assignedFacilities as AssignedFacility[]).map((f) => f._id)
    );
  }, [isManager, user?.assignedFacilities]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [allSlots, setAllSlots] = useState<ParkingSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewFacility, setViewFacility] = useState<Facility | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Modals / Details state
  const [detailFacility, setDetailFacility] = useState<Facility | null>(null);
  const [mapFloor, setMapFloor] = useState<Floor | null>(null);
  const [mapSlots, setMapSlots] = useState<ParkingSlot[]>([]);
  const [mapLoading, setMapLoading] = useState(false);

  // ── Fetching Data ───────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [fRes, flRes, vtRes] = await Promise.all([
        facilityService.getAll({ limit: 100 }),
        floorService.getAll({ limit: 100 }),
        vehicleTypeService.getAll({ limit: 100 }),
      ]);
      const fetchedFloors = flRes.data;

      // Manager: chỉ hiển thị tòa nhà được phân công
      const scopedFacilities = assignedFacilityIds
        ? fRes.data.filter((f: Facility) => assignedFacilityIds.has(f._id))
        : fRes.data;
      const scopedFacilityIds = new Set(scopedFacilities.map((f: Facility) => f._id));
      const scopedFloors = fetchedFloors.filter(
        (fl: Floor) => scopedFacilityIds.has(fl.facilityId)
      );

      setFacilities(scopedFacilities);
      setFloors(scopedFloors);
      setVehicleTypes(vtRes.data);

        if (fetchedFloors.length > 0) {
          try {
            const slotResults = await Promise.all(
              fetchedFloors.map((fl: Floor) =>
                slotService.getByFloor(fl._id).catch(() => ({ data: [] as ParkingSlot[] }))
              )
            );
            const slots = slotResults.flatMap((r: { data: ParkingSlot[] }) => r.data);
            setAllSlots(slots);

            // Keep mapFloor and mapSlots in sync if currently viewing map
            setMapFloor((prevFloor) => {
              if (prevFloor) {
                setMapSlots(
                  slots
                    .filter((s) => s.floorId === prevFloor._id)
                    .sort((a, b) =>
                      a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' })
                    )
                );
                return fetchedFloors.find((f: Floor) => f._id === prevFloor._id) || prevFloor;
              }
              return null;
            });
          } catch {
            setAllSlots([]);
          }
        } else {
          setAllSlots([]);
        }

        if (!silent) setIsLoading(false);
      } catch (err: any) {
        toast.error(err.message || 'Lỗi tải dữ liệu');
        if (!silent) setIsLoading(false);
      }
    },
    [assignedFacilityIds]
  );

  useEffect(() => {
    fetchAll();

    const socketUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');
    const socket = io(socketUrl, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      // Admin might not have assignedFacilityIds (meaning all facilities), 
      // but for managers we join specific ones. For admin, we could listen to a global event if we had one.
      // But we can join all loaded facilities once they are loaded.
    });

    socket.on('slot:statusChanged', () => {
      fetchAll(true);
    });
    
    socket.on('facility:updated', () => {
      fetchAll(true);
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchAll]);

  // Join rooms when facilities load
  useEffect(() => {
    if (socketRef.current && socketRef.current.connected && facilities.length > 0) {
      facilities.forEach(f => {
        socketRef.current?.emit('join:facility', f._id);
      });
    }
  }, [facilities]);

  // Fast polling only for the currently viewed mapFloor - REMOVED
  // Instead, the global socket listener above triggers fetchAll(true) which syncs all slots.
  // To avoid heavy loads on every single slot change, we might want to just fetch slots for the viewed floor, 
  // but since we only have ~100s slots, fetchAll(true) is acceptable. 
  // For better map real-time performance without full fetch:
  useEffect(() => {
    if (!mapFloor || !socketRef.current) return;
    
    const handleSlotChange = (data: any) => {
      // If the changed slot belongs to the current mapFloor, we can update just that slot
      if (data.facilityId === mapFloor.facilityId) {
         // fetchAll is already triggered globally, but we can also do a quick localized fetch if needed.
         // Actually fetchAll(true) handles syncing mapSlots already!
      }
    };
    
    socketRef.current.on('slot:statusChanged', handleSlotChange);
    return () => {
      socketRef.current?.off('slot:statusChanged', handleSlotChange);
    };
  }, [mapFloor]);

  const refreshFloors = useCallback(async () => {
    try {
      const flRes = await floorService.getAll({ limit: 100 });
      setFloors(flRes.data);
      setMapFloor((prevFloor) => {
        if (prevFloor) {
          return flRes.data.find((f: Floor) => f._id === prevFloor._id) || prevFloor;
        }
        return null;
      });
    } catch {
      // ignore
    }
  }, []);

  // ── Derived Stats ───────────────────────────────────────────────────────────
  const slotStatsByFloor = useMemo<Record<string, FloorSlotStats>>(() => {
    const map: Record<string, FloorSlotStats> = {};
    const byFloor: Record<string, ParkingSlot[]> = {};
    for (const slot of allSlots) {
      if (!byFloor[slot.floorId]) byFloor[slot.floorId] = [];
      byFloor[slot.floorId].push(slot);
    }
    for (const floor of floors) {
      const floorSlots = byFloor[floor._id] ?? [];
      const total = floor.totalSlots || floorSlots.length;
      const occupied = floorSlots.filter((s) => s.status === 'occupied').length;
      const reserved = floorSlots.filter((s) => s.status === 'reserved').length;
      const fillRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
      map[floor._id] = { total, occupied, reserved, fillRate };
    }
    return map;
  }, [allSlots, floors]);

  const facilityStats = useMemo<
    Record<string, { totalSlots: number; occupied: number; reserved: number; fillRate: number }>
  >(() => {
    const map: Record<
      string,
      { totalSlots: number; occupied: number; reserved: number; fillRate: number }
    > = {};
    for (const facility of facilities) {
      const facilityFloors = floors.filter((f) => f.facilityId === facility._id);
      const totalSlots = facilityFloors.reduce(
        (sum, f) => sum + (slotStatsByFloor[f._id]?.total ?? 0),
        0
      );
      const occupied = facilityFloors.reduce(
        (sum, f) => sum + (slotStatsByFloor[f._id]?.occupied ?? 0),
        0
      );
      const reserved = facilityFloors.reduce(
        (sum, f) => sum + (slotStatsByFloor[f._id]?.reserved ?? 0),
        0
      );
      const fillRate = totalSlots > 0 ? Math.round((occupied / totalSlots) * 100) : 0;
      map[facility._id] = { totalSlots, occupied, reserved, fillRate };
    }
    return map;
  }, [facilities, floors, slotStatsByFloor]);

  const detailFacilityVehicleTypes = useMemo(() => {
    if (!detailFacility) return [];
    const facilityFloors = floors.filter((f) => f.facilityId === detailFacility._id);
    const vtIds = new Set<string>();
    facilityFloors.forEach((fl) => {
      fl.allowedVehicleTypes?.forEach((vt: any) => {
        vtIds.add(typeof vt === 'string' ? vt : vt._id);
      });
    });
    return Array.from(vtIds)
      .map((id) => vehicleTypes.find((v) => v._id === id))
      .filter(Boolean) as VehicleType[];
  }, [detailFacility, floors, vehicleTypes]);

  // ── Filters & Pagination ────────────────────────────────────────────────────
  const filteredFacilities = useMemo(() => {
    return facilities.filter((f) => {
      if (
        search.trim() &&
        !f.name.toLowerCase().includes(search.toLowerCase()) &&
        !f.address.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      if (statusFilter !== 'all' && f.status !== statusFilter) return false;

      if (vehicleFilter !== 'all') {
        const facilityFloors = floors.filter((fl) => fl.facilityId === f._id);
        const hasVehicle = facilityFloors.some((fl) =>
          fl.allowedVehicleTypes?.some(
            (vt: any) => (typeof vt === 'string' ? vt : vt._id) === vehicleFilter
          )
        );
        if (!hasVehicle) return false;
      }
      return true;
    });
  }, [facilities, search, statusFilter, vehicleFilter, floors]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, vehicleFilter]);

  const paginatedFacilities = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredFacilities.slice(start, start + itemsPerPage);
  }, [filteredFacilities, currentPage]);

  const totalPages = Math.ceil(filteredFacilities.length / itemsPerPage);
  const filteredFloors = viewFacility
    ? floors.filter((f) => f.facilityId === viewFacility._id)
    : [];

  // ── Handlers ────────────────────────────────────────────────────────────────
  const updateFacilityLocal = useCallback((updated: Facility) => {
    setFacilities((prev: Facility[]) => prev.map((f) => (f._id === updated._id ? updated : f)));
    setViewFacility((prev: Facility | null) => (prev && prev._id === updated._id ? updated : prev));

    // Đồng bộ trạng thái của các tầng thuộc cơ sở này
    if (updated.status === 'inactive') {
      setFloors((prev: Floor[]) =>
        prev.map((f) => (f.facilityId === updated._id ? { ...f, status: 'inactive' } : f))
      );
    } else if (updated.status === 'active') {
      setFloors((prev: Floor[]) =>
        prev.map((f) => (f.facilityId === updated._id ? { ...f, status: 'active' } : f))
      );
    }
  }, []);

  const removeFacilityLocal = useCallback((id: string) => {
    setFacilities((prev: Facility[]) => prev.filter((f) => f._id !== id));
    setFloors((prev: Floor[]) => prev.filter((f) => f.facilityId !== id));
    setViewFacility((prev: Facility | null) => (prev && prev._id === id ? null : prev));
  }, []);

  const updateFloorLocal = useCallback((updated: Floor) => {
    setFloors((prev: Floor[]) => prev.map((f) => (f._id === updated._id ? updated : f)));
    setMapFloor((prev: Floor | null) => (prev && prev._id === updated._id ? updated : prev));
  }, []);

  const removeFloorLocal = useCallback((id: string) => {
    setFloors((prev: Floor[]) => prev.filter((f) => f._id !== id));
    setAllSlots((prev: ParkingSlot[]) => prev.filter((s) => s.floorId !== id));
    setMapFloor((prev: Floor | null) => (prev && prev._id === id ? null : prev));
  }, []);

  const handleViewMap = useCallback(async (floor: Floor) => {
    setMapFloor(floor);
    setMapLoading(true);
    try {
      const res = await slotService.getByFloor(floor._id);
      const sorted = res.data.sort((a: ParkingSlot, b: ParkingSlot) =>
        a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' })
      );
      setMapSlots(sorted);
      setTimeout(() => {
        document.getElementById('slot-editor')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch {
      toast.error('Lỗi tải dữ liệu slot');
    } finally {
      setMapLoading(false);
    }
  }, []);

  return {
    facilities,
    setFacilities,
    floors,
    setFloors,
    vehicleTypes,
    setVehicleTypes,
    allSlots,
    setAllSlots,
    isLoading,
    isManager,

    // Filters & Pagination
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    vehicleFilter,
    setVehicleFilter,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    paginatedFacilities,
    totalPages,
    totalFiltered: filteredFacilities.length,

    // Stats
    slotStatsByFloor,
    facilityStats,

    // Views & Modals
    viewFacility,
    setViewFacility,
    detailFacility,
    setDetailFacility,
    detailFacilityVehicleTypes,
    mapFloor,
    setMapFloor,
    mapSlots,
    setMapSlots,
    mapLoading,
    setMapLoading,
    filteredFloors,

    // Handlers
    fetchAll,
    refreshFloors,
    updateFacilityLocal,
    removeFacilityLocal,
    updateFloorLocal,
    removeFloorLocal,
    handleViewMap,
  };
}
