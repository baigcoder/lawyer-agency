import { z } from 'zod';

export const aiToneSchema = z.enum(['formal', 'friendly', 'concise']);
export const aiVoiceGenderSchema = z.enum(['male', 'female']);
export const aiVoiceReplyModeSchema = z.enum(['voice_only', 'text_only', 'auto']);
export const aiLanguagePolicySchema = z.enum(['mirror', 'english_only', 'urdu_preferred']);
export const aiReplyLengthSchema = z.enum(['short', 'balanced', 'detailed']);
export const callsTakenBySchema = z.enum(['off', 'ai']);

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
  callsTakenBy: callsTakenBySchema,
  aiCallHoursStart: z.string().max(5),
  aiCallHoursEnd: z.string().max(5),
  aiCallHoursTimezone: z.string().max(64),
});

export type AiSettings = z.infer<typeof aiSettingsSchema>;
export type AiTone = z.infer<typeof aiToneSchema>;
export type AiLanguagePolicy = z.infer<typeof aiLanguagePolicySchema>;

export const generateIntroInputSchema = z.object({
  language: z.enum(['en', 'ur']),
});

export type GenerateIntroInput = z.infer<typeof generateIntroInputSchema>;

export const defaultAiGreetingIntro = '';

export function defaultAiSettings(): AiSettings {
  return {
    aiAutoReplyEnabled: true,
    aiAutoReplyRequiresApproval: false,
    aiUrduReplyEnabled: true,
    aiLanguagePolicy: 'mirror',
    aiConsentMessage: '',
    aiGreetingIntro: defaultAiGreetingIntro,
    aiTone: 'friendly',
    aiReplyLength: 'balanced',
    aiAskClarifyingQuestions: true,
    aiNeverInventCaseFacts: true,
    aiMentionConsultationFee: false,
    aiFirmScopeOnly: true,
    aiCustomInstructions: '',
    aiHandoffMessage: '',
    aiHandoffSlaMinutes: 0,
    aiVoiceEnabled: false,
    aiVoiceGender: 'female',
    aiVoiceReplyMode: 'auto',
    aiVoiceId: '',
    callsTakenBy: 'ai',
    aiCallHoursStart: '',
    aiCallHoursEnd: '',
    aiCallHoursTimezone: 'Asia/Karachi',
  };
}

