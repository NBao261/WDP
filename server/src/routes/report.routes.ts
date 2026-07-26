import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { checkPermission } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  trafficReportQuerySchema,
  revenueReportQuerySchema,
  occupancyReportQuerySchema,
  peakHoursReportQuerySchema,
  exportReportQuerySchema,
} from '../validations/report.validation';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

// ─── Tất cả route báo cáo yêu cầu đăng nhập ─────────
router.use(verifyToken);

// GET /reports/traffic
// FR-6.1: Báo cáo lượt xe vào/ra
// Quyền: report:traffic (Admin + Manager — theo SRS 3.6)
router.get(
  '/traffic',
  validate(trafficReportQuerySchema),
  checkPermission(PERMISSIONS.REPORT_TRAFFIC),
  ReportController.getTrafficReport
);

// GET /reports/revenue
// FR-6.2: Báo cáo doanh thu
// Quyền: report:revenue (Admin + Manager — theo SRS 3.6)
router.get(
  '/revenue',
  validate(revenueReportQuerySchema),
  checkPermission(PERMISSIONS.REPORT_REVENUE),
  ReportController.getRevenueReport
);

// GET /reports/occupancy/heatmap
// FR-6.3 mở rộng: Occupancy heatmap theo tầng + loại xe (MFD [P2])
// Quyền: report:occupancy (Admin + Manager — theo SRS 3.6)
router.get(
  '/occupancy/heatmap',
  validate(occupancyReportQuerySchema),
  checkPermission(PERMISSIONS.REPORT_OCCUPANCY),
  ReportController.getOccupancyHeatmap
);

// GET /reports/occupancy
// FR-6.3: Báo cáo tỷ lệ lấp đầy
// Quyền: report:occupancy (Admin + Manager — theo SRS 3.6)
router.get(
  '/occupancy',
  validate(occupancyReportQuerySchema),
  checkPermission(PERMISSIONS.REPORT_OCCUPANCY),
  ReportController.getOccupancyReport
);

// GET /reports/peak-hours
// FR-6.4: Báo cáo khung giờ cao điểm
// Quyền: report:peak_hours (Admin + Manager — theo SRS 3.6)
router.get(
  '/peak-hours',
  validate(peakHoursReportQuerySchema),
  checkPermission(PERMISSIONS.REPORT_PEAK_HOURS),
  ReportController.getPeakHoursReport
);

// GET /reports/export
// FR-6: Xuất báo cáo (Excel/PDF)
router.get(
  '/export',
  validate(exportReportQuerySchema),
  checkPermission(PERMISSIONS.REPORT_TRAFFIC), // or a generic export permission
  ReportController.exportReport
);

export default router;
