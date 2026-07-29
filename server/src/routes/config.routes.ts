import { Router } from 'express';
import { ConfigController } from '../controllers/config.controller';
import { verifyToken, checkRole, checkPermission } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';
import { validate } from '../middlewares/validate.middleware';
import { updateConfigSchema, getConfigSchema, getAuditLogsSchema } from '../validations/config.validation';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

router.use(verifyToken);
router.use(checkRole([UserRole.ADMIN]));
router.get('/', checkPermission(PERMISSIONS.CONFIG_MANAGE), ConfigController.getAllConfigs);
router.get('/logs', validate(getAuditLogsSchema), checkPermission(PERMISSIONS.LOG_VIEW), ConfigController.getAuditLogs);
router.get('/:key', validate(getConfigSchema), checkPermission(PERMISSIONS.CONFIG_MANAGE), ConfigController.getConfig);
router.put('/:key', validate(updateConfigSchema), checkPermission(PERMISSIONS.CONFIG_MANAGE), ConfigController.updateConfig);

export default router;
