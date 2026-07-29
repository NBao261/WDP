import { apiClient } from './api';

export type SlotStatus = 'available' | 'occupied' | 'reserved' | 'maintenance' | 'locked';

export interface ParkingSessionPopulated {
  _id: string;
  code: string;
  licensePlate: string;
  checkInTime: string;
  checkOutTime: string | null;
  gateIn: string;
  gateOut: string;
  status: 'active' | 'pending_payment' | 'completed' | 'exception';
  totalFee: number;
  assignmentMode: 'auto' | 'manual';
  cardCode: string;
  vehicleTypeId: { _id: string; name: string; code: string; icon: string } | string;
  facilityId: { _id: string; name: string } | string;
  floorId: { _id: string; name: string } | string;
  staffInId: { _id: string; name: string; email: string } | string;
  staffOutId: { _id: string; name: string; email: string } | string | null;
  pricingPlanId: { _id: string; name: string; feeMethod?: string } | string;
  checkInImage?: string;
}

export interface ReservationInfo {
  _id: string;
  code: string;
  licensePlate: string;
  startTime: string;
  status: 'pending' | 'confirmed';
  user: { _id: string; name: string; email: string; phone?: string } | string;
}

export interface ParkingSlot {
  _id: string;
  code: string;
  floorId: string;
  facilityId: string;
  vehicleTypeId: string | { _id: string; name: string; code: string; icon: string };
  status: SlotStatus;
  currentSessionId: string | ParkingSessionPopulated | null;
  maintenanceReason: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  reservationInfo?: ReservationInfo;
}

export interface SlotListResponse {
  success: boolean;
  data: ParkingSlot[];
}

export interface CreateSlotPayload {
  code: string;
  floorId: string;
  facilityId: string;
  vehicleTypeId: string;
}

export interface CreateBulkSlotsPayload {
  facilityId: string;
  floorId: string;
  vehicleType: string;
  prefix: string;
  startNumber: number;
  count: number;
}

export interface UpdateSlotStatusPayload {
  status: SlotStatus;
  reason?: string;
}

export interface UpdateSlotPayload {
  code?: string;
  vehicleTypeId?: string;
}

export const slotService = {
  getByFloor: async (floorId: string): Promise<SlotListResponse> => {
    return apiClient.get(`/slots/floor/${floorId}`);
  },

  getById: async (id: string): Promise<{ success: boolean; data: ParkingSlot }> => {
    return apiClient.get(`/slots/${id}`);
  },

  create: async (payload: CreateSlotPayload): Promise<{ success: boolean; data: ParkingSlot }> => {
    return apiClient.post('/slots', payload);
  },

  createBulk: async (
    payload: CreateBulkSlotsPayload
  ): Promise<{ success: boolean; data: ParkingSlot[]; count: number }> => {
    return apiClient.post('/slots/bulk', payload);
  },

  updateStatus: async (
    id: string,
    payload: UpdateSlotStatusPayload
  ): Promise<{ success: boolean; data: ParkingSlot }> => {
    return apiClient.patch(`/slots/${id}/status`, payload);
  },

  update: async (
    id: string,
    payload: UpdateSlotPayload
  ): Promise<{ success: boolean; data: ParkingSlot }> => {
    return apiClient.patch(`/slots/${id}`, payload);
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    return apiClient.delete(`/slots/${id}`);
  },

  getStats: async (): Promise<{ success: boolean; data: Record<string, { occupied: number; reserved: number }> }> => {
    return apiClient.get('/slots/stats');
  },
};
