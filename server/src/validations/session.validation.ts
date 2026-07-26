import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const licensePlateRegex = /^[0-9A-Z\-.\s]{4,15}$/;

// FR-8.1: Kiểm tra điều kiện xe vào bãi
export const checkConditionsSchema = z.object({
  body: z.object({
    facilityId: z
      .string({ required_error: 'Facility ID is required' })
      .regex(objectIdRegex, 'Invalid facility ID format'),
    vehicleTypeId: z
      .string({ required_error: 'Vehicle type ID is required' })
      .regex(objectIdRegex, 'Invalid vehicle type ID format'),
  }),
});

// FR-9.1: Tạo lượt gửi xe (check-in)
// Hai chế độ:
//   1. Có reservationCode → chỉ cần gateIn, hệ thống tự fill từ reservation
//   2. Không có reservationCode → bắt buộc facilityId + vehicleTypeId + licensePlate + gateIn
export const checkInSchema = z.object({
  body: z.object({
    facilityId: z
      .string()
      .regex(objectIdRegex, 'Invalid facility ID format')
      .optional(),
    vehicleTypeId: z
      .string()
      .regex(objectIdRegex, 'Invalid vehicle type ID format')
      .optional(),
    licensePlate: z
      .string()
      .min(4, 'License plate must be at least 4 characters')
      .max(15, 'License plate must be at most 15 characters')
      .transform((val) => val.toUpperCase().trim())
      .optional(),
    gateIn: z
      .string({ required_error: 'Gate in is required' })
      .min(1, 'Gate in is required')
      .max(50, 'Gate in too long')
      .trim(),
    floorId: z
      .string()
      .regex(objectIdRegex, 'Invalid floor ID format')
      .optional(),
    slotId: z
      .string()
      .regex(objectIdRegex, 'Invalid slot ID format')
      .optional(),
    reservationCode: z
      .string()
      .min(1, 'Reservation code is required')
      .max(50, 'Reservation code too long')
      .optional(),
    checkInImage: z.string().max(500, 'Image URL too long').optional(),
  }).refine(
    (data) => data.reservationCode || (data.facilityId && data.vehicleTypeId && data.licensePlate),
    {
      message: 'Cần truyền reservationCode HOẶC đầy đủ facilityId + vehicleTypeId + licensePlate',
    }
  ),
});

// FR-8.3: Gợi ý tầng/khu vực
export const suggestFloorSchema = z.object({
  query: z.object({
    facilityId: z
      .string({ required_error: 'Facility ID is required' })
      .regex(objectIdRegex, 'Invalid facility ID format'),
    vehicleTypeId: z
      .string({ required_error: 'Vehicle type ID is required' })
      .regex(objectIdRegex, 'Invalid vehicle type ID format'),
  }),
});

// FR-9.2: Lấy danh sách session active
export const getActiveSessionsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/, 'Page must be a number').optional(),
    limit: z.string().regex(/^\d+$/, 'Limit must be a number').optional(),
    facilityId: z.string().regex(objectIdRegex, 'Invalid facility ID').optional(),
    vehicleTypeId: z.string().regex(objectIdRegex, 'Invalid vehicle type ID').optional(),
    floorId: z.string().regex(objectIdRegex, 'Invalid floor ID').optional(),
    licensePlate: z.string().optional(),
    sortBy: z.enum(['checkInTime', 'licensePlate', 'totalFee']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

// FR-10.1: Tìm lượt gửi xe
export const searchSessionSchema = z.object({
  query: z
    .object({
      cardCode: z.string().optional(),
      licensePlate: z.string().optional(),
      code: z.string().optional(),
    })
    .refine(
      (data) => data.cardCode || data.licensePlate || data.code,
      { message: 'At least one search parameter is required (cardCode, licensePlate, or code)' }
    ),
});

// FR-10.3: Thu phí gửi xe và check-out
export const checkOutSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid session ID format'),
  }),
  body: z.object({
    gateOut: z
      .string({ required_error: 'Gate out is required' })
      .min(1, 'Gate out is required')
      .max(50, 'Gate out too long')
      .trim(),
    checkOutImage: z.string().max(500, 'Image URL too long').optional(),
  }),
});
