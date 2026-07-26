import { apiClient } from './api';

// ─── Enums (mirror backend exception.model.ts) ───────────────────────────────
export enum ExceptionType {
  LOST_CARD = 'lost_card',
  WRONG_PLATE = 'wrong_plate',
  WRONG_FEE = 'wrong_fee',
  OVERTIME = 'overtime',
  WRONG_ZONE = 'wrong_zone',
  UNPAID = 'unpaid',
  OTHER = 'other',
}

export enum ExceptionStatus {
  NEW = 'new',
  PROCESSING = 'processing',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

// ─── Label map: hiển thị tiếng Việt → enum value gửi lên BE ─────────────────
export const EXCEPTION_TYPE_LABELS: Record<ExceptionType, string> = {
  [ExceptionType.LOST_CARD]: 'Mất vé / Mất thẻ',
  [ExceptionType.WRONG_PLATE]: 'Sai biển số',
  [ExceptionType.WRONG_FEE]: 'Sai phí gửi xe',
  [ExceptionType.OVERTIME]: 'Xe quá giờ',
  [ExceptionType.WRONG_ZONE]: 'Sai khu vực đỗ',
  [ExceptionType.UNPAID]: 'Chưa thanh toán',
  [ExceptionType.OTHER]: 'Lỗi khác',
};

export const EXCEPTION_STATUS_LABELS: Record<ExceptionStatus, string> = {
  [ExceptionStatus.NEW]: 'Mới',
  [ExceptionStatus.PROCESSING]: 'Đang xử lý',
  [ExceptionStatus.RESOLVED]: 'Đã giải quyết',
  [ExceptionStatus.REJECTED]: 'Từ chối',
};

// ─── Types ───────────────────────────────────────────────────────────────────
export interface IException {
  _id: string;
  sessionId:
    | {
        _id: string;
        code: string;
        licensePlate: string;
        checkInTime: string;
        gateIn: string;
        vehicleTypeId?: { name: string; code: string };
        slotId?: { code: string };
        floorId?: { name: string };
        facilityId?: { _id: string; name: string };
      }
    | string;
  type: ExceptionType;
  description: string;
  source?: 'staff' | 'driver' | 'system';
  driverId?: { _id: string; name: string; email: string; phone?: string } | string;
  staffId?: { _id: string; name: string; email: string } | string;
  resolvedByStaffId?: { _id: string; name: string; email: string } | string;
  staffNote?: string;
  managerId: { _id: string; name: string; email: string } | null | string;
  managerNote: string;
  surcharge: number;
  status: ExceptionStatus;
  actualPlate?: string;
  expectedPlate?: string;
  oldSlot?: { _id: string; name: string } | string;
  newSlot?: { _id: string; name: string } | string;
  checkInImage?: string;
  checkOutImage?: string;
  images?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateExceptionPayload {
  sessionId: string; // MongoDB ObjectId
  type: ExceptionType;
  description: string;
  surcharge?: number;
}

export interface GetExceptionsParams {
  page?: number;
  limit?: number;
  status?: ExceptionStatus;
  type?: ExceptionType;
  sessionId?: string;
  facilityId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ExceptionsResponse {
  data: IException[];
  total: number;
  page: number;
  totalPages: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────
export const exceptionService = {
  /**
   * Staff: Tạo sự cố mới
   * POST /api/v1/exceptions
   */
  createException: async (
    payload: CreateExceptionPayload
  ): Promise<{ success: boolean; data: IException; message?: string }> => {
    return apiClient.post('/exceptions', payload);
  },

  /**
   * Staff / Manager: Lấy danh sách sự cố
   * GET /api/v1/exceptions
   */
  getExceptions: async (
    params?: GetExceptionsParams
  ): Promise<{ success: boolean; data: ExceptionsResponse; message?: string }> => {
    return apiClient.get('/exceptions', { params });
  },

  /**
   * Lấy chi tiết một sự cố theo ID
   * GET /api/v1/exceptions (filter by sessionId)
   */
  getExceptionsBySession: async (
    sessionId: string
  ): Promise<{ success: boolean; data: ExceptionsResponse; message?: string }> => {
    return apiClient.get('/exceptions', { params: { sessionId } });
  },

  /**
   * Lấy chi tiết một sự cố theo ID (bao gồm images)
   * GET /api/v1/exceptions/:id
   */
  getExceptionById: async (
    exceptionId: string
  ): Promise<{ success: boolean; data: IException; message?: string }> => {
    return apiClient.get(`/exceptions/${exceptionId}`);
  },

  /**
   * Staff: Xử lý sự cố
   * PATCH /api/v1/exceptions/:id/resolve
   */
  resolveException: async (
    exceptionId: string,
    payload: { staffNote: string; newLicensePlate?: string; newSlotId?: string }
  ): Promise<{ success: boolean; data: IException; message?: string }> => {
    return apiClient.patch(`/exceptions/${exceptionId}/resolve`, payload);
  },

  /**
   * Manager: Thêm ghi chú review sự cố
   * PATCH /api/v1/exceptions/:id/review
   */
  addManagerReview: async (
    exceptionId: string,
    payload: { managerNote: string }
  ): Promise<{ success: boolean; data: IException; message?: string }> => {
    return apiClient.patch(`/exceptions/${exceptionId}/review`, payload);
  },
};
