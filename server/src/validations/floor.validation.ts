import { z } from 'zod';

export const createFloorSchema = z.object({
  body: z.object({
    facilityId: z
      .string({ required_error: 'Facility ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid facility ID format'),
    name: z.string({ required_error: 'Floor name is required' }).min(1, 'Floor name is required').max(100, 'Floor name too long').trim(),
    allowedVehicleTypes: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
    totalSlots: z.number().min(0).optional(),
  }),
});

export const updateFloorSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    status: z.enum(['active', 'inactive']).optional(),
    totalSlots: z.number().min(0).optional(),
  }),
});

export const assignVehicleTypesSchema = z.object({
  body: z.object({
    allowedVehicleTypes: z.array(
      z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vehicle type ID format')
    ),
  }),
});
