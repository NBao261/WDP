import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { registerSchema, loginSchema, refreshTokenSchema, forgotPasswordSchema, verifyOtpSchema, resetPasswordWithTokenSchema, changePasswordSchema } from '../validations/auth.validation';
import { verifyToken } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', validate(registerSchema), AuthController.register);
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/refresh-token', validate(refreshTokenSchema), AuthController.refreshToken);
router.post('/logout', verifyToken, AuthController.logout);

// Change Password (requires auth)
router.put('/change-password', verifyToken, validate(changePasswordSchema), AuthController.changePassword);

// Forgot Password (public routes - không cần auth)
router.post('/forgot-password', validate(forgotPasswordSchema), AuthController.forgotPassword);
router.post('/verify-otp', validate(verifyOtpSchema), AuthController.verifyOtp);
router.post('/reset-password', validate(resetPasswordWithTokenSchema), AuthController.resetPassword);

export default router;
