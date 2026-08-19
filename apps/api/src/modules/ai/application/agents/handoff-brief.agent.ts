import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { AiClientFactory } from '../../infrastructure/ai-client.factory';
import { AiLoggerService } from '../../infrastructure/ai-logger.service';
import { MODEL_ROUTER, type ModelRouter } from '../ports';
import type { HandoffBrief } from '../handoff-brief';

const situationSchema = z.object({
  situation: z.string().min(1).max(800),
});

/**
 * Short T2 narrative for the lawyer after the client already received the
 * handoff WhatsApp. Never sent document text (D-005).
 */
@Injectable()
export class HandoffBriefAgent {
  private readonly logger = new Logger(HandoffBriefAgent.name);
  private readonly agent = 'handoff-brief';

  constructor(
    private readonly clientFactory: AiClientFactory,
    @Inject(MODEL_ROUTER) private readonly modelRouter: ModelRouter,
    private readonly aiLogger: AiLoggerService,
  ) {}

  async summarize(params: {
    tenantId: string;
    tenantAllowlist: string[];
    conversationHistory: string;
    brief: HandoffBrief;
    correlationId?: string | null | undefined;
  }): Promise<string | null> {
    const budgetOk = await this.modelRouter.checkBudget(params.tenantId, 8_000);
    if (!budgetOk) return null;

    const history = params.conversationHistory.trim().slice(0, 4000);
    if (!history) return null;

    try {
      const choice = this.modelRouter.choose(this.agent, params.tenantId, params.tenantAllowlist);
      const client = this.clientFactory.get(choice.provider);
      const result = await client.call<z.infer<typeof situationSchema>>({
        tenantId: params.tenantId,
        agent: this.agent,
        messages: [
          {
            role: 'system',
            content: `You write a 2-4 sentence operational brief for a Pakistani lawyer taking over a WhatsApp client chat.
Use only the structured facts and the chat excerpt. No legal advice, no invented facts, no document contents.
Return JSON: { "situation": "..." }.`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              reason: params.brief.reason,
              matterType: params.brief.matterType,
              facts: params.brief.facts,
              openItems: params.brief.openItems,
              nextAction: params.brief.nextAction,
              chatExcerpt: history,
            }),
          },
        ],
        outputSchema: situationSchema,
        model: choice.model,
        temperature: 0.2,
        maxTokens: 280,
        timeoutMs: 8_000,
        correlationId: params.correlationId,
      });

      await this.aiLogger.log({
        tenantId: params.tenantId,
        agent: this.agent,
        result,
        correlationId: params.correlationId,
        dataTier: 'T2',
        status: 'SUCCESS',
      });

      const text = result.output.situation.trim();
      return text.length > 0 ? text : null;
    } catch (error) {
      this.logger.warn({ tenantId: params.tenantId, error }, 'handoff brief situation LLM failed');
      return null;
    }
  }
}
