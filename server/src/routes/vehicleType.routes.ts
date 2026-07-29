import { Router } from 'express';
import { VehicleTypeController } from '../controllers/vehicleType.controller';
import { verifyToken, checkRole, checkPermission } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';
import { validate } from '../middlewares/validate.middleware';
import { createVehicleTypeSchema, updateVehicleTypeSchema } from '../validations/vehicleType.validation';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

router.use(verifyToken);

router.get('/similar', checkRole([UserRole.ADMIN, UserRole.MANAGER]), checkPermission(PERMISSIONS.VEHICLE_TYPE_READ), VehicleTypeController.getSimilar);
router.get('/', checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DRIVER]), checkPermission(PERMISSIONS.VEHICLE_TYPE_READ), VehicleTypeController.getAllVehicleTypes);
router.get('/:id', checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.DRIVER]), checkPermission(PERMISSIONS.VEHICLE_TYPE_READ), VehicleTypeController.getVehicleTypeById);

router.post('/', checkRole([UserRole.ADMIN, UserRole.MANAGER]), validate(createVehicleTypeSchema), checkPermission(PERMISSIONS.VEHICLE_TYPE_MANAGE), VehicleTypeController.createVehicleType);
router.patch('/:id', checkRole([UserRole.ADMIN, UserRole.MANAGER]), validate(updateVehicleTypeSchema), checkPermission(PERMISSIONS.VEHICLE_TYPE_MANAGE), VehicleTypeController.updateVehicleType);
router.delete('/:id', checkRole([UserRole.ADMIN, UserRole.MANAGER]), checkPermission(PERMISSIONS.VEHICLE_TYPE_MANAGE), VehicleTypeController.softDeleteVehicleType);

export default router;
