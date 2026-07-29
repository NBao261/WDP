import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushReceipt } from 'expo-server-sdk';
import { User } from '../models/user.model';
import { logger } from '../config/logger';

const expo = new Expo();

export class NotificationService {
  static async sendPushNotificationToUser(userId: string, title: string, body: string, data?: any): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user || !user.deviceToken) {
        logger.info(`Notification: User ${userId} not found or no deviceToken available.`);
        return false;
      }

      const pushToken = user.deviceToken;

      if (!Expo.isExpoPushToken(pushToken)) {
        logger.error(`Notification: Push token ${pushToken} is not a valid Expo push token`);
        return false;
      }

      const messages: ExpoPushMessage[] = [{
        to: pushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data || {},
      }];

      const chunks = expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          logger.info(`Notification: Sent chunk successfully`, ticketChunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          logger.error(`Notification: Error sending chunk`, error);
        }
      }

      return true;
    } catch (error) {
      logger.error('Notification: Error in sendPushNotificationToUser', error);
      return false;
    }
  }

  static async updateDeviceToken(userId: string, token: string): Promise<void> {
    try {
      await User.findByIdAndUpdate(userId, { deviceToken: token });
      logger.info(`Notification: Updated deviceToken for user ${userId}`);
    } catch (error) {
      logger.error(`Notification: Error updating deviceToken for user ${userId}`, error);
    }
  }
}
