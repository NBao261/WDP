import { Router } from 'express';
import { ExceptionController } from '../controllers/exception.controller';
import { validate } from '../middlewares/validate.middleware';
import { createExceptionSchema, getExceptionsSchema, resolveExceptionSchema, managerReviewSchema, driverReportSchema } from '../validations/exception.validation';
import { verifyToken, checkRole, checkPermission } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

// Áp dụng bảo mật cho tất cả các routes
router.use(verifyToken);

// Staff và Manager đều xem được danh sách ngoại lệ
router.get('/', checkRole([UserRole.MANAGER, UserRole.STAFF, UserRole.ADMIN]), checkPermission(PERMISSIONS.SESSION_EXCEPTION), validate(getExceptionsSchema), ExceptionController.getExceptions);

// Driver tạo phản hồi/sự cố
router.post('/driver-report', checkRole([UserRole.DRIVER]), checkPermission(PERMISSIONS.SESSION_EXCEPTION), validate(driverReportSchema), ExceptionController.createDriverReport);

// Driver xem danh sách phản hồi/sự cố của mình
router.get('/my-reports', checkRole([UserRole.DRIVER]), checkPermission(PERMISSIONS.SESSION_EXCEPTION), ExceptionController.getMyReports);

// Chỉ Staff mới được tạo ngoại lệ (hoặc Admin)
router.post('/', checkRole([UserRole.STAFF, UserRole.ADMIN]), checkPermission(PERMISSIONS.SESSION_EXCEPTION), validate(createExceptionSchema), ExceptionController.createException);

// Lấy chi tiết một sự cố (bao gồm images)
router.get('/:id', checkRole([UserRole.MANAGER, UserRole.STAFF, UserRole.ADMIN]), checkPermission(PERMISSIONS.SESSION_EXCEPTION), ExceptionController.getExceptionById);

// Staff tự xử lý ngoại lệ (hoặc Admin)
router.patch('/:id/resolve', checkRole([UserRole.STAFF, UserRole.ADMIN]), checkPermission(PERMISSIONS.SESSION_EXCEPTION), validate(resolveExceptionSchema), ExceptionController.resolveException);

// Manager review + thêm ghi chú (Manager hoặc Admin)
router.patch('/:id/review', checkRole([UserRole.MANAGER, UserRole.ADMIN]), checkPermission(PERMISSIONS.SESSION_EXCEPTION), validate(managerReviewSchema), ExceptionController.addManagerReview);

// Kích hoạt quét quá hạn (System/Admin)
router.post('/detect-overdue', checkRole([UserRole.ADMIN, UserRole.MANAGER]), checkPermission(PERMISSIONS.SESSION_EXCEPTION), ExceptionController.detectOverdue);

export default router;
