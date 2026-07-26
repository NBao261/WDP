import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { verifyToken, checkPermission } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  chatQuerySchema,
  conversationIdParamSchema,
  renameConversationSchema,
  aiPaginationQuerySchema,
} from '../validations/ai.validation';
import { PERMISSIONS } from '../config/permissions';

const router = Router();

// ─── Tất cả route AI yêu cầu đăng nhập ───────────────────
router.use(verifyToken);

// ─── Chatbot (FR-6.5 / RQ5) ──────────────────────────────

// POST /ai/chat-query — Gửi câu hỏi cho AI Chatbot
router.post(
  '/chat-query',
  validate(chatQuerySchema),
  checkPermission(PERMISSIONS.AI_CHATBOT),
  AIController.chatQuery
);

// GET /ai/chat-history — Lịch sử chat (phân trang)
router.get(
  '/chat-history',
  validate(aiPaginationQuerySchema),
  checkPermission(PERMISSIONS.AI_CHATBOT),
  AIController.getChatHistory
);

// DELETE /ai/chat-history — Xóa lịch sử chat
router.delete(
  '/chat-history',
  checkPermission(PERMISSIONS.AI_CHATBOT),
  AIController.clearChatHistory
);

// GET /ai/quick-replies — Gợi ý câu hỏi nhanh
router.get(
  '/quick-replies',
  checkPermission(PERMISSIONS.AI_CHATBOT),
  AIController.getQuickReplies
);

// GET /ai/conversations — Lấy danh sách conversation của user
router.get(
  '/conversations',
  validate(aiPaginationQuerySchema),
  checkPermission(PERMISSIONS.AI_CHATBOT),
  AIController.getConversations
);

// GET /ai/conversations/:conversationId — Lấy tin nhắn trong conversation
router.get(
  '/conversations/:conversationId',
  validate(conversationIdParamSchema),
  checkPermission(PERMISSIONS.AI_CHATBOT),
  AIController.getConversationMessages
);

// DELETE /ai/conversations/:conversationId — Xóa conversation
router.delete(
  '/conversations/:conversationId',
  validate(conversationIdParamSchema),
  checkPermission(PERMISSIONS.AI_CHATBOT),
  AIController.deleteConversation
);

// PATCH /ai/conversations/:conversationId/title — Đổi tên conversation
router.patch(
  '/conversations/:conversationId/title',
  validate(renameConversationSchema),
  checkPermission(PERMISSIONS.AI_CHATBOT),
  AIController.renameConversation
);

export default router;

