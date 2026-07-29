import { Router } from 'express';
import { SessionController } from '../controllers/session.controller';
import { verifyToken, checkRole, checkPermission } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';
import { validate } from '../middlewares/validate.middleware';
import {
  checkConditionsSchema,
  checkInSchema,
  suggestFloorSchema,
  getActiveSessionsSchema,
  searchSessionSchema,
  checkOutSchema,
} from '../validations/session.validation';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

router.use(verifyToken);
router.get(
  '/my-sessions',
  SessionController.getMySessions
);

router.post(
  '/check-conditions',
  checkRole([UserRole.STAFF]),
  validate(checkConditionsSchema),
  checkPermission(PERMISSIONS.SESSION_CREATE),
  SessionController.checkConditions
);

router.post(
  '/check-in',
  checkRole([UserRole.STAFF]),
  validate(checkInSchema),
  checkPermission(PERMISSIONS.SESSION_CREATE),
  SessionController.checkIn
);

router.get(
  '/suggest-floor',
  checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]),
  validate(suggestFloorSchema),
  checkPermission(PERMISSIONS.SESSION_READ),
  SessionController.suggestFloors
);

router.get(
  '/active',
  checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]),
  validate(getActiveSessionsSchema),
  checkPermission(PERMISSIONS.SESSION_READ),
  SessionController.getActiveSessions
);

router.get(
  '/search',
  checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]),
  validate(searchSessionSchema),
  checkPermission(PERMISSIONS.SESSION_READ),
  SessionController.searchSession
);

router.get(
  '/today-traffic',
  checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]),
  checkPermission(PERMISSIONS.SESSION_READ),
  SessionController.getTodayTraffic
);

router.get(
  '/:id/fee',
  checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]),
  checkPermission(PERMISSIONS.SESSION_READ),
  SessionController.calculateFee
);

router.post(
  '/:id/check-out',
  checkRole([UserRole.STAFF]),
  validate(checkOutSchema),
  checkPermission(PERMISSIONS.SESSION_CLOSE),
  SessionController.checkOut
);

export default router;
