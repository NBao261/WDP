import { Router } from 'express';
import multer from 'multer';
import { scanLicensePlate } from '../controllers/alpr.controller';
import { verifyToken, checkRole } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

// Only allow image uploads (JPEG, PNG, WebP, BMP)
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit (ảnh chụp từ điện thoại thường 5-15MB)
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh (JPEG, PNG, WebP, BMP)'));
    }
  },
});

// Route for scanning license plate from image — Staff/Admin only
router.post(
  '/scan',
  verifyToken,
  checkRole([UserRole.STAFF, UserRole.ADMIN]),
  upload.single('image'),
  scanLicensePlate
);

export default router;

