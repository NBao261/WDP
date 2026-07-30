import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const chatQuerySchema = z.object({
  body: z.object({
    message: z
      .string({ required_error: 'Vui lòng nhập câu hỏi' })
      .min(1, 'Vui lòng nhập câu hỏi')
      .max(2000, 'Câu hỏi quá dài (tối đa 2000 ký tự)')
      .trim(),
    conversationId: z.string().max(100, 'Conversation ID quá dài').nullable().optional().transform(v => v || undefined),
  }),
});

export const conversationIdParamSchema = z.object({
  params: z.object({
    conversationId: z
      .string({ required_error: 'Conversation ID không được để trống' })
      .min(1, 'Conversation ID không được để trống')
      .max(100, 'Conversation ID quá dài'),
  }),
});

export const renameConversationSchema = z.object({
  params: z.object({
    conversationId: z
      .string({ required_error: 'Conversation ID không được để trống' })
      .min(1, 'Conversation ID không được để trống')
      .max(100, 'Conversation ID quá dài'),
  }),
  body: z.object({
    title: z
      .string({ required_error: 'Vui lòng nhập tiêu đề mới' })
      .min(1, 'Vui lòng nhập tiêu đề mới')
      .max(200, 'Tiêu đề quá dài (tối đa 200 ký tự)')
      .trim(),
  }),
});

export const aiPaginationQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/, 'Page must be a number').optional(),
    limit: z.string().regex(/^\d+$/, 'Limit must be a number').optional(),
  }),
});
