import { Request, Response, NextFunction } from 'express';
import { ChatbotService } from '../services/chatbot.service';
import { AppError } from '../middlewares/error.middleware';

export class AIController {
  // ─── Chatbot (FR-6.5 / RQ5) ─────────────────────────────

  /**
   * POST /api/v1/ai/chat-query
   * Body: { message: string }
   * 
   * Gửi câu hỏi cho AI Chatbot, nhận câu trả lời + dữ liệu
   */
  static async chatQuery(req: Request, res: Response, next: NextFunction) {
    try {
      const { message, conversationId } = req.body;
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new AppError('Không xác định được người dùng', 401);
      }

      // message đã được validate bởi Zod middleware (min 1, max 2000, trim)
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

  /**
   * GET /api/v1/ai/chat-history
   * Query: page, limit
   * 
   * Lấy lịch sử chat của user hiện tại (phân trang)
   */
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

  /**
   * DELETE /api/v1/ai/chat-history
   * 
   * Xóa toàn bộ lịch sử chat của user hiện tại
   */
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

  /**
   * GET /api/v1/ai/quick-replies
   * 
   * Lấy danh sách gợi ý câu hỏi nhanh
   */
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

  /**
   * GET /api/v1/ai/conversations
   * Lấy danh sách các cuộc hội thoại của user
   */
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

  /**
   * GET /api/v1/ai/conversations/:conversationId
   * Lấy chi tiết tin nhắn trong một cuộc hội thoại
   */
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

  /**
   * DELETE /api/v1/ai/conversations/:conversationId
   * Xóa một cuộc hội thoại
   */
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

  /**
   * PATCH /api/v1/ai/conversations/:conversationId/title
   * Đổi tên cuộc hội thoại
   */
  static async renameConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const conversationId = req.params.conversationId as string;
      const { title } = req.body;

      // title đã được validate bởi Zod middleware (min 1, max 200, trim)

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
