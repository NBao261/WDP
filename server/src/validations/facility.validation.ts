import { z } from 'zod';
import { FacilityStatus } from '../models/parkingFacility.model';

export const createFacilitySchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Facility name is required' }).min(1, 'Facility name is required').max(200, 'Facility name too long').trim(),
    address: z.string({ required_error: 'Address is required' }).min(1, 'Address is required').max(500, 'Address too long').trim(),
    totalFloors: z.number({ required_error: 'Total floors is required' }).min(1),
    openTime: z
      .string({ required_error: 'Open time is required' })
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)'),
    closeTime: z
      .string({ required_error: 'Close time is required' })
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)'),
    description: z.string().max(2000, 'Description too long').nullable().optional().transform(v => v || undefined),
    images: z.array(z.string()).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
});

export const updateFacilitySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Facility name is required').max(200, 'Facility name too long').trim().optional(),
    address: z.string().min(1, 'Address is required').max(500, 'Address too long').trim().optional(),
    totalFloors: z.number().min(1).optional(),
    openTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .optional(),
    closeTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .optional(),
    description: z.string().nullable().optional().transform(v => v || undefined),
    images: z.array(z.string()).optional(),
    status: z.nativeEnum(FacilityStatus).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
});
