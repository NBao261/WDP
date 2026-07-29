import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const licensePlateRegex = /^[0-9A-Z\-.\s]{4,15}$/;

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
