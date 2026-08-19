import { z } from 'zod';

export const aiToneSchema = z.enum(['formal', 'friendly', 'concise']);
export const aiVoiceGenderSchema = z.enum(['male', 'female']);
export const aiVoiceReplyModeSchema = z.enum(['voice_only', 'text_only', 'auto']);
export const aiLanguagePolicySchema = z.enum(['mirror', 'english_only', 'urdu_preferred']);
export const aiReplyLengthSchema = z.enum(['short', 'balanced', 'detailed']);

export const aiSettingsSchema = z.object({
  aiAutoReplyEnabled: z.boolean(),
  aiAutoReplyRequiresApproval: z.boolean(),
  aiUrduReplyEnabled: z.boolean(),
  aiLanguagePolicy: aiLanguagePolicySchema,
  aiConsentMessage: z.string().max(500),
  aiGreetingIntro: z.string().max(500),
  aiTone: aiToneSchema,
  aiReplyLength: aiReplyLengthSchema,
  aiAskClarifyingQuestions: z.boolean(),
  aiNeverInventCaseFacts: z.boolean(),
  aiMentionConsultationFee: z.boolean(),
  aiFirmScopeOnly: z.boolean(),
  aiCustomInstructions: z.string().max(2000),
  aiHandoffMessage: z.string().max(1000),
  aiHandoffSlaMinutes: z.number().int().min(0).max(1440),
  aiVoiceEnabled: z.boolean(),
  aiVoiceGender: aiVoiceGenderSchema,
  aiVoiceReplyMode: aiVoiceReplyModeSchema,
  aiVoiceId: z.string().max(80),
});

export type AiSettings = z.infer<typeof aiSettingsSchema>;

export const generateIntroResultSchema = z.object({
  language: z.enum(['en', 'ur']),
  intro: z.string().min(1),
  source: z.enum(['ai', 'template']).optional(),
});

export const ttsVoiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  gender: z.enum(['male', 'female', 'neutral']),
  accent: z.string(),
});

export const voiceListSchema = z.object({
  configured: z.boolean(),
  voices: z.array(ttsVoiceSchema),
});

export const voicePreviewSchema = z.object({
  mimeType: z.string(),
  audioBase64: z.string().min(1),
});

export const kbEntrySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  language: z.string(),
  category: z.string().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const kbListSchema = z.array(kbEntrySchema);

export const createKbSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(100_000),
  language: z.string().min(2).max(5),
  category: z.string().max(100).optional(),
});

export type CreateKbInput = z.infer<typeof createKbSchema>;
export type TtsVoice = z.infer<typeof ttsVoiceSchema>;
