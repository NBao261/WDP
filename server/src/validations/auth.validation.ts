import { z } from 'zod';
import { UserRole } from '../models/user.model';

export const registerSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Name is required' }).min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters').trim(),
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email format'),
    phone: z
      .string({ required_error: 'Phone is required' })
      .regex(/^(0|\+84)\d{9,10}$/, 'Invalid phone number format'),
    password: z
      .string({ required_error: 'Password is required' })
      .min(6, 'Password must be at least 6 characters')
      .max(128, 'Password must be at most 128 characters'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email format'),
    password: z
      .string({ required_error: 'Password is required' })
      .min(1, 'Password is required'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z
      .string({ required_error: 'Refresh token is required' })
      .min(1, 'Refresh token is required'),
  }),
});
