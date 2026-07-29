import { Router } from 'express';
import { FloorController } from '../controllers/floor.controller';
import { verifyToken, checkRole, checkPermission } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';
import { validate } from '../middlewares/validate.middleware';
import { createFloorSchema, updateFloorSchema, assignVehicleTypesSchema } from '../validations/floor.validation';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

router.use(verifyToken);

router.get('/', checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]), checkPermission(PERMISSIONS.FACILITY_READ), FloorController.getAllFloors);
router.get('/:id', checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]), checkPermission(PERMISSIONS.FACILITY_READ), FloorController.getFloorById);

router.post('/', checkRole([UserRole.ADMIN, UserRole.MANAGER]), validate(createFloorSchema), checkPermission(PERMISSIONS.FLOOR_MANAGE), FloorController.createFloor);
router.patch('/:id', checkRole([UserRole.ADMIN, UserRole.MANAGER]), validate(updateFloorSchema), checkPermission(PERMISSIONS.FLOOR_MANAGE), FloorController.updateFloor);
router.patch('/:id/assign-vehicles', checkRole([UserRole.ADMIN, UserRole.MANAGER]), validate(assignVehicleTypesSchema), checkPermission(PERMISSIONS.FLOOR_MANAGE), FloorController.assignVehicleTypes);
router.delete('/:id', checkRole([UserRole.ADMIN, UserRole.MANAGER]), checkPermission(PERMISSIONS.FLOOR_MANAGE), FloorController.softDeleteFloor);

export default router;
