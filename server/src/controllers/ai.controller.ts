import { Request, Response, NextFunction } from 'express';
import { ChatbotService } from '../services/chatbot.service';
import { AppError } from '../middlewares/error.middleware';

export class AIController {
  static async chatQuery(req: Request, res: Response, next: NextFunction) {
    try {
      const { message, conversationId } = req.body;
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new AppError('Không xác định được người dùng', 401);
      }

      const { User } = require('../models/user.model');
      const dbUser = await User.findById(userId).select('assignedFacilities').lean();
      const facilityScope = dbUser?.assignedFacilities?.map(
        (f: any) => f?.toString?.() || f
      ) || [];

      const result = await ChatbotService.processQuery(userId, message.trim(), facilityScope, conversationId);

      return res.json({
        success: true,
        data: {
          ...result,
          conversationId: result.conversationId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getChatHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await ChatbotService.getChatHistory(userId, page, limit);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async clearChatHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const result = await ChatbotService.clearChatHistory(userId);

      return res.json({
        success: true,
        message: `Đã xóa ${result.deletedCount} tin nhắn`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getQuickReplies(_req: Request, res: Response, next: NextFunction) {
    try {
      const replies = ChatbotService.getQuickReplies();

      return res.json({
        success: true,
        data: replies,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getConversations(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await ChatbotService.getConversations(userId, page, limit);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getConversationMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const conversationId = req.params.conversationId as string;
      
      const result = await ChatbotService.getConversationMessages(userId, conversationId);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const conversationId = req.params.conversationId as string;
      
      const result = await ChatbotService.deleteConversation(userId, conversationId);

      return res.json({
        success: true,
        message: 'Đã xóa cuộc hội thoại',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async renameConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const conversationId = req.params.conversationId as string;
      const { title } = req.body;

      const result = await ChatbotService.renameConversation(userId, conversationId, title.trim());

      return res.json({
        success: true,
        message: 'Đã đổi tên cuộc hội thoại',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
