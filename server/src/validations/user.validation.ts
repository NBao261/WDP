import { z } from 'zod';
import { UserRole, UserStatus } from '../models/user.model';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createUserSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Name is required' })
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be at most 100 characters')
      .trim(),
    email: z.string({ required_error: 'Email is required' }).email('Invalid email format'),
    phone: z
      .string({ required_error: 'Phone is required' })
      .regex(/^(0|\+84)\d{9,10}$/, 'Invalid phone number format'),
    password: z
      .string({ required_error: 'Password is required' })
      .min(6, 'Password must be at least 6 characters')
      .max(128, 'Password must be at most 128 characters'),
    role: z.nativeEnum(UserRole, { required_error: 'Role is required' }),
    assignedFacilities: z.array(z.string().regex(objectIdRegex, 'Invalid facility ID')).optional(),
    customPermissions: z.array(z.string().max(100, 'Permission name too long')).max(200, 'Too many permissions').optional(),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters').trim().optional(),
    email: z.string().email('Invalid email format').optional(),
    phone: z
      .string()
      .regex(/^(0|\+84)\d{9,10}$/, 'Invalid phone number format')
      .optional(),
    role: z.nativeEnum(UserRole).optional(),
    status: z.nativeEnum(UserStatus).optional(),
    assignedFacilities: z.array(z.string().regex(objectIdRegex, 'Invalid facility ID')).optional(),
    customPermissions: z.array(z.string().max(100, 'Permission name too long')).max(200, 'Too many permissions').optional(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    newPassword: z
      .string({ required_error: 'New password is required' })
      .min(6, 'New password must be at least 6 characters'),
  }),
});

export const userIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid user ID format'),
  }),
});

export const assignFacilitiesSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid user ID format'),
  }),
  body: z.object({
    facilityIds: z
      .array(z.string().regex(objectIdRegex, 'Invalid facility ID'))
      .min(0, 'facilityIds must be an array (can be empty to unassign all)'),
  }),
});

