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

router.use(verifyToken);

router.post(
  '/chat-query',
  validate(chatQuerySchema),
  checkPermission(PERMISSIONS.AI_CHATBOT),
  AIController.chatQuery
);

router.get(
  '/chat-history',
  validate(aiPaginationQuerySchema),
  checkPermission(PERMISSIONS.AI_CHATBOT),
  AIController.getChatHistory
);

router.delete(
  '/chat-history',
  checkPermission(PERMISSIONS.AI_CHATBOT),
  AIController.clearChatHistory
);

router.get(
  '/quick-replies',
  checkPermission(PERMISSIONS.AI_CHATBOT),
  AIController.getQuickReplies
);

router.get(
  '/conversations',
  validate(aiPaginationQuerySchema),
  checkPermission(PERMISSIONS.AI_CHATBOT),
  AIController.getConversations
);

router.get(
  '/conversations/:conversationId',
  validate(conversationIdParamSchema),
  checkPermission(PERMISSIONS.AI_CHATBOT),
  AIController.getConversationMessages
);

router.delete(
  '/conversations/:conversationId',
  validate(conversationIdParamSchema),
  checkPermission(PERMISSIONS.AI_CHATBOT),
  AIController.deleteConversation
);

router.patch(
  '/conversations/:conversationId/title',
  validate(renameConversationSchema),
  checkPermission(PERMISSIONS.AI_CHATBOT),
  AIController.renameConversation
);

export default router;

