import { z } from 'zod';
import type { FeeType as _FeeType } from '../../../../services/pricing.service';

export const FEE_TYPE_LABELS: Record<string, string> = {
  per_turn: 'Theo lượt',
  hourly: 'Theo giờ',
  time_window: 'Theo khung giờ',
};

export const FEE_TYPE_OPTIONS = Object.entries(FEE_TYPE_LABELS) as [string, string][];

// Mapping từ UI type sang Backend payload
export const mapToBackendFeeConfig = (uiType: string) => {
  if (uiType === 'time_window') return { feeType: 'hourly', feeMethod: 'time_window' };
  if (uiType === 'hourly') return { feeType: 'hourly', feeMethod: 'duration_based' };
  return { feeType: 'per_turn', feeMethod: 'flat_rate' };
};

export const mapToUiType = (feeType: string, feeMethod: string) => {
  if (feeType === 'hourly' && feeMethod === 'time_window') return 'time_window';
  if (feeType === 'hourly') return 'hourly';
  return 'per_turn';
};

export const rateSchema = z.object({
  label: z.string().min(1, 'Bắt buộc'),
  amount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z
      .number({ required_error: 'Bắt buộc', invalid_type_error: 'Bắt buộc' })
      .refine((val) => val === 0 || val >= 1000, 'Giá phải từ 1000 trở lên (hoặc 0 = Miễn phí)')
      .refine((val) => val % 1000 === 0, 'Phải là số chẵn (chia hết cho 1.000đ)')
  ),
  unit: z.string().min(1, 'Bắt buộc'),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

export const formSchema = z
  .object({
    name: z
      .string({ required_error: 'Vui lòng nhập tên bảng giá' })
      .min(1, 'Vui lòng nhập tên bảng giá'),
    vehicleTypeId: z
      .string({ required_error: 'Vui lòng chọn loại xe' })
      .min(1, 'Vui lòng chọn loại xe'),
    facilityId: z.string({ required_error: 'Vui lòng chọn cơ sở' }).min(1, 'Vui lòng chọn cơ sở'),
    uiFeeType: z.enum(['per_turn', 'hourly', 'time_window'], {
      errorMap: () => ({ message: 'Vui lòng chọn loại hình thu phí' }),
    }),
    rates: z.array(rateSchema).min(1, 'Cần ít nhất 1 mức giá'),
    overnightFee: z.preprocess(
      (val) => (val === '' || val === null || val === undefined ? 0 : Number(val)),
      z
        .number({ invalid_type_error: 'Phải là số' })
        .refine((val) => val === 0 || val >= 1000, 'Tối thiểu 1000 (hoặc 0)')
        .refine((val) => val % 1000 === 0, 'Phải là số chẵn (chia hết cho 1.000đ)')
    ),
    overtimeFeePerHour: z.preprocess(
      (val) => (val === '' || val === null || val === undefined ? 0 : Number(val)),
      z
        .number({ invalid_type_error: 'Phải là số' })
        .refine((val) => val === 0 || val >= 1000, 'Tối thiểu 1000 (hoặc 0)')
        .refine((val) => val % 1000 === 0, 'Phải là số chẵn (chia hết cho 1.000đ)')
    ),
    lostCardFee: z.preprocess(
      (val) => (val === '' || val === null || val === undefined ? 0 : Number(val)),
      z
        .number({ invalid_type_error: 'Phải là số' })
        .refine((val) => val === 0 || val >= 1000, 'Tối thiểu 1000 (hoặc 0)')
        .refine((val) => val % 1000 === 0, 'Phải là số chẵn (chia hết cho 1.000đ)')
    ),
    gracePeriodMinutes: z.preprocess(
      (val) => (val === '' || val === null || val === undefined ? 0 : Number(val)),
      z
        .number({ invalid_type_error: 'Phải là số' })
        .min(0, 'Không được nhập số âm')
        .max(60, 'Tối đa 60 phút')
    ),
    maxDailyFee: z.preprocess(
      (val) => (val === '' || val === null || val === undefined ? 0 : Number(val)),
      z
        .number({ invalid_type_error: 'Phải là số' })
        .refine((val) => val === 0 || val >= 1000, 'Tối thiểu 1000 (hoặc 0 = Không giới hạn)')
        .refine((val) => val % 1000 === 0, 'Phải là số chẵn (chia hết cho 1.000đ)')
    ),
    firstBlockHours: z.preprocess(
      (val) => (val === '' || val === null || val === undefined ? 1 : Number(val)),
      z
        .number({ invalid_type_error: 'Phải là số' })
        .min(1, 'Tối thiểu 1 giờ')
    ),
  })
  .superRefine((data, ctx) => {
    if (data.uiFeeType === 'time_window') {
      data.rates.forEach((rate, index) => {
        if (!rate.startTime) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Bắt buộc', path: ['rates', index, 'startTime'] });
        }
        if (!rate.endTime) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Bắt buộc', path: ['rates', index, 'endTime'] });
        }
      });
    }
  });

export type FormValues = z.infer<typeof formSchema>;
