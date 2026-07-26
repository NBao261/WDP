import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;

// Common query fields dùng chung cho reports
const facilityIdField = z.string().regex(objectIdRegex, 'Invalid facility ID').optional();
const vehicleTypeIdField = z.string().regex(objectIdRegex, 'Invalid vehicle type ID').optional();
const floorIdField = z.string().regex(objectIdRegex, 'Invalid floor ID').optional();
const startDateField = z.string().regex(isoDateRegex, 'startDate phải là ISO date (YYYY-MM-DD)').optional();
const endDateField = z.string().regex(isoDateRegex, 'endDate phải là ISO date (YYYY-MM-DD)').optional();
const groupByField = z.enum(['day', 'week', 'month'], {
  errorMap: () => ({ message: 'groupBy phải là day, week hoặc month' }),
}).optional();

// GET /reports/traffic — Báo cáo lượt xe vào/ra
export const trafficReportQuerySchema = z.object({
  query: z.object({
    facilityId: facilityIdField,
    floorId: floorIdField,
    vehicleTypeId: vehicleTypeIdField,
    startDate: startDateField,
    endDate: endDateField,
    groupBy: groupByField,
  }),
});

// GET /reports/revenue — Báo cáo doanh thu
export const revenueReportQuerySchema = z.object({
  query: z.object({
    facilityId: facilityIdField,
    vehicleTypeId: vehicleTypeIdField,
    paymentMethod: z.enum(['cash', 'qr_pay', 'e_wallet', 'bank_card']).optional(),
    startDate: startDateField,
    endDate: endDateField,
    groupBy: groupByField,
  }),
});

// GET /reports/occupancy — Báo cáo tỷ lệ lấp đầy
export const occupancyReportQuerySchema = z.object({
  query: z.object({
    facilityId: facilityIdField,
    vehicleTypeId: vehicleTypeIdField,
  }),
});

// GET /reports/peak-hours — Báo cáo khung giờ cao điểm
export const peakHoursReportQuerySchema = z.object({
  query: z.object({
    facilityId: facilityIdField,
    vehicleTypeId: vehicleTypeIdField,
    startDate: startDateField,
    endDate: endDateField,
  }),
});

// GET /reports/export — Xuất báo cáo
export const exportReportQuerySchema = z.object({
  query: z.object({
    reportType: z.enum(['traffic', 'revenue', 'occupancy', 'peak-hours', 'comprehensive'], {
      errorMap: () => ({ message: 'reportType phải là traffic, revenue, occupancy, peak-hours hoặc comprehensive' }),
    }),
    format: z.enum(['excel', 'pdf'], {
      errorMap: () => ({ message: 'format phải là excel hoặc pdf' }),
    }),
    facilityId: facilityIdField,
    vehicleTypeId: vehicleTypeIdField,
    floorId: floorIdField,
    startDate: startDateField,
    endDate: endDateField,
    groupBy: groupByField,
    paymentMethod: z.enum(['cash', 'qr_pay', 'e_wallet', 'bank_card']).optional(),
  }),
});
