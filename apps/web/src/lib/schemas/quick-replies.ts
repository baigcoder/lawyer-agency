import { z } from 'zod';

export const quickReplyLanguageSchema = z.enum(['en', 'ur']);

export const quickReplySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string(),
  language: quickReplyLanguageSchema,
  updatedAt: z.string(),
});

export const quickReplyListSchema = z.array(quickReplySchema);

export const quickReplyFormSchema = z.object({
  title: z.string().trim().min(1, 'Give it a short name').max(80),
  body: z.string().trim().min(1, 'Write the message').max(4000),
  language: quickReplyLanguageSchema,
});

export type QuickReply = z.infer<typeof quickReplySchema>;
export type QuickReplyForm = z.infer<typeof quickReplyFormSchema>;
