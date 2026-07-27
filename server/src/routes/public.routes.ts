import { Router } from 'express';
import { PublicController } from '../controllers/public.controller';
import { validate } from '../middlewares/validate.middleware';
import { facilityIdParamSchema } from '../validations/common.validation';

const router = Router();

router.get('/facilities', PublicController.getPublicFacilities);
router.get('/facilities/:facilityId', validate(facilityIdParamSchema), PublicController.getPublicFacilityById);
router.get('/facilities/:facilityId/pricing', validate(facilityIdParamSchema), PublicController.getPublicPricing);
router.get('/facilities/:facilityId/available-slots', validate(facilityIdParamSchema), PublicController.getAvailableSlots);

export default router;
