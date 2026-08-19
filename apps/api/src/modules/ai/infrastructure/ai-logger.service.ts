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
 * Writes every LLM call to `app.ai_logs` (FR-AI-10). Partitioned monthly;
 * never stores message bodies — only identifiers, cost, latency, and provider.
 */
@Injectable()
export class AiLoggerService {
  constructor(private readonly uow: UnitOfWork) {}

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
