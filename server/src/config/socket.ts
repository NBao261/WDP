import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { env } from './env';
import { logger } from './logger';
import { createAdapter } from '@socket.io/redis-adapter';
import { getRedis, isRedisConnected } from './redis';
import jwt from 'jsonwebtoken';

let io: SocketServer;

export const createSocketServer = (httpServer: HttpServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
    },
  });

  const redisClient = getRedis();
  if (redisClient && isRedisConnected()) {
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('[Socket.IO] Redis adapter enabled');
  } else {
    logger.warn('[Socket.IO] Redis adapter skipped (Redis not connected)');
  }

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as any;
        if (decoded.userId) {
          socket.join(`user:${decoded.userId}`);
          logger.debug(`Socket ${socket.id} joined user:${decoded.userId}`);
        }
      } catch (err) {}
    }

    socket.on('join:facility', (facilityId: string) => {
      socket.join(`facility:${facilityId}`);
      logger.debug(`Socket ${socket.id} joined facility:${facilityId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): SocketServer => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};
