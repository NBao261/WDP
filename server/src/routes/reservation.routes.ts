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

router.post(
  '/auto-expire',
  checkRole([UserRole.ADMIN]),
  checkPermission(PERMISSIONS.CONFIG_MANAGE),
  ReservationController.autoExpire
);

router.post(
  '/',
  checkRole([UserRole.DRIVER]),
  validate(createReservationSchema),
  checkPermission(PERMISSIONS.SLOT_RESERVE),
  ReservationController.createReservation
);

router.get(
  '/',
  checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.DRIVER]),
  validate(getReservationsSchema),
  checkPermission(PERMISSIONS.SLOT_READ),
  ReservationController.getReservations
);


router.get(
  '/by-code/:code',
  checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]),
  checkPermission(PERMISSIONS.SLOT_READ),
  ReservationController.getByCode
);

router.get(
  '/by-plate/:plate',
  checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]),
  checkPermission(PERMISSIONS.SLOT_READ),
  ReservationController.getByPlate
);

router.get(
  '/:id',
  checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.DRIVER]),
  checkPermission(PERMISSIONS.SLOT_READ),
  ReservationController.getReservationById
);

router.post(
  '/:id/cancel',
  checkRole([UserRole.DRIVER]),
  validate(cancelReservationSchema),
  checkPermission(PERMISSIONS.SLOT_RESERVE),
  ReservationController.cancelReservation
);

export default router;