export function parseAiSettings(raw: Record<string, unknown>): AiSettings {
  const defaults = defaultAiSettings();
  const tone = raw['aiTone'];
  const voiceGender = raw['aiVoiceGender'];
  const voiceReplyMode = raw['aiVoiceReplyMode'];
  const languagePolicy = raw['aiLanguagePolicy'];
  const replyLength = raw['aiReplyLength'];
  const callsTakenBy = raw['callsTakenBy'];
  return {
    aiAutoReplyEnabled:
      typeof raw['aiAutoReplyEnabled'] === 'boolean' ? raw['aiAutoReplyEnabled'] : defaults.aiAutoReplyEnabled,
    aiAutoReplyRequiresApproval:
      typeof raw['aiAutoReplyRequiresApproval'] === 'boolean'
        ? raw['aiAutoReplyRequiresApproval']
        : defaults.aiAutoReplyRequiresApproval,
    aiUrduReplyEnabled:
      typeof raw['aiUrduReplyEnabled'] === 'boolean' ? raw['aiUrduReplyEnabled'] : defaults.aiUrduReplyEnabled,
    aiLanguagePolicy: aiLanguagePolicySchema.safeParse(languagePolicy).success
      ? (languagePolicy as AiSettings['aiLanguagePolicy'])
      : defaults.aiLanguagePolicy,
    aiConsentMessage:
      typeof raw['aiConsentMessage'] === 'string' ? raw['aiConsentMessage'].slice(0, 500) : defaults.aiConsentMessage,
    aiGreetingIntro:
      typeof raw['aiGreetingIntro'] === 'string' ? raw['aiGreetingIntro'].slice(0, 500) : defaults.aiGreetingIntro,
    aiTone: aiToneSchema.safeParse(tone).success ? (tone as AiSettings['aiTone']) : defaults.aiTone,
    aiReplyLength: aiReplyLengthSchema.safeParse(replyLength).success
      ? (replyLength as AiSettings['aiReplyLength'])
      : defaults.aiReplyLength,
    aiAskClarifyingQuestions:
      typeof raw['aiAskClarifyingQuestions'] === 'boolean'
        ? raw['aiAskClarifyingQuestions']
        : defaults.aiAskClarifyingQuestions,
    aiNeverInventCaseFacts:
      typeof raw['aiNeverInventCaseFacts'] === 'boolean'
        ? raw['aiNeverInventCaseFacts']
        : defaults.aiNeverInventCaseFacts,
    aiMentionConsultationFee:
      typeof raw['aiMentionConsultationFee'] === 'boolean'
        ? raw['aiMentionConsultationFee']
        : defaults.aiMentionConsultationFee,
    aiFirmScopeOnly:
      typeof raw['aiFirmScopeOnly'] === 'boolean' ? raw['aiFirmScopeOnly'] : defaults.aiFirmScopeOnly,
    aiCustomInstructions:
      typeof raw['aiCustomInstructions'] === 'string' ? raw['aiCustomInstructions'].slice(0, 2000) : '',
    aiHandoffMessage: typeof raw['aiHandoffMessage'] === 'string' ? raw['aiHandoffMessage'].slice(0, 1000) : '',
    aiHandoffSlaMinutes:
      typeof raw['aiHandoffSlaMinutes'] === 'number' &&
      Number.isInteger(raw['aiHandoffSlaMinutes']) &&
      raw['aiHandoffSlaMinutes'] >= 0 &&
      raw['aiHandoffSlaMinutes'] <= 1440
        ? raw['aiHandoffSlaMinutes']
        : defaults.aiHandoffSlaMinutes,
    aiVoiceEnabled: typeof raw['aiVoiceEnabled'] === 'boolean' ? raw['aiVoiceEnabled'] : defaults.aiVoiceEnabled,
    aiVoiceGender: aiVoiceGenderSchema.safeParse(voiceGender).success
      ? (voiceGender as AiSettings['aiVoiceGender'])
      : defaults.aiVoiceGender,
    aiVoiceReplyMode: aiVoiceReplyModeSchema.safeParse(voiceReplyMode).success
      ? (voiceReplyMode as AiSettings['aiVoiceReplyMode'])
      : defaults.aiVoiceReplyMode,
    aiVoiceId: typeof raw['aiVoiceId'] === 'string' ? raw['aiVoiceId'].trim().slice(0, 80) : '',
    callsTakenBy: callsTakenBySchema.safeParse(callsTakenBy).success
      ? (callsTakenBy as AiSettings['callsTakenBy'])
      : defaults.callsTakenBy,
    aiCallHoursStart: parseHourMinute(raw['aiCallHoursStart'], defaults.aiCallHoursStart),
    aiCallHoursEnd: parseHourMinute(raw['aiCallHoursEnd'], defaults.aiCallHoursEnd),
    aiCallHoursTimezone:
      typeof raw['aiCallHoursTimezone'] === 'string' && raw['aiCallHoursTimezone'].trim().length > 0
        ? raw['aiCallHoursTimezone'].trim().slice(0, 64)
        : defaults.aiCallHoursTimezone,
  };
}

