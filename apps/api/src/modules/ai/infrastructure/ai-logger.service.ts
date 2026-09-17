import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { AiCallResult } from '../application/ports';
import type { DataTier } from '../../../generated/prisma/enums';

interface LogInput {
  tenantId: string;
  agent: string;
  result: AiCallResult<unknown>;
  promptVersionId?: string | null | undefined;
  correlationId?: string | null | undefined;
  dataTier: DataTier;
  status: 'SUCCESS' | 'ERROR' | 'FALLBACK_SUCCESS' | 'CIRCUIT_OPEN';
  error?: string;
}

/**
 * Speech is billed per unit, not per token: characters for text-to-speech,
 * seconds of audio for speech-to-text. Those land in `tokensIn` so the monthly
 * budget query can sum one column across every kind of model spend.
 */
export interface SpeechUsage {
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
  status: LogInput['status'];
  error?: string | undefined;
}

/**
 * Writes every LLM call to `app.ai_logs` (FR-AI-10). Partitioned monthly;
 * never stores message bodies — only identifiers, cost, latency, and provider.
 *
 * Speech calls are written to the same table on purpose: a tenant's budget
 * should mean everything the AI spends on their behalf, and ElevenLabs is
 * plausibly the largest variable cost per tenant.
 */
@Injectable()
export class AiLoggerService {
  constructor(private readonly uow: UnitOfWork) {}

  /**
   * Records a synthesis or transcription. Audio is T3, but only the unit count
   * and cost are stored — never the text spoken or the words heard.
   */
  async logSpeech(input: SpeechUsage): Promise<void> {
    await this.log({
      tenantId: input.tenantId,
      agent: input.agent,
      result: {
        output: null,
        provider: input.provider,
        model: input.model,
        latencyMs: input.latencyMs ?? 0,
        tokensIn: Math.max(0, Math.round(input.units)),
        tokensOut: 0,
        costMicros: Math.max(0, Math.round(input.costMicros)),
      },
      correlationId: input.correlationId,
      dataTier: 'T3',
      status: input.status,
      ...(input.error ? { error: input.error } : {}),
    });
  }

  async log(input: LogInput): Promise<void> {
    await this.uow.withTenant(input.tenantId, async (tx) => {
      await tx.aiLog.create({
        data: {
          tenantId: input.tenantId,
          agent: input.agent,
          provider: input.result.provider,
          model: input.result.model,
          promptVersionId: input.promptVersionId ?? null,
          correlationId: input.correlationId ?? null,
          latencyMs: input.result.latencyMs,
          tokensIn: input.result.tokensIn,
          tokensOut: input.result.tokensOut,
          costMicros: input.result.costMicros,
          dataTier: input.dataTier,
          status: input.status,
          error: input.error ?? null,
        },
      });
    });
  }
}
