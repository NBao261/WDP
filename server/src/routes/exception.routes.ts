import { Router } from 'express';
import { ExceptionController } from '../controllers/exception.controller';
import { validate } from '../middlewares/validate.middleware';
import { createExceptionSchema, getExceptionsSchema, resolveExceptionSchema, managerReviewSchema, driverReportSchema } from '../validations/exception.validation';
import { verifyToken, checkRole, checkPermission } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

router.use(verifyToken);

router.get('/', checkRole([UserRole.MANAGER, UserRole.STAFF, UserRole.ADMIN]), checkPermission(PERMISSIONS.SESSION_EXCEPTION), validate(getExceptionsSchema), ExceptionController.getExceptions);

router.post('/driver-report', checkRole([UserRole.DRIVER]), checkPermission(PERMISSIONS.SESSION_EXCEPTION), validate(driverReportSchema), ExceptionController.createDriverReport);

router.get('/my-reports', checkRole([UserRole.DRIVER]), checkPermission(PERMISSIONS.SESSION_EXCEPTION), ExceptionController.getMyReports);

router.post('/', checkRole([UserRole.STAFF, UserRole.ADMIN]), checkPermission(PERMISSIONS.SESSION_EXCEPTION), validate(createExceptionSchema), ExceptionController.createException);

router.get('/:id', checkRole([UserRole.MANAGER, UserRole.STAFF, UserRole.ADMIN]), checkPermission(PERMISSIONS.SESSION_EXCEPTION), ExceptionController.getExceptionById);

router.patch('/:id/resolve', checkRole([UserRole.STAFF, UserRole.ADMIN]), checkPermission(PERMISSIONS.SESSION_EXCEPTION), validate(resolveExceptionSchema), ExceptionController.resolveException);

router.patch('/:id/review', checkRole([UserRole.MANAGER, UserRole.ADMIN]), checkPermission(PERMISSIONS.SESSION_EXCEPTION), validate(managerReviewSchema), ExceptionController.addManagerReview);

router.post('/detect-overdue', checkRole([UserRole.ADMIN, UserRole.MANAGER]), checkPermission(PERMISSIONS.SESSION_EXCEPTION), ExceptionController.detectOverdue);

export default router;