export function persistAiSettings(parsed: AiSettings): Record<string, unknown> {
  return {
    aiAutoReplyEnabled: parsed.aiAutoReplyEnabled,
    aiAutoReplyRequiresApproval: parsed.aiAutoReplyRequiresApproval,
    aiUrduReplyEnabled: parsed.aiUrduReplyEnabled,
    aiLanguagePolicy: parsed.aiLanguagePolicy,
    aiConsentMessage: parsed.aiConsentMessage,
    aiGreetingIntro: parsed.aiGreetingIntro,
    aiTone: parsed.aiTone,
    aiReplyLength: parsed.aiReplyLength,
    aiAskClarifyingQuestions: parsed.aiAskClarifyingQuestions,
    aiNeverInventCaseFacts: parsed.aiNeverInventCaseFacts,
    aiMentionConsultationFee: parsed.aiMentionConsultationFee,
    aiFirmScopeOnly: parsed.aiFirmScopeOnly,
    aiCustomInstructions: parsed.aiCustomInstructions,
    aiHandoffMessage: parsed.aiHandoffMessage,
    aiHandoffSlaMinutes: parsed.aiHandoffSlaMinutes,
    aiVoiceEnabled: parsed.aiVoiceEnabled,
    aiVoiceGender: parsed.aiVoiceGender,
    aiVoiceReplyMode: parsed.aiVoiceReplyMode,
    aiVoiceId: parsed.aiVoiceId,
    callsTakenBy: parsed.callsTakenBy,
    aiCallHoursStart: parsed.aiCallHoursStart,
    aiCallHoursEnd: parsed.aiCallHoursEnd,
    aiCallHoursTimezone: parsed.aiCallHoursTimezone,
  };
}

export interface GreetingIntroSource {
  displayName: string;
  city: string;
  practiceAreas: string[];
  firmAbout: string;
}

export function generateGreetingIntro(source: GreetingIntroSource, language: 'en' | 'ur'): string {
  if (language === 'ur') {
    return clipIntro(`{{displayName}} کا WhatsApp اے آئی اسسٹنٹ — انٹیک اور عمومی سوالات میں مدد`);
  }
  return clipIntro(`AI assistant for {{displayName}} — helps with intake and general questions`);
}

export function buildAiAssumptionsBlock(settings: AiSettings): string {
  const lines = [
    'Never give legal advice, legal conclusions, or predict case outcomes.',
    settings.aiNeverInventCaseFacts
      ? 'Do not invent case facts, dates, documents, or outcomes. If something is unknown, ask — do not assume.'
      : 'Prefer asking over guessing when case facts are missing.',
    settings.aiAskClarifyingQuestions
      ? 'When intake is incomplete, ask one or two clarifying questions before handing off.'
      : 'Do not probe with extra clarifying questions unless the client is stuck.',
    settings.aiMentionConsultationFee
      ? 'When relevant, mention the consultation fee from firm settings.'
      : 'Do not quote fees unless the client asks.',
    settings.aiFirmScopeOnly
      ? 'Only answer questions about this law firm, legal intake, appointments, documents, or an existing case. Do not engage in casual chat, flirting, jokes, or small talk (for example "hi love"). Briefly redirect to how the firm can help.'
      : 'Stay professional; you may greet, but do not flirt or role-play.',
    replyLengthInstruction(settings.aiReplyLength),
    languagePolicyInstruction(settings),
  ];
  return lines.join('\n');
}

function parseHourMinute(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (trimmed === '') return '';
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed) ? trimmed : fallback;
}

function replyLengthInstruction(length: AiSettings['aiReplyLength']): string {
  if (length === 'short') return 'Keep replies short (2–4 sentences) unless the client asks for more.';
  if (length === 'detailed') return 'Give a thorough reply with clear next steps, still without legal advice.';
  return 'Keep replies balanced: enough to help, not a long essay.';
}

function languagePolicyInstruction(settings: AiSettings): string {
  if (settings.aiLanguagePolicy === 'english_only' || !settings.aiUrduReplyEnabled) {
    return 'Reply in English only.';
  }
  if (settings.aiLanguagePolicy === 'urdu_preferred') {
    return 'If the client wrote Urdu or Roman Urdu, reply in that script. Otherwise English is fine.';
  }
  return 'Reply in the same language and script the client just used (English, Urdu, or Roman Urdu).';
}

export function clipIntro(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length <= 500 ? trimmed : `${trimmed.slice(0, 497)}...`;
}
