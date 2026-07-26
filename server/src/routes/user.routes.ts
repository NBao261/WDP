import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { verifyToken, checkRole, checkPermission, checkAnyPermission } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';
import { validate } from '../middlewares/validate.middleware';
import {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  assignFacilitiesSchema,
} from '../validations/user.validation';
import { objectIdParamSchema } from '../validations/common.validation';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

// ── Tất cả route đều yêu cầu đăng nhập ──────────────────
router.use(verifyToken);

// GET /users/me — Mọi role đều dùng được (Staff xem assignedFacilities populated)
router.get('/me', UserController.getMe);

// PUT /users/device-token — Mọi role đều dùng được để lưu push token
router.put('/device-token', UserController.updateDeviceToken);

// ── Admin-only routes ────────────────────────────────────
// SRS 3.7: Quản lý tài khoản — Admin full quyền, Manager chỉ được xem để phân công
router.post('/', checkRole([UserRole.ADMIN]), validate(createUserSchema), checkPermission(PERMISSIONS.USER_MANAGE), UserController.createUser);
router.get('/', checkRole([UserRole.ADMIN, UserRole.MANAGER]), checkAnyPermission([PERMISSIONS.USER_MANAGE, PERMISSIONS.USER_ASSIGN_FACILITY]), UserController.getAllUsers);
router.get('/:id', checkRole([UserRole.ADMIN]), validate(objectIdParamSchema), checkPermission(PERMISSIONS.USER_MANAGE), UserController.getUserById);
router.patch('/:id', checkRole([UserRole.ADMIN]), validate(objectIdParamSchema), validate(updateUserSchema), checkPermission(PERMISSIONS.USER_MANAGE), UserController.updateUser);
router.delete('/:id', checkRole([UserRole.ADMIN]), validate(objectIdParamSchema), checkPermission(PERMISSIONS.USER_MANAGE), UserController.softDeleteUser);

router.post('/:id/lock', checkRole([UserRole.ADMIN]), validate(objectIdParamSchema), checkPermission(PERMISSIONS.USER_MANAGE), UserController.lockUser);
router.post('/:id/unlock', checkRole([UserRole.ADMIN]), validate(objectIdParamSchema), checkPermission(PERMISSIONS.USER_MANAGE), UserController.unlockUser);
router.post('/:id/reset-password', checkRole([UserRole.ADMIN]), validate(resetPasswordSchema), checkPermission(PERMISSIONS.USER_MANAGE), UserController.resetPassword);

// ── Manager + Admin: Phân công tòa nhà cho Staff ─────────
// FR-18.6: Manager được phép assign facilities (SRS: Manager quản lý vận hành)
router.patch(
  '/:id/assign-facilities',
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(assignFacilitiesSchema),
  checkPermission(PERMISSIONS.USER_ASSIGN_FACILITY),
  UserController.assignFacilities
);

export default router;
