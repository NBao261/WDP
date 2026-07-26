import { z } from 'zod';

export const createVehicleTypeSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Name is required' }).min(1).max(100, 'Name too long').trim(),
    code: z.string({ required_error: 'Code is required' }).min(1).max(20, 'Code too long').regex(/^[A-Z0-9_]+$/, 'Code can only contain uppercase letters, numbers and underscores'),
    description: z.string().max(500, 'Description too long').optional(),
    icon: z.string().max(100, 'Icon too long').optional(),
  }),
});

export const updateVehicleTypeSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100, 'Name too long').trim().optional(),
    code: z.string().min(1).max(20, 'Code too long').regex(/^[A-Z0-9_]+$/, 'Code can only contain uppercase letters, numbers and underscores').optional(),
    description: z.string().max(500, 'Description too long').optional(),
    icon: z.string().max(100, 'Icon too long').optional(),
  }),
});

