import { z } from 'zod';
import { UserRole } from '../models/user.model';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createRoleSchema = z.object({
  body: z.object({
    code: z.nativeEnum(UserRole, { required_error: 'Role code is required' }),
    name: z.string({ required_error: 'Role name is required' }).min(1, 'Role name is required').max(100, 'Role name too long').trim(),
    description: z.string().max(500, 'Description too long').nullable().optional().transform(v => v || undefined),
    permissions: z.array(z.string().max(100, 'Permission name too long')).max(200, 'Too many permissions').optional(),
  }),
});

export const updatePermissionsSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid role ID format'),
  }),
  body: z.object({
    permissions: z
      .array(z.string({ required_error: 'Permission must be a string' }).max(100, 'Permission name too long'), {
        required_error: 'Permissions array is required',
      })
      .min(0)
      .max(200, 'Too many permissions'),
  }),
});

export const assignRoleSchema = z.object({
  body: z.object({
    userId: z
      .string({ required_error: 'User ID is required' })
      .regex(objectIdRegex, 'Invalid user ID format'),
    roleCode: z.nativeEnum(UserRole, { required_error: 'Role code is required' }),
    customPermissions: z.array(z.string().max(100, 'Permission name too long')).max(200, 'Too many permissions').optional(),
  }),
});
