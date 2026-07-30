import { apiClient } from './api';
import { VehicleType } from './vehicleType.service';

export interface Facility {
  _id: string;
  name: string;
  address: string;
  totalFloors: number;
  openTime: string;
  closeTime: string;
  description: string;
  images: string[];
  location?: {
    type: string;
    coordinates: [number, number];
  };
  status: 'active' | 'inactive';
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OperationsConfig {
  facilityId: string;
  allowedVehicleTypes: VehicleType[];
}

export interface FacilityListResponse {
  success: boolean;
  data: Facility[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface CreateFacilityPayload {
  name: string;
  address: string;
  totalFloors: number;
  openTime: string;
  closeTime: string;
  description?: string;
  latitude: number;
  longitude: number;
}

export interface UpdateFacilityPayload {
  name?: string;
  address?: string;
  totalFloors?: number;
  openTime?: string;
  closeTime?: string;
  description?: string;
  status?: 'active' | 'inactive';
  latitude?: number;
  longitude?: number;
}

export const facilityService = {
  getAll: async (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<FacilityListResponse> => {
    return apiClient.get('/facilities', { params });
  },

  getById: async (id: string): Promise<{ success: boolean; data: Facility }> => {
    return apiClient.get(`/facilities/${id}`);
  },

  create: async (payload: CreateFacilityPayload): Promise<{ success: boolean; data: Facility }> => {
    return apiClient.post('/facilities', payload);
  },

  update: async (
    id: string,
    payload: UpdateFacilityPayload
  ): Promise<{ success: boolean; data: Facility }> => {
    return apiClient.patch(`/facilities/${id}`, payload);
  },

  deactivate: async (id: string): Promise<{ success: boolean; data: Facility }> => {
    return apiClient.patch(`/facilities/${id}`, { status: 'inactive' });
  },

  deleteFacility: async (id: string): Promise<{ success: boolean }> => {
    return apiClient.delete(`/facilities/${id}`);
  },

  /**
   * BFF endpoint: Lấy cấu hình vận hành của Toà nhà dành cho Staff
   * Trả về danh sách loại xe được phép, đã được Backend tổng hợp từ cấu hình các Tầng.
   */
  getOperationsConfig: async (
    id: string
  ): Promise<{ success: boolean; data: OperationsConfig }> => {
    return apiClient.get(`/facilities/${id}/operations-config`);
  },
};
