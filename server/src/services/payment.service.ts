import mongoose from 'mongoose';
import crypto from 'crypto';
import axios from 'axios';
import { env } from '../config/env';
import { Payment, PaymentMethod, PaymentStatus, IPayment } from '../models/payment.model';
import { ParkingSession, SessionStatus, IParkingSession } from '../models/parkingSession.model';
import { ParkingSlot, SlotStatus } from '../models/parkingSlot.model';
import { SessionService } from './session.service';
import { AppError } from '../middlewares/error.middleware';
import { getIO } from '../config/socket';
import { delPattern } from '../config/redis';
import { UploadService } from './upload.service';
import { addUploadJob } from '../queues/uploadQueue';

export class PaymentService {
  static async createPaymentIntent(data: {
    sessionId: string;
    method: PaymentMethod;
    driverId?: string;
    checkOutImage?: string;
    gateOut?: string;
  }): Promise<{ payment: IPayment; paymentUrl?: string; qrCodeUrl?: string }> {
    const session = await ParkingSession.findById(data.sessionId);
    if (!session) {
      throw new AppError('Session không tồn tại', 404);
    }
    if (session.status === SessionStatus.COMPLETED) {
      throw new AppError('Lượt gửi xe đã kết thúc', 400);
    }

    const feeResult = await SessionService.calculateFee(data.sessionId, new Date());
    const totalFee = feeResult.totalFee;

    const transactionCode = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const payment = new Payment({
      sessionId: data.sessionId,
      transactionCode,
      amount: totalFee,
      method: data.method,
      status: PaymentStatus.PENDING,
      driverId: data.driverId || session.driverId,
      note: JSON.stringify({
        label: 'Thanh toán trực tuyến (Pre-payment)',
        checkOutImage: data.checkOutImage || null,
        gateOut: data.gateOut || null,
        staffOutId: data.driverId || null,
      }),
    });

    await payment.save();

    let paymentUrl;
    let qrCodeUrl;

    if (data.method === PaymentMethod.E_WALLET || data.method === PaymentMethod.QR_PAY) {
      const accessKey = env.MOMO_ACCESS_KEY;
      const secretKey = env.MOMO_SECRET_KEY;
      const partnerCode = env.MOMO_PARTNER_CODE;
      const apiUrl = env.MOMO_API_URL;
      const ipnUrl = env.MOMO_IPN_URL;
      const redirectUrl = env.CORS_ORIGIN;
      
      const amount = totalFee.toString();
      const orderId = transactionCode;
      const requestId = transactionCode;
      const orderInfo = `Thanh toán gửi xe Lync Park ${session.licensePlate || 'Không biển'}`;
      const requestType = "captureWallet";
      const extraData = "";
      
      const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
      const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');
      
      const requestBody = {
        partnerCode,
        partnerName: "Lync Park",
        storeId: "LyncParkStore",
        requestId,
        amount,
        orderId,
        orderInfo,
        redirectUrl,
        ipnUrl,
        lang: "vi",
        requestType,
        autoCapture: true,
        extraData,
        signature
      };
      
      try {
        const response = await axios.post(apiUrl, requestBody);
        if (response.data && response.data.resultCode === 0) {
          paymentUrl = response.data.payUrl;
          qrCodeUrl = response.data.qrCodeUrl;
        } else {
          console.error('[MOMO API] Failed to create payment:', response.data);
        }
      } catch (err: any) {
        console.error('[MOMO API] Exception:', err.response?.data || err.message);
      }
    }

    return { payment, paymentUrl, qrCodeUrl };
  }

  static async confirmPaymentWebhook(transactionCode: string): Promise<void> {
    const sessionMongoose = await mongoose.startSession();
    sessionMongoose.startTransaction();

    try {
      const payment = await Payment.findOne({ transactionCode }).session(sessionMongoose);
      if (!payment) {
        throw new AppError('Không tìm thấy giao dịch', 404);
      }
      if (payment.status === PaymentStatus.COMPLETED) {
        await sessionMongoose.abortTransaction();
        sessionMongoose.endSession();
        return;
      }

      const session = await ParkingSession.findById(payment.sessionId).session(sessionMongoose);
      if (!session) {
        throw new AppError('Không tìm thấy lượt gửi xe', 404);
      }

      const slot = await ParkingSlot.findById(session.slotId).session(sessionMongoose);

      payment.status = PaymentStatus.COMPLETED;
      await payment.save({ session: sessionMongoose });

      session.checkOutTime = new Date();
      session.status = SessionStatus.COMPLETED;
      session.totalFee = payment.amount;

      try {
        const meta = JSON.parse(payment.note || '{}');
        if (meta.checkOutImage) session.checkOutImage = meta.checkOutImage;
        if (meta.gateOut) session.gateOut = meta.gateOut;
        if (meta.staffOutId) session.staffOutId = new mongoose.Types.ObjectId(meta.staffOutId);
      } catch (_) { }

      await session.save({ session: sessionMongoose });

      if (slot) {
        slot.status = SlotStatus.AVAILABLE;
        slot.currentSessionId = null;
        slot.maintenanceReason = '';
        await slot.save({ session: sessionMongoose });
      }

      await sessionMongoose.commitTransaction();
      sessionMongoose.endSession();

      try {
        const io = getIO();
        io.to(`facility:${session.facilityId}`).emit('slot:statusChanged', {
          slotId: session.slotId,
          status: SlotStatus.AVAILABLE,
          facilityId: session.facilityId,
        });
        io.to(`facility:${session.facilityId}`).emit('payment:completed', {
          transactionCode: payment.transactionCode,
          sessionId: session._id,
        });
        if (session.driverId) {
          io.to(`user:${session.driverId}`).emit('session:completed', { sessionId: session._id });
        }
      } catch (e) {
      }
      
      delPattern('report:*').catch(() => {});
      addUploadJob(session._id.toString()).catch(console.error);

    } catch (error) {
      await sessionMongoose.abortTransaction();
      sessionMongoose.endSession();
      throw error;
    }
  }

  static async checkMomoOrderStatus(transactionCode: string): Promise<boolean> {
    const payment = await Payment.findOne({ transactionCode });
    if (!payment) return false;
    if (payment.status === PaymentStatus.COMPLETED) return true;

    const accessKey = env.MOMO_ACCESS_KEY;
    const secretKey = env.MOMO_SECRET_KEY;
    const partnerCode = env.MOMO_PARTNER_CODE;
    const apiUrl = env.MOMO_QUERY_URL;
    
    const orderId = transactionCode;
    const requestId = transactionCode;
    
    const rawSignature = `accessKey=${accessKey}&orderId=${orderId}&partnerCode=${partnerCode}&requestId=${requestId}`;
    const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');
    
    try {
      const response = await axios.post(apiUrl, {
        partnerCode,
        requestId,
        orderId,
        lang: "vi",
        signature
      });
      
      if (response.data && response.data.resultCode === 0) {
        await this.confirmPaymentWebhook(transactionCode);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[MOMO API] Status check failed:', error);
      return false;
    }
  }

  static async getPaymentsBySession(sessionId: string): Promise<IPayment[]> {
    return await Payment.find({ sessionId }).sort({ createdAt: -1 }).populate('staffId', 'name email');
  }
}
