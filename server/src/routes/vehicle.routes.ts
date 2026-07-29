import { Router } from 'express';
import { VehicleController } from '../controllers/vehicle.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { addVehicleSchema, updateVehicleSchema, vehicleIdParamSchema } from '../validations/vehicle.validation';

const router = Router();

router.use(verifyToken);

router.post('/', validate(addVehicleSchema), VehicleController.addVehicle);
router.get('/my', VehicleController.getMyVehicles);
router.get('/:id', validate(vehicleIdParamSchema), VehicleController.getVehicleById);
router.patch('/:id', validate(updateVehicleSchema), VehicleController.updateVehicle);
router.delete('/:id', validate(vehicleIdParamSchema), VehicleController.deleteVehicle);

export default router;
