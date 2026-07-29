import { Router } from 'express';
import { SlotController } from '../controllers/slot.controller';
import { verifyToken, checkRole, checkPermission } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';
import { validate } from '../middlewares/validate.middleware';
import { createSlotSchema, createBulkSlotsSchema, updateSlotSchema, updateSlotStatusSchema } from '../validations/slot.validation';
import { objectIdParamSchema, floorIdParamSchema } from '../validations/common.validation';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

router.use(verifyToken);

router.get('/stats', checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]), checkPermission(PERMISSIONS.SLOT_READ), SlotController.getSlotStats);
router.get('/floor/:floorId', checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]), validate(floorIdParamSchema), checkPermission(PERMISSIONS.SLOT_READ), SlotController.getSlotsByFloor);
router.get('/:id', checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]), validate(objectIdParamSchema), checkPermission(PERMISSIONS.SLOT_READ), SlotController.getSlotById);

router.post('/', checkRole([UserRole.ADMIN, UserRole.MANAGER]), validate(createSlotSchema), checkPermission(PERMISSIONS.SLOT_CREATE), SlotController.createSlot);
router.post('/bulk', checkRole([UserRole.ADMIN, UserRole.MANAGER]), validate(createBulkSlotsSchema), checkPermission(PERMISSIONS.SLOT_CREATE), SlotController.createBulkSlots);
router.delete('/:id', checkRole([UserRole.ADMIN, UserRole.MANAGER]), validate(objectIdParamSchema), checkPermission(PERMISSIONS.SLOT_DELETE), SlotController.deleteSlot);

router.patch('/:id/status', checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]), validate(updateSlotStatusSchema), checkPermission(PERMISSIONS.SLOT_UPDATE_STATUS), SlotController.updateSlotStatus);

router.patch('/:id', checkRole([UserRole.ADMIN, UserRole.MANAGER]), validate(updateSlotSchema), checkPermission(PERMISSIONS.SLOT_UPDATE_STATUS), SlotController.updateSlot);

export default router;
