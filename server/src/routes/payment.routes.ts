import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createIntentSchema,
  webhookSchema,
  cashCheckoutSchema,
  checkStatusParamSchema,
  getPaymentsBySessionParamSchema,
} from '../validations/payment.validation';

const router = Router();

// Khách hàng tạo intent thanh toán online
router.post('/create-intent', verifyToken, validate(createIntentSchema), PaymentController.createIntent);

// Webhook từ cổng thanh toán (không authenticate bằng JWT mà dùng signature)
router.post('/webhook', validate(webhookSchema), PaymentController.webhook);

// Staff thu tiền mặt tại cổng & checkout
router.post('/cash-checkout', verifyToken, validate(cashCheckoutSchema), PaymentController.cashCheckout);

// Polling kiểm tra trạng thái thanh toán Momo
router.get('/status/:transactionCode', verifyToken, validate(checkStatusParamSchema), PaymentController.checkStatus);

// Xem lịch sử thanh toán của 1 session
router.get('/:sessionId', verifyToken, validate(getPaymentsBySessionParamSchema), PaymentController.getPaymentsBySession);

export default router;

