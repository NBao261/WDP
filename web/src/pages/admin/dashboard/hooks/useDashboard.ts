import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../../../../store';
import {
  reportService,
  TrafficReportData,
  RevenueReportData,
  OccupancyReportData,
  PeakHoursReportData,
} from '../../../../services/report.service';
import { userService } from '../../../../services/user.service';
import { facilityService } from '../../../../services/facility.service';
import { UserRole } from '../../../../../../shared/types';
import { format, subDays, startOfMonth, startOfYear } from 'date-fns';

export interface UserStats {
  totalAdmin: number;
  totalManager: number;
  totalStaff: number;
  totalDriver: number;
  totalFacilities: number;
}

export type TimeFilter = 'today' | 'week' | 'month' | 'year';

export const TIME_FILTER_OPTIONS = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'week', label: '7 ngày qua' },
  { value: 'month', label: 'Tháng này' },
  { value: 'year', label: 'Năm nay' },
] as const;

function getDateRange(filter: TimeFilter): {
  startDate: string;
  endDate: string;
  groupBy: 'day' | 'week' | 'month';
} {
  const now = new Date();
  const endDate = format(now, 'yyyy-MM-dd');
  switch (filter) {
    case 'today':
      return { startDate: endDate, endDate, groupBy: 'day' };
    case 'month':
      return { startDate: format(startOfMonth(now), 'yyyy-MM-dd'), endDate, groupBy: 'day' };
    case 'year':
      return { startDate: format(startOfYear(now), 'yyyy-MM-dd'), endDate, groupBy: 'month' };
    case 'week':
    default:
      return { startDate: format(subDays(now, 6), 'yyyy-MM-dd'), endDate, groupBy: 'day' };
  }
}

export function useDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('week');

  const [trafficData, setTrafficData] = useState<TrafficReportData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueReportData | null>(null);
  const [occupancyData, setOccupancyData] = useState<OccupancyReportData | null>(null);
  const [peakHoursData, setPeakHoursData] = useState<PeakHoursReportData | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [facilityIds, setFacilityIds] = useState<string[]>([]);
  const [facilityFilter, setFacilityFilter] = useState<string>('all');
  const socketRef = useRef<Socket | null>(null);

  // Fetch user & facility stats once (not time-filtered)
  const fetchSystemStats = useCallback(async () => {
    try {
      const [adminRes, managerRes, staffRes, driverRes, facilityRes] = await Promise.allSettled([
        userService.getAllUsers({ role: UserRole.ADMIN, limit: 1 }),
        userService.getAllUsers({ role: UserRole.MANAGER, limit: 1 }),
        userService.getAllUsers({ role: UserRole.STAFF, limit: 1 }),
        userService.getAllUsers({ role: UserRole.DRIVER, limit: 1 }),
        facilityService.getAll({ limit: 100 }),
      ]);
      setUserStats({
        totalAdmin: adminRes.status === 'fulfilled' ? (adminRes.value.pagination?.total ?? 0) : 0,
        totalManager: managerRes.status === 'fulfilled' ? (managerRes.value.pagination?.total ?? 0) : 0,
        totalStaff: staffRes.status === 'fulfilled' ? (staffRes.value.pagination?.total ?? 0) : 0,
        totalDriver: driverRes.status === 'fulfilled' ? (driverRes.value.pagination?.total ?? 0) : 0,
        totalFacilities: facilityRes.status === 'fulfilled' ? (facilityRes.value.pagination?.total ?? 0) : 0,
      });
      if (facilityRes.status === 'fulfilled' && facilityRes.value.data) {
        setFacilities(facilityRes.value.data);
        setFacilityIds(facilityRes.value.data.map((f: any) => f._id));
      }
    } catch (err) {
      console.error('Error fetching system stats:', err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setTrafficData(null);
    setRevenueData(null);
    setPeakHoursData(null);
    const { startDate, endDate, groupBy } = getDateRange(timeFilter);
    const facilityId = facilityFilter !== 'all' ? facilityFilter : undefined;
    try {
      const [trafficRes, revenueRes, occupancyRes, peakRes] = await Promise.allSettled([
        reportService.getTrafficReport({ startDate, endDate, groupBy, facilityId }),
        reportService.getRevenueReport({ startDate, endDate, groupBy, facilityId }),
        reportService.getOccupancyReport({ facilityId }),
        reportService.getPeakHoursReport({ startDate, endDate, facilityId }),
      ]);

      if (trafficRes.status === 'fulfilled' && trafficRes.value.success)
        setTrafficData(trafficRes.value.data);
      if (revenueRes.status === 'fulfilled' && revenueRes.value.success)
        setRevenueData(revenueRes.value.data);
      if (occupancyRes.status === 'fulfilled' && occupancyRes.value.success)
        setOccupancyData(occupancyRes.value.data);
      if (peakRes.status === 'fulfilled' && peakRes.value.success)
        setPeakHoursData(peakRes.value.data);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      toast.error(error.message || 'Lỗi khi tải dữ liệu thống kê');
    } finally {
      setIsLoading(false);
    }
  }, [timeFilter, facilityFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const socketUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');
    const socket = io(socketUrl, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: {
        token: useAuthStore.getState().token
      }
    });
    socketRef.current = socket;

    socket.on('slot:statusChanged', () => {
      fetchData();
    });
    
    socket.on('payment:completed', () => {
      fetchData();
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchData]);

  useEffect(() => {
    if (socketRef.current && socketRef.current.connected && facilityIds.length > 0) {
      facilityIds.forEach(id => {
        socketRef.current?.emit('join:facility', id);
      });
    }
  }, [facilityIds]);

  useEffect(() => {
    fetchSystemStats();
  }, [fetchSystemStats]);

  return {
    isLoading,
    timeFilter,
    setTimeFilter,
    trafficData,
    revenueData,
    occupancyData,
    peakHoursData,
    userStats,
    facilities,
    facilityFilter,
    setFacilityFilter,
    fetchData,
  };
}
