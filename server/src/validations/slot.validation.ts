import { z } from 'zod';
import { SlotStatus } from '../models/parkingSlot.model';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// FR-4.1: Tạo slot đỗ xe
export const createSlotSchema = z.object({
  body: z.object({
    code: z.string({ required_error: 'Slot code is required' }).min(1, 'Slot code is required').max(20, 'Slot code too long').trim(),
    floorId: z
      .string({ required_error: 'Floor ID is required' })
      .regex(objectIdRegex, 'Invalid floor ID format'),
    facilityId: z
      .string({ required_error: 'Facility ID is required' })
      .regex(objectIdRegex, 'Invalid facility ID format'),
    vehicleTypeId: z
      .string({ required_error: 'Vehicle type ID is required' })
      .regex(objectIdRegex, 'Invalid vehicle type ID format'),
  }),
});

// FR-4.1: Tạo hàng loạt (bulk create)
export const createBulkSlotsSchema = z.object({
  body: z.object({
    facilityId: z
      .string({ required_error: 'Facility ID is required' })
      .regex(objectIdRegex, 'Invalid facility ID format'),
    floorId: z
      .string({ required_error: 'Floor ID is required' })
      .regex(objectIdRegex, 'Invalid floor ID format'),
    vehicleType: z
      .string({ required_error: 'Vehicle type ID is required' })
      .regex(objectIdRegex, 'Invalid vehicle type ID format'),
    prefix: z.string({ required_error: 'Prefix is required' }).min(1, 'Prefix is required').max(10, 'Prefix too long').trim(),
    startNumber: z
      .number({ required_error: 'Start number is required' })
      .int('Start number must be an integer')
      .min(1, 'Start number must be at least 1'),
    count: z
      .number({ required_error: 'Count is required' })
      .int('Count must be an integer')
      .min(1, 'Count must be at least 1')
      .max(200, 'Cannot create more than 200 slots at once'),
  }),
});

// Update slot info (code, vehicleTypeId)
export const updateSlotSchema = z.object({
  body: z.object({
    code: z.string().min(1, 'Slot code is required').max(20, 'Slot code too long').trim().optional(),
    vehicleTypeId: z
      .string()
      .regex(objectIdRegex, 'Invalid vehicle type ID format')
      .optional(),
  }).refine(data => data.code || data.vehicleTypeId, {
    message: 'At least one field (code or vehicleTypeId) is required',
  }),
});

// FR-4.2: Cập nhật trạng thái slot (BR-3.3: validate chuyển trạng thái)
export const updateSlotStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(SlotStatus, { required_error: 'Status is required' }),
    reason: z.string().max(500, 'Reason too long').optional(),
  }),
});
