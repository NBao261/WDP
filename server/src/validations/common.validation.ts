import { z } from 'zod';

// ObjectId validation dùng chung cho params :id
export const objectIdParamSchema = z.object({
  params: z.object({
    id: z
      .string({ required_error: 'ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  }),
});

// ObjectId validation cho params :facilityId
export const facilityIdParamSchema = z.object({
  params: z.object({
    facilityId: z
      .string({ required_error: 'Facility ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid facility ID format'),
  }),
});

// ObjectId validation cho params :floorId
export const floorIdParamSchema = z.object({
  params: z.object({
    floorId: z
      .string({ required_error: 'Floor ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid floor ID format'),
  }),
});

// Pagination query validation dùng chung
export const paginationQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .regex(/^\d+$/, 'Page must be a positive number')
      .optional()
      .refine((val) => !val || parseInt(val) >= 1, 'Page must be at least 1'),
    limit: z
      .string()
      .regex(/^\d+$/, 'Limit must be a positive number')
      .optional()
      .refine((val) => !val || (parseInt(val) >= 1 && parseInt(val) <= 100), 'Limit must be between 1 and 100'),
  }),
});

