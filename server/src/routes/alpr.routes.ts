import { Router } from 'express';
import multer from 'multer';
import { scanLicensePlate } from '../controllers/alpr.controller';
import { verifyToken, checkRole } from '../middlewares/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh (JPEG, PNG, WebP, BMP)'));
    }
  },
});

router.post(
  '/scan',
  verifyToken,
  checkRole([UserRole.STAFF, UserRole.ADMIN]),
  upload.single('image'),
  scanLicensePlate
);

export default router;

