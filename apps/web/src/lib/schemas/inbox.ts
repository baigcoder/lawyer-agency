import { z } from 'zod';

const senderSchema = z.enum(['CLIENT', 'AI', 'LAWYER', 'STAFF', 'SYSTEM']);

export const conversationStateSchema = z.enum([
  'AI_ACTIVE',
  'HUMAN_REQUIRED',
  'HUMAN_ACTIVE',
  'CLOSED',
]);

export const assigneeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  roleName: z.string(),
});

export const inboxMessageSchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  senderType: senderSchema,
  senderName: z.string().nullable(),
  body: z.string().nullable(),
  contentType: z.string(),
  deliveryStatus: z.string(),
  mediaUrl: z.string().nullable().optional(),
  mediaDurationSeconds: z.number().nullable().optional(),
  documentId: z.string().uuid().nullable().optional(),
  pendingApproval: z.boolean().optional(),
  createdAt: z.coerce.date(),
});

export const inboxSummarySchema = z.object({
  id: z.string().uuid(),
  state: conversationStateSchema,
  client: z.object({
    id: z.string().uuid(),
    name: z.string().nullable(),
    waPhone: z.string(),
  }),
  case: z.object({ id: z.string().uuid(), reference: z.string() }).nullable(),
  assignedTo: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  lastMessage: z
    .object({
      body: z.string().nullable(),
      senderType: senderSchema,
      contentType: z.string().optional(),
      createdAt: z.coerce.date(),
    })
    .nullable(),
  unreadCount: z.number(),
  sessionWindowExpiresAt: z.coerce.date().nullable(),
  lastClientMessageAt: z.coerce.date().nullable(),
  updatedAt: z.coerce.date(),
  documentCount: z.number().optional(),
  pendingDraft: z
    .object({ messageId: z.string().uuid(), body: z.string() })
    .nullable()
    .optional(),
  pendingPayment: z
    .object({
      id: z.string().uuid(),
      amountCents: z.number().int(),
      currency: z.string(),
      description: z.string().nullable(),
      proofMessageId: z.string().uuid().nullable(),
      proofDocumentId: z.string().uuid().nullable(),
    })
    .nullable()
    .optional(),
});

export const inboxDetailSchema = z.object({
  conversation: inboxSummarySchema,
  messages: z.array(inboxMessageSchema),
});

export const inboxListSchema = z.array(inboxSummarySchema);

export type ConversationState = z.infer<typeof conversationStateSchema>;
export type InboxMessage = z.infer<typeof inboxMessageSchema>;
export type InboxSummary = z.infer<typeof inboxSummarySchema>;
export type InboxDetail = z.infer<typeof inboxDetailSchema>;
export type Assignee = z.infer<typeof assigneeSchema>;
