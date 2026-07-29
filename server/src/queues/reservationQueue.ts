import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../config/logger';
import { Reservation, ReservationStatus } from '../models/reservation.model';
import { getIO } from '../config/socket';

export const reservationQueueName = 'reservationQueue';

let reservationQueue: Queue | null = null;
let reservationWorker: Worker | null = null;

export const initReservationQueue = () => {
  if (!process.env.REDIS_URL) {
    logger.warn('[BullMQ] REDIS_URL is not set. ReservationQueue will not be initialized.');
    return;
  }

  try {
    const queueConnection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    queueConnection.on('error', (err) => logger.error('[BullMQ] Queue connection error:', err));
    
    const workerConnection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    workerConnection.on('error', (err) => logger.error('[BullMQ] Worker connection error:', err));

    reservationQueue = new Queue(reservationQueueName, { connection: queueConnection });

    reservationWorker = new Worker(reservationQueueName, async (job) => {
      if (job.name === 'reservationExpiringAlert') {
        const { reservationId } = job.data;
        logger.info(`[BullMQ] Worker processing expiry alert for reservation ${reservationId}`);
        
        const reservation = await Reservation.findById(reservationId).lean();
        if (reservation && (reservation.status === ReservationStatus.PENDING || reservation.status === ReservationStatus.CONFIRMED)) {
          // Bắn event qua Socket cho User
          try {
            getIO().to(`user:${reservation.userId}`).emit('reservation:expiring', {
              reservationId: reservation._id,
              code: reservation.code,
              facilityId: reservation.facilityId,
              message: 'Lượt đặt chỗ của bạn sẽ hết hạn sau 10 phút nữa.',
            });
            logger.info(`[Socket.IO] Emitted reservation:expiring to user ${reservation.userId}`);
          } catch (ioErr) {
            logger.warn(`[Socket.IO] Cannot emit reservation:expiring, maybe socket not initialized or user not connected:`, ioErr);
          }
        }
      }
    }, { connection: workerConnection });

    reservationWorker.on('completed', (job) => {
      logger.info(`[BullMQ] ReservationJob ${job.id} completed (${job.name})`);
    });

    reservationWorker.on('failed', (job, err) => {
      logger.error(`[BullMQ] ReservationJob ${job?.id} failed (${job?.name})`, err);
    });
    
    logger.info('[BullMQ] ReservationQueue initialized');
  } catch (err) {
    logger.error('[BullMQ] Failed to initialize ReservationQueue', err);
  }
};

export const addReservationExpiryAlertJob = async (reservationId: string, delayMs: number) => {
  if (reservationQueue) {
    try {
      await reservationQueue.add('reservationExpiringAlert', { reservationId }, {
        delay: delayMs,
        attempts: 2,
        removeOnComplete: true,
      });
      logger.info(`[BullMQ] Expiry alert queued for reservation ${reservationId} (delay: ${delayMs}ms)`);
    } catch (err) {
      logger.error(`[BullMQ] Failed to queue reservation expiry alert job`, err);
    }
  } else {
    logger.warn(`[BullMQ] Queue not initialized, skipped expiry alert for reservation ${reservationId}`);
  }
};
