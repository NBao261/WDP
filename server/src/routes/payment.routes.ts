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

router.post('/create-intent', verifyToken, validate(createIntentSchema), PaymentController.createIntent);

router.post('/webhook', validate(webhookSchema), PaymentController.webhook);

router.post('/cash-checkout', verifyToken, validate(cashCheckoutSchema), PaymentController.cashCheckout);

router.get('/status/:transactionCode', verifyToken, validate(checkStatusParamSchema), PaymentController.checkStatus);

router.get('/:sessionId', verifyToken, validate(getPaymentsBySessionParamSchema), PaymentController.getPaymentsBySession);

export default router;

