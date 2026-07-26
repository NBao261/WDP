import { z } from 'zod';
import { ExceptionType, ExceptionStatus } from '../models/exception.model';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createExceptionSchema = z.object({
  body: z.object({
    sessionId: z.string({ required_error: 'ID lượt gửi không được để trống' }).regex(objectIdRegex, 'Invalid session ID format'),
    type: z.nativeEnum(ExceptionType, { required_error: 'Vui lòng chọn loại ngoại lệ hợp lệ' }),
    description: z.string({ required_error: 'Vui lòng cung cấp mô tả' }).min(1, 'Mô tả không được để trống'),
    surcharge: z.number().min(0).optional(),
    actualPlate: z.string().optional(),
    expectedPlate: z.string().optional(),
    checkInImage: z.string().optional(),
    checkOutImage: z.string().optional(),
    cardCode: z.string().optional(),
  }),
});

export const getExceptionsSchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val) : 10)),
    status: z.nativeEnum(ExceptionStatus).optional(),
    type: z.nativeEnum(ExceptionType).optional(),
    sessionId: z.string().regex(objectIdRegex, 'Invalid session ID format').optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }).optional(),
});

export const resolveExceptionSchema = z.object({
  body: z.object({
    staffNote: z.string().optional().default(''),
    newLicensePlate: z.string().optional(),
    newSlotId: z.string().regex(objectIdRegex, 'Invalid slot ID format').optional(),
  }),
});

export const managerReviewSchema = z.object({
  body: z.object({
    managerNote: z.string({ required_error: 'Vui lòng cung cấp ghi chú' }).min(1, 'Ghi chú không được để trống'),
  }),
});

export const driverReportSchema = z.object({
  body: z.object({
    sessionId: z.string({ required_error: 'ID lượt gửi không được để trống' }).regex(objectIdRegex, 'Invalid session ID format'),
    type: z.nativeEnum(ExceptionType, { required_error: 'Vui lòng chọn loại phản hồi hợp lệ' }),
    description: z.string({ required_error: 'Vui lòng cung cấp mô tả' }).min(1, 'Mô tả không được để trống'),
    images: z.array(z.string()).max(3, 'Chỉ được đính kèm tối đa 3 ảnh').optional(),
  }),
});
