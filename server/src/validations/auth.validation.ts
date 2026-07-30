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

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email không được để trống' })
      .email('Email không hợp lệ'),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email không được để trống' })
      .email('Email không hợp lệ'),
    otp: z
      .string({ required_error: 'Mã OTP không được để trống' })
      .length(6, 'Mã OTP phải có 6 ký tự'),
  }),
});

export const resetPasswordWithTokenSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email không được để trống' })
      .email('Email không hợp lệ'),
    token: z
      .string({ required_error: 'Token không được để trống' })
      .min(1, 'Token không được để trống'),
    newPassword: z
      .string({ required_error: 'Mật khẩu mới không được để trống' })
      .min(6, 'Mật khẩu phải có ít nhất 6 ký tự')
      .max(128, 'Mật khẩu không được quá 128 ký tự'),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    oldPassword: z
      .string({ required_error: 'Mật khẩu hiện tại không được để trống' })
      .min(1, 'Mật khẩu hiện tại không được để trống'),
    newPassword: z
      .string({ required_error: 'Mật khẩu mới không được để trống' })
      .min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự')
      .max(128, 'Mật khẩu mới không được quá 128 ký tự'),
  }),
});
