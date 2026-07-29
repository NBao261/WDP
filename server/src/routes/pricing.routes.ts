import { Router } from 'express';
import { PricingController } from '../controllers/pricing.controller';
import { verifyToken, checkRole, checkPermission } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';
import { validate } from '../middlewares/validate.middleware';
import { createPricingPlanSchema, updatePricingPlanSchema } from '../validations/pricing.validation';
import { objectIdParamSchema } from '../validations/common.validation';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

router.use(verifyToken);

router.get('/', checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]), checkPermission(PERMISSIONS.PRICING_READ), PricingController.getAllPricingPlans);
router.get('/:id', checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]), validate(objectIdParamSchema), checkPermission(PERMISSIONS.PRICING_READ), PricingController.getPricingPlanById);
router.get('/:id/active-sessions', checkRole([UserRole.ADMIN, UserRole.MANAGER]), validate(objectIdParamSchema), checkPermission(PERMISSIONS.PRICING_READ), PricingController.getActiveSessionCount);

router.post('/', checkRole([UserRole.ADMIN, UserRole.MANAGER]), validate(createPricingPlanSchema), checkPermission(PERMISSIONS.PRICING_CREATE), PricingController.createPricingPlan);
router.patch('/:id', checkRole([UserRole.ADMIN, UserRole.MANAGER]), validate(updatePricingPlanSchema), checkPermission(PERMISSIONS.PRICING_UPDATE), PricingController.updatePricingPlan);
router.delete('/:id', checkRole([UserRole.ADMIN, UserRole.MANAGER]), validate(objectIdParamSchema), checkPermission(PERMISSIONS.PRICING_DELETE), PricingController.deletePricingPlan);

export default router;
