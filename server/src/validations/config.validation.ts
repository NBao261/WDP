import { z } from 'zod';

// FR-20: Cập nhật cấu hình hệ thống
export const updateConfigSchema = z.object({
  params: z.object({
    key: z.string({ required_error: 'Config key is required' }).min(1, 'Config key is required'),
  }),
  body: z.object({
    value: z.union([
      z.string().max(10000, 'Config value string quá dài'),
      z.number(),
      z.boolean(),
    ], { required_error: 'Config value is required' }),
  }),
});

// FR-20: Lấy cấu hình theo key
export const getConfigSchema = z.object({
  params: z.object({
    key: z.string({ required_error: 'Config key is required' }).min(1, 'Config key is required'),
  }),
});

// FR-20.4: Query audit logs với filter
export const getAuditLogsSchema = z.object({
  query: z.object({
    action: z.string().optional(),
    entity: z.string().optional(),
    page: z.string().regex(/^\d+$/, 'Page must be a number').optional(),
    limit: z.string().regex(/^\d+$/, 'Limit must be a number').optional(),
  }),
});
