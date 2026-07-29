import app from './app';
import { connectDatabase } from './database/connection';
import { env } from './config/env';
import { logger } from './config/logger';
import { createSocketServer } from './config/socket';
import { getRedis } from './config/redis';
import { initUploadQueue } from './queues/uploadQueue';
import { initReservationQueue } from './queues/reservationQueue';
import { ReservationService } from './services/reservation.service';
import http from 'http';

const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await connectDatabase();
    logger.info('✅ MongoDB connected');

    // Connect to Redis (non-blocking — app works without Redis)
    getRedis();
    logger.info('✅ Redis client initialized');

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.IO
    createSocketServer(server);
    logger.info('✅ Socket.IO initialized');

    // Initialize Background Queues
    initUploadQueue();
    initReservationQueue();

    // Start listening
    server.listen(env.PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${env.PORT} [${env.NODE_ENV}]`);
      logger.info(`📄 API Docs: http://localhost:${env.PORT}/api-docs`);
    });

    // BR-6.4: Auto-expire reservations every 5 minutes
    const EXPIRE_INTERVAL = 5 * 60 * 1000; // 5 phút
    setInterval(async () => {
      try {
        const count = await ReservationService.autoExpireReservations();
        if (count > 0) {
          logger.info(`[Scheduler] Auto-expired ${count} reservation(s)`);
        }
      } catch (err) {
        logger.error('[Scheduler] autoExpireReservations error:', err);
      }
    }, EXPIRE_INTERVAL);
    logger.info('✅ Reservation auto-expire scheduler started (every 5 min)');
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
