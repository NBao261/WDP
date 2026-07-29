import { Router } from 'express';
import { FacilityController } from '../controllers/facility.controller';
import { verifyToken, checkRole, checkPermission } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';
import { validate } from '../middlewares/validate.middleware';
import { createFacilitySchema, updateFacilitySchema } from '../validations/facility.validation';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

router.use(verifyToken);
router.get(
  '/',
  checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]),
  checkPermission(PERMISSIONS.FACILITY_READ),
  FacilityController.getAllFacilities
);
router.get(
  '/:id',
  checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]),
  checkPermission(PERMISSIONS.FACILITY_READ),
  FacilityController.getFacilityById
);

router.get(
  '/:id/operations-config',
  checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]),
  checkPermission(PERMISSIONS.FACILITY_READ),
  FacilityController.getOperationsConfig
);

router.post(
  '/',
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(createFacilitySchema),
  checkPermission(PERMISSIONS.FACILITY_CREATE),
  FacilityController.createFacility
);
router.patch(
  '/:id',
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(updateFacilitySchema),
  checkPermission(PERMISSIONS.FACILITY_UPDATE),
  FacilityController.updateFacility
);

router.patch(
  '/:id/deactivate',
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  checkPermission(PERMISSIONS.FACILITY_UPDATE),
  FacilityController.deactivateFacility
);

router.delete(
  '/:id',
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  checkPermission(PERMISSIONS.FACILITY_DELETE),
  FacilityController.softDeleteFacility
);

export default router;
