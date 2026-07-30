import { z } from 'zod';
import { PaymentMethod } from '../models/payment.model';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createIntentSchema = z.object({
  body: z.object({
    sessionId: z
      .string({ required_error: 'Session ID không được để trống' })
      .regex(objectIdRegex, 'Session ID không hợp lệ'),
    method: z.nativeEnum(PaymentMethod, {
      required_error: 'Phương thức thanh toán không hợp lệ',
    }),
    checkOutImage: z.string().max(500, 'URL ảnh quá dài').nullable().optional().transform(v => v || undefined),
    gateOut: z.string().max(50, 'Gate out quá dài').trim().nullable().optional().transform(v => v || undefined),
  }),
});

export const webhookSchema = z.object({
  body: z.object({
    orderId: z.string().max(100, 'Order ID quá dài').optional(),
    transactionCode: z.string().max(100, 'Transaction code quá dài').optional(),
  }).passthrough().refine(
    (data) => data.orderId || data.transactionCode,
    { message: 'Thiếu mã giao dịch (orderId hoặc transactionCode)' }
  ),
});

export const cashCheckoutSchema = z.object({
  body: z.object({
    sessionId: z
      .string({ required_error: 'Session ID không được để trống' })
      .regex(objectIdRegex, 'Session ID không hợp lệ'),
    gateOut: z
      .string({ required_error: 'Gate out không được để trống' })
      .min(1, 'Gate out không được để trống')
      .max(50, 'Gate out quá dài')
      .trim(),
    checkOutImage: z.string().max(500, 'URL ảnh quá dài').nullable().optional().transform(v => v || undefined),
  }),
});

export const checkStatusParamSchema = z.object({
  params: z.object({
    transactionCode: z
      .string({ required_error: 'Transaction code không được để trống' })
      .min(1, 'Transaction code không được để trống')
      .max(100, 'Transaction code quá dài'),
  }),
});

export const getPaymentsBySessionParamSchema = z.object({
  params: z.object({
    sessionId: z
      .string({ required_error: 'Session ID không được để trống' })
      .regex(objectIdRegex, 'Session ID không hợp lệ'),
  }),
});
