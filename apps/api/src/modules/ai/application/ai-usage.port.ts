/**
 * Port for recording speech spend against a tenant.
 *
 * Text-to-speech and speech-to-text live in the `voice` module, but `ai_logs`
 * is owned by the AI module — and a tenant's budget should cover everything the
 * AI spends on their behalf, not just model tokens. This port lets voice report
 * usage without reaching into AI internals.
 */
export interface SpeechUsageRecord {
  tenantId: string;
  /** `tts` or `stt`, suffixed with the surface, e.g. `tts:whatsapp-note`. */
  agent: string;
  provider: string;
  model: string;
  /** Characters synthesized, or whole seconds transcribed. */
  units: number;
  costMicros: number;
  latencyMs?: number | undefined;
  correlationId?: string | null | undefined;
  status: 'SUCCESS' | 'ERROR' | 'FALLBACK_SUCCESS' | 'CIRCUIT_OPEN';
  error?: string | undefined;
}

export interface AiUsagePort {
  logSpeech(input: SpeechUsageRecord): Promise<void>;
}

export const AI_USAGE = Symbol('AI_USAGE');
