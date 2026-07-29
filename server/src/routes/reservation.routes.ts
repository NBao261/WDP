import { Router } from 'express';
import { ReservationController } from '../controllers/reservation.controller';
import { verifyToken, checkRole, checkPermission } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';
import { validate } from '../middlewares/validate.middleware';
import {
  createReservationSchema,
  cancelReservationSchema,
  getReservationsSchema,
} from '../validations/reservation.validation';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

router.use(verifyToken);

// BR-6.4: Tự động hủy reservation quá hạn — Admin/Cron
// ⚠️ PHẢI đặt trước /:id routes để tránh bị match nhầm
router.post(
  '/auto-expire',
  checkRole([UserRole.ADMIN]),
  checkPermission(PERMISSIONS.CONFIG_MANAGE),
  ReservationController.autoExpire
);

// FR-14.1: Tạo đặt chỗ trước — Driver only (SRS 3.2: chỉ Driver đặt chỗ)
router.post(
  '/',
  checkRole([UserRole.DRIVER]),
  validate(createReservationSchema),
  checkPermission(PERMISSIONS.SLOT_RESERVE),
  ReservationController.createReservation
);

// FR-14.2: Xem danh sách đặt chỗ — Driver xem của mình, Manager/Admin xem tất cả
router.get(
  '/',
  checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.DRIVER]),
  validate(getReservationsSchema),
  checkPermission(PERMISSIONS.SLOT_READ),
  ReservationController.getReservations
);

// Tra cứu reservation theo mã — Staff/Manager dùng tại cổng check-in (QR hoặc nhập tay)
// ⚠️ PHẢI đặt trước /:id routes để tránh bị match nhầm
router.get(
  '/by-code/:code',
  checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]),
  checkPermission(PERMISSIONS.SLOT_READ),
  ReservationController.getByCode
);

// Tra cứu reservation theo biển số — Staff tự động detect khi ALPR quét
// ⚠️ PHẢI đặt trước /:id routes để tránh bị match nhầm
router.get(
  '/by-plate/:plate',
  checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]),
  checkPermission(PERMISSIONS.SLOT_READ),
  ReservationController.getByPlate
);

// Xem chi tiết reservation
router.get(
  '/:id',
  checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.DRIVER]),
  checkPermission(PERMISSIONS.SLOT_READ),
  ReservationController.getReservationById
);

// FR-14.2: Hủy đặt chỗ — Driver only
router.post(
  '/:id/cancel',
  checkRole([UserRole.DRIVER]),
  validate(cancelReservationSchema),
  checkPermission(PERMISSIONS.SLOT_RESERVE),
  ReservationController.cancelReservation
);

export default router;
