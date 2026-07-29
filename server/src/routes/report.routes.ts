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

router.use(verifyToken);

router.get(
  '/traffic',
  validate(trafficReportQuerySchema),
  checkPermission(PERMISSIONS.REPORT_TRAFFIC),
  ReportController.getTrafficReport
);

router.get(
  '/revenue',
  validate(revenueReportQuerySchema),
  checkPermission(PERMISSIONS.REPORT_REVENUE),
  ReportController.getRevenueReport
);

router.get(
  '/occupancy/heatmap',
  validate(occupancyReportQuerySchema),
  checkPermission(PERMISSIONS.REPORT_OCCUPANCY),
  ReportController.getOccupancyHeatmap
);

router.get(
  '/occupancy',
  validate(occupancyReportQuerySchema),
  checkPermission(PERMISSIONS.REPORT_OCCUPANCY),
  ReportController.getOccupancyReport
);

router.get(
  '/peak-hours',
  validate(peakHoursReportQuerySchema),
  checkPermission(PERMISSIONS.REPORT_PEAK_HOURS),
  ReportController.getPeakHoursReport
);

router.get(
  '/export',
  validate(exportReportQuerySchema),
  checkPermission(PERMISSIONS.REPORT_TRAFFIC),
  ReportController.exportReport
);

export default router;
