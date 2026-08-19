import { z } from 'zod';

/**
 * Domain event registry (ADR-003). Payload discipline: T1/T2 data ONLY
 * (D-005) — identifiers, references, statuses. These events leave the
 * transaction via the outbox and are consumed by notifications, analytics,
 * and n8n; message bodies, documents, and anything T3 never appear here.
 * Every payload is validated at write time by OutboxWriter.
 */
export const DOMAIN_EVENTS = {
  CaseCreated: 'case.created',
  CaseAssigned: 'case.assigned',
  CaseStatusChanged: 'case.status.changed',
  MessageInboundReceived: 'message.inbound.received',
  ConversationCreated: 'conversation.created',
  ConversationStateChanged: 'conversation.state.changed',
  StaffMessageSent: 'staff.message.sent',
  AiReplySent: 'ai.reply.sent',
  AiEscalationTriggered: 'ai.escalation.triggered',
  AiIntakeCompleted: 'ai.intake.completed',
  KbIndexed: 'kb.indexed',
  PaymentRequested: 'payment.requested',
  PaymentProofReceived: 'payment.proof_received',
  PaymentSucceeded: 'payment.succeeded',
  PaymentFailed: 'payment.failed',
  PaymentRefunded: 'payment.refunded',
  UserInvited: 'user.invited',
  UserRoleChanged: 'user.role.changed',
  UserDeactivated: 'user.deactivated',
  LawyerCreated: 'lawyer.created',
  LawyerAvailabilityUpdated: 'lawyer.availability.updated',
  AppointmentBooked: 'appointment.booked',
  AppointmentCancelled: 'appointment.cancelled',
  AppointmentCompleted: 'appointment.completed',
  DocumentRequested: 'document.requested',
  DocumentRequestFulfilled: 'document.request.fulfilled',
  DocumentReceived: 'document.received',
} as const;

export type DomainEventType = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

export const domainEventPayloads = {
  [DOMAIN_EVENTS.CaseCreated]: z.object({
    caseId: z.uuid(),
    clientId: z.uuid(),
    reference: z.string().min(1),
    matterType: z.string().min(1),
  }),
  [DOMAIN_EVENTS.CaseAssigned]: z.object({
    caseId: z.uuid(),
    lawyerId: z.uuid(),
    role: z.string().min(1),
  }),
  [DOMAIN_EVENTS.CaseStatusChanged]: z.object({
    caseId: z.uuid(),
    from: z.string().min(1),
    to: z.string().min(1),
  }),
  [DOMAIN_EVENTS.MessageInboundReceived]: z.object({
    conversationId: z.uuid(),
    messageId: z.uuid(),
    clientId: z.uuid(),
    contentType: z.string().min(1),
  }),
  [DOMAIN_EVENTS.ConversationCreated]: z.object({
    conversationId: z.uuid(),
    clientId: z.uuid(),
  }),
  [DOMAIN_EVENTS.ConversationStateChanged]: z.object({
    conversationId: z.uuid(),
    from: z.string().min(1),
    to: z.string().min(1),
  }),
  [DOMAIN_EVENTS.StaffMessageSent]: z.object({
    conversationId: z.uuid(),
    messageId: z.string().min(1),
  }),
  [DOMAIN_EVENTS.AiReplySent]: z.object({
    conversationId: z.uuid(),
  }),
  [DOMAIN_EVENTS.AiEscalationTriggered]: z.object({
    conversationId: z.uuid(),
    escalationId: z.uuid(),
    triggerType: z.string().min(1),
  }),
  [DOMAIN_EVENTS.AiIntakeCompleted]: z.object({
    conversationId: z.uuid(),
    intakeSessionId: z.uuid(),
    practiceArea: z.string().optional(),
  }),
  [DOMAIN_EVENTS.KbIndexed]: z.object({
    kbId: z.uuid(),
    tenantId: z.uuid(),
    chunkCount: z.number().int().min(0),
  }),
  [DOMAIN_EVENTS.PaymentRequested]: z.object({
    paymentId: z.uuid(),
    caseId: z.uuid().optional(),
    clientId: z.uuid(),
    amountCents: z.number().int().min(0),
    currency: z.string().length(3),
    method: z.string().min(1),
    description: z.string().max(200).optional(),
  }),
  [DOMAIN_EVENTS.PaymentProofReceived]: z.object({
    paymentId: z.uuid(),
    clientId: z.uuid(),
    documentId: z.uuid(),
    messageId: z.uuid(),
    conversationId: z.uuid().optional(),
  }),
  [DOMAIN_EVENTS.PaymentSucceeded]: z.object({
    paymentId: z.uuid(),
    providerTxnId: z.string().optional(),
    paidAt: z.string().datetime(),
    amountCents: z.number().int().min(0),
    clientId: z.uuid().optional(),
    caseId: z.uuid().optional(),
  }),
  [DOMAIN_EVENTS.PaymentFailed]: z.object({
    paymentId: z.uuid(),
    reason: z.string().optional(),
  }),
  [DOMAIN_EVENTS.PaymentRefunded]: z.object({
    paymentId: z.uuid(),
    refundedAmountCents: z.number().int().min(0),
  }),
  [DOMAIN_EVENTS.UserInvited]: z.object({
    userId: z.uuid(),
    email: z.string().min(1),
    roleId: z.uuid(),
  }),
  [DOMAIN_EVENTS.UserRoleChanged]: z.object({
    userId: z.uuid(),
    fromRoleId: z.uuid(),
    toRoleId: z.uuid(),
  }),
  [DOMAIN_EVENTS.UserDeactivated]: z.object({
    userId: z.uuid(),
  }),
  [DOMAIN_EVENTS.LawyerCreated]: z.object({
    lawyerId: z.uuid(),
    userId: z.uuid(),
  }),
  [DOMAIN_EVENTS.LawyerAvailabilityUpdated]: z.object({
    lawyerId: z.uuid(),
  }),
  [DOMAIN_EVENTS.AppointmentBooked]: z.object({
    appointmentId: z.uuid(),
    lawyerId: z.uuid(),
    clientId: z.uuid(),
    caseId: z.uuid().optional(),
    startsAt: z.string().datetime(),
  }),
  [DOMAIN_EVENTS.AppointmentCancelled]: z.object({
    appointmentId: z.uuid(),
  }),
  [DOMAIN_EVENTS.AppointmentCompleted]: z.object({
    appointmentId: z.uuid(),
    lawyerId: z.uuid(),
    clientId: z.uuid(),
    caseId: z.uuid().optional(),
  }),
  [DOMAIN_EVENTS.DocumentRequested]: z.object({
    documentRequestId: z.uuid(),
    caseId: z.uuid(),
    clientId: z.uuid(),
  }),
  [DOMAIN_EVENTS.DocumentRequestFulfilled]: z.object({
    documentRequestId: z.uuid(),
    caseId: z.uuid(),
    documentId: z.uuid().nullable(),
  }),
  [DOMAIN_EVENTS.DocumentReceived]: z.object({
    documentId: z.uuid(),
    clientId: z.uuid(),
    messageId: z.uuid(),
    caseId: z.uuid().optional(),
  }),
} satisfies Record<DomainEventType, z.ZodType>;
