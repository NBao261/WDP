import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const addVehicleSchema = z.object({
  body: z.object({
    vehicleTypeId: z.string({ required_error: 'Vui lòng chọn loại xe' })
      .regex(objectIdRegex, 'ID loại xe không hợp lệ'),
    licensePlate: z.string({ required_error: 'Vui lòng nhập biển số xe' })
      .min(1, 'Biển số xe không được để trống')
      .max(20, 'Biển số xe quá dài')
      .transform((val) => val.toUpperCase().trim()),
    nickname: z.string().max(50, 'Tên gợi nhớ tối đa 50 ký tự').nullable().optional().transform(v => v || undefined),
    image: z.string().nullable().optional().transform(v => v || undefined),
    isDefault: z.boolean().optional(),
  }),
});

export const updateVehicleSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'ID xe không hợp lệ'),
  }),
  body: z.object({
    vehicleTypeId: z.string().regex(objectIdRegex, 'ID loại xe không hợp lệ').optional(),
    licensePlate: z.string().max(20, 'Biển số xe quá dài')
      .transform((val) => val.toUpperCase().trim()).optional(),
    nickname: z.string().max(50, 'Tên gợi nhớ tối đa 50 ký tự').nullable().optional().transform(v => v || undefined),
    image: z.string().nullable().optional().transform(v => v || undefined),
    isDefault: z.boolean().optional(),
  }),
});

export const vehicleIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'ID xe không hợp lệ'),
  }),
});
