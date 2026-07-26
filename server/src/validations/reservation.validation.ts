import { z } from 'zod';
import { ReservationStatus } from '../models/reservation.model';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createReservationSchema = z.object({
  body: z.object({
    facilityId: z.string({ required_error: 'Facility ID không được để trống' }).regex(objectIdRegex, 'Invalid facility ID'),
    vehicleTypeId: z.string({ required_error: 'Loại xe không được để trống' }).regex(objectIdRegex, 'Invalid vehicle type ID'),
    licensePlate: z
      .string({ required_error: 'Biển số xe không được để trống' })
      .min(4, 'Biển số xe phải có ít nhất 4 ký tự')
      .max(15, 'Biển số xe tối đa 15 ký tự')
      .transform((val) => val.toUpperCase().trim()),
    startTime: z.string({ required_error: 'Thời gian bắt đầu không được để trống' }).datetime({ message: 'Thời gian bắt đầu không hợp lệ' }),
  }),
});

export const cancelReservationSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid reservation ID'),
  }),
});

export const getReservationsSchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val) : 10)),
    status: z.nativeEnum(ReservationStatus).optional(),
    facilityId: z.string().regex(objectIdRegex).optional(),
    sortBy: z.enum(['createdAt', 'startTime', 'status']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }).optional(),
});

export const convertReservationSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid reservation ID'),
  }),
});
