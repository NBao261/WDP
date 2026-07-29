import { apiClient } from './api';

// ─── Filter Interfaces ────────────────────────────────

export interface TrafficFilter {
  facilityId?: string;
  floorId?: string;
  vehicleTypeId?: string;
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}

export interface RevenueFilter {
  facilityId?: string;
  vehicleTypeId?: string;
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}

export interface OccupancyFilter {
  facilityId?: string;
  vehicleTypeId?: string;
}

export interface PeakHoursFilter {
  facilityId?: string;
  vehicleTypeId?: string;
  startDate?: string;
  endDate?: string;
}

// ─── Response Interfaces ──────────────────────────────

export interface TrafficDataPoint {
  label: string;
  checkIn: number;
  checkOut: number;
}

export interface TrafficReportData {
  groupBy: string;
  summary: {
    totalCheckIn: number;
    totalCheckOut: number;
    currentlyParked: number;
  };
  data: TrafficDataPoint[];
}

export interface RevenueDataPoint {
  label: string;
  totalRevenue: number;
  transactionCount: number;
  avgRevenue: number;
}

export interface RevenueByMethod {
  method: string;
  totalRevenue: number;
  count: number;
}

export interface RevenueByVehicleType {
  vehicleTypeId: string;
  vehicleTypeName: string;
  totalRevenue: number;
  count: number;
}

export interface RevenueReportData {
  groupBy: string;
  summary: {
    grandTotal: number;
    totalTransactions: number;
    avgRevenuePerDay: number;
    avgRevenuePeriod: number;
    periodLabel: string;  // 'ngày' | 'tháng' | 'tuần'
  };
  byTimePeriod: RevenueDataPoint[];
  byMethod: RevenueByMethod[];
  byVehicleType: RevenueByVehicleType[];
}

export interface OccupancyFloor {
  floorId: string;
  floorName: string;
  facilityId: string;
  facilityName: string;
  total: number;
  occupied: number;
  reserved: number;
  available: number;
  maintenance: number;
  locked: number;
  occupancyRate: number;
  effectiveOccupancy: number;
}

export interface OccupancyReportData {
  summary: {
    totalSlots: number;
    totalOccupied: number;
    totalReserved: number;
    totalAvailable: number;
    overallOccupancyRate: number;
    overallEffectiveOccupancy: number;
  };
  byFloor: OccupancyFloor[];
}

export interface PeakHourDataPoint {
  hour: number;
  label: string;
  checkIn: number;
  checkOut: number;
  totalActivity: number;
}

export interface PeakHourSummaryItem {
  hour: number;
  label: string;
  totalActivity: number;
  checkIn: number;
  checkOut: number;
}

export interface PeakHoursReportData {
  summary: {
    totalActivity: number;
    avgActivityPerHour: number;
    peakHours: PeakHourSummaryItem[];
  };
  hourlyDistribution: PeakHourDataPoint[];
}

// ─── Service ──────────────────────────────────────────

export const reportService = {
  getTrafficReport: async (
    params?: TrafficFilter
  ): Promise<{ success: boolean; data: TrafficReportData }> => {
    return apiClient.get('/reports/traffic', { params });
  },

  getRevenueReport: async (
    params?: RevenueFilter
  ): Promise<{ success: boolean; data: RevenueReportData }> => {
    return apiClient.get('/reports/revenue', { params });
  },

  getOccupancyReport: async (
    params?: OccupancyFilter
  ): Promise<{ success: boolean; data: OccupancyReportData }> => {
    return apiClient.get('/reports/occupancy', { params });
  },

  getPeakHoursReport: async (
    params?: PeakHoursFilter
  ): Promise<{ success: boolean; data: PeakHoursReportData }> => {
    return apiClient.get('/reports/peak-hours', { params });
  },

  exportReport: async (params: {
    reportType: 'traffic' | 'revenue' | 'occupancy' | 'peak-hours' | 'comprehensive';
    format: 'excel' | 'pdf';
    facilityId?: string;
    startDate?: string;
    endDate?: string;
    groupBy?: string;
  }): Promise<Blob> => {
    const response = await apiClient.get('/reports/export', {
      params,
      responseType: 'blob',
      // Override the default response interceptor for blob responses
      transformResponse: undefined,
    });
    // apiClient interceptor returns response.data, but with blob we need the raw response
    return response as unknown as Blob;
  },
};
