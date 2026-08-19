import { z } from 'zod';

export const connectionStageSchema = z.enum([
  'OFFICIAL_CONNECT_STARTED',
  'META_PENDING_VERIFICATION',
  'NUMBER_VERIFIED',
  'TEMPLATES_PENDING',
  'READY_TO_GO_LIVE',
  'LIVE',
  'PAUSED',
  'REJECTED',
  'DISCONNECTED',
]);

export type ConnectionStage = z.infer<typeof connectionStageSchema>;

export const onboardingStartSchema = z.object({
  appId: z.string(),
  redirectUri: z.string().nullable(),
  scopes: z.array(z.string()),
});

export const onboardingCompleteSchema = z.object({
  tenantId: z.string(),
  wabaId: z.string(),
  phoneNumberId: z.string(),
  displayPhoneNumber: z.string(),
  templatesSeeded: z.number().int().nonnegative(),
  connectionStage: connectionStageSchema,
});

export const whatsappConnectionStatusSchema = z.object({
  connected: z.boolean(),
  provider: z.literal('META_CLOUD'),
  verificationStatus: z.enum(['NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED']),
  connectionStage: connectionStageSchema,
  displayPhoneNumber: z.string().nullable(),
  wabaId: z.string().nullable(),
  templates: z.object({
    approved: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    paused: z.number().int().nonnegative(),
  }),
});

export const whatsappHealthSchema = z.object({
  connectionStage: connectionStageSchema,
  verificationStatus: z.enum(['NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED']),
  displayPhoneNumber: z.string().nullable(),
  webhookConfigured: z.boolean(),
  webhookVerifyTokenPresent: z.boolean(),
  goLiveChecklist: z.object({
    accountConnected: z.boolean(),
    numberVerified: z.boolean(),
    hasApprovedTemplates: z.boolean(),
    readyForGoLive: z.boolean(),
  }),
  templates: z.object({
    approved: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    paused: z.number().int().nonnegative(),
  }),
});

export const connectionStageMutationSchema = z.object({ connectionStage: connectionStageSchema });

export const pilotPairResponseSchema = z.object({
  status: z.enum(['PAIRING', 'PAIRED', 'EXPIRED', 'DISCONNECTED']),
  expiresAt: z.string().datetime().nullable(),
});

export const pilotQrSchema = z.object({ qr: z.string().nullable() });

export const pilotAllowlistEntrySchema = z.object({
  number: z.string(),
  label: z.string().nullable(),
});

export const pilotStatusSchema = z.object({
  status: z.enum(['PAIRING', 'PAIRED', 'EXPIRED', 'DISCONNECTED']),
  allowlist: z.array(pilotAllowlistEntrySchema),
  expiresAt: z.string().datetime().nullable(),
  lastSeenAt: z.string().datetime().nullable(),
  lastError: z.string().nullable(),
  lastErrorAt: z.string().datetime().nullable(),
  bridgeAlive: z.boolean(),
});

export const pilotAllowlistResponseSchema = z.object({
  allowlist: z.array(pilotAllowlistEntrySchema),
});

export const pilotTestInboundSchema = z.object({
  fromWaPhone: z.string().trim().regex(/^\d[\d\s+-]*$/, 'Enter a valid phone number').min(7).max(15),
  body: z.string().trim().min(1).max(500),
});

export const pilotTestInboundResponseSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
});

export const whatsappUpgradeStatusSchema = z.object({
  enabled: z.boolean(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
});

export const whatsappUpgradeInitiateSchema = z.object({
  paymentId: z.string(),
  redirectUrl: z.string().nullable(),
  status: z.string(),
});

export const evolutionConnectionStatusSchema = z.object({
  instanceName: z.string(),
  connectionType: z.enum(['baileys', 'cloud_api']),
  status: z.enum(['disconnected', 'connecting', 'connected']),
  phoneNumber: z.string().nullable(),
  displayName: z.string().nullable(),
  qrCode: z.string().nullable(),
});

export type EvolutionConnectionStatus = z.infer<typeof evolutionConnectionStatusSchema>;

export const evolutionConnectSchema = z.object({
  connectionType: z.enum(['baileys', 'cloud_api']).default('baileys'),
});

export const aiAutoReplySchema = z.object({
  aiAutoReplyEnabled: z.boolean(),
});

export type AiAutoReply = z.infer<typeof aiAutoReplySchema>;
