import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiClientFactory } from '../infrastructure/ai-client.factory';
import { renderTemplate } from '../infrastructure/prompt.repository';
import { AiLoggerService } from '../infrastructure/ai-logger.service';
import type { EscalationSignal } from '../domain/types';
import { MODEL_ROUTER, PROMPT_REPOSITORY, type ModelRouter, type PromptRepository } from './ports';
import { isShortGreeting } from './dynamic-reply-rules';

const escalationSchema = z.looseObject({
  triggered: z.boolean(),
  triggerType: z.enum(['SELF_HARM', 'DOMESTIC_VIOLENCE', 'ACTIVE_ARREST', 'IMMINENT_DEADLINE', 'MANUAL']).optional(),
  reason: z.string().optional(),
  excerpt: z.string().optional(),
});

/**
 * Scans inbound client text for safety/urgency signals (FR-ESC-01, D-009).
 * Keyword scan runs first (fast, bilingual). The LLM is used only when the
 * message looks safety-adjacent but did not match a hard phrase.
 */
@Injectable()
export class EscalationDetectorService {
  private readonly agent = 'escalation';

  constructor(
    private readonly clientFactory: AiClientFactory,
    @Inject(MODEL_ROUTER) private readonly modelRouter: ModelRouter,
    @Inject(PROMPT_REPOSITORY) private readonly prompts: PromptRepository,
    private readonly logger: AiLoggerService,
  ) {}

  scanKeywords(text: string): EscalationSignal | null {
    return keywordScan(text);
  }

  needsLlmTriage(text: string): boolean {
    if (!text.trim() || isShortGreeting(text)) return false;
    if (keywordScan(text)) return false;
    return SAFETY_STEMS.some((stem) => text.toLowerCase().includes(stem));
  }

  async detect(params: {
    tenantId: string;
    tenantAllowlist: string[];
    clientText: string;
    correlationId?: string | null | undefined;
  }): Promise<EscalationSignal | null> {
    const keywordHit = keywordScan(params.clientText);
    if (keywordHit) return keywordHit;
    if (!this.needsLlmTriage(params.clientText)) return null;

    const prompt = (await this.prompts.findActive(params.tenantId, this.agent)) ?? {
      id: null,
      agent: this.agent,
      version: 1,
      template: defaultEscalationPrompt,
    };

    const choice = this.modelRouter.choose(this.agent, params.tenantId, params.tenantAllowlist);
    const client = this.clientFactory.get(choice.provider);

    const rendered = renderTemplate(prompt.template, { clientText: params.clientText });
    const budgetOk = await this.modelRouter.checkBudget(params.tenantId, 100_000);
    if (!budgetOk) {
      return keywordScan(params.clientText);
    }

    try {
      const result = await client.call<z.infer<typeof escalationSchema>>({
        tenantId: params.tenantId,
        agent: this.agent,
        messages: [
          { role: 'system', content: rendered },
          { role: 'user', content: params.clientText },
        ],
        outputSchema: escalationSchema,
        model: choice.model,
        promptVersionId: prompt.id,
        correlationId: params.correlationId,
        maxTokens: 256,
        timeoutMs: 12_000,
      });

      await this.logger.log({
        tenantId: params.tenantId,
        agent: this.agent,
        result,
        promptVersionId: prompt.id,
        correlationId: params.correlationId,
        dataTier: 'T2',
        status: 'SUCCESS',
      });

      if (!result.output.triggered || !result.output.triggerType) return null;
      return {
        triggerType: result.output.triggerType,
        reason: result.output.reason ?? 'escalation model triggered',
        excerpt: result.output.excerpt ?? params.clientText.slice(0, 200),
      };
    } catch (error) {
      await this.logger.log({
        tenantId: params.tenantId,
        agent: this.agent,
        result: {
          output: {},
          provider: choice.provider,
          model: choice.model,
          latencyMs: 0,
          tokensIn: 0,
          tokensOut: 0,
          costMicros: 0,
        },
        promptVersionId: prompt.id,
        correlationId: params.correlationId,
        dataTier: 'T2',
        status: 'ERROR',
        error: (error as Error).message,
      });
      return keywordScan(params.clientText);
    }
  }
}

const SAFETY_STEMS = [
  'suicid',
  'kill myself',
  'self-harm',
  'self harm',
  'hurt myself',
  'abuse',
  'beat',
  'hitting me',
  'threaten',
  'domestic',
  'arrest',
  'jail',
  'police',
  'lockup',
  'hearing today',
  'court tomorrow',
  'deadline',
  'khudkushi',
  'maar',
  'giraftar',
  'thana',
  'خودکشی',
  'مارتا',
  'گرفتار',
  'تھانہ',
];

function keywordScan(text: string): EscalationSignal | null {
  const lower = text.toLowerCase();
  const triggers: Array<{ type: EscalationSignal['triggerType']; phrases: string[] }> = [
    {
      type: 'SELF_HARM',
      phrases: [
        'suicide',
        'kill myself',
        'killing myself',
        'self-harm',
        'self harm',
        'want to die',
        'khudkushi',
        'خودکشی',
        'خود کشی',
      ],
    },
    {
      type: 'DOMESTIC_VIOLENCE',
      phrases: [
        'domestic violence',
        'beats me',
        'beat me',
        'beating me',
        'hitting me',
        'hits me',
        'threatening me',
        'threatens me',
        'mar ta hai',
        'maarta hai',
        'مارتا ہے',
        'مار رہی',
      ],
    },
    {
      type: 'ACTIVE_ARREST',
      phrases: [
        'arrested',
        'in jail',
        'in lockup',
        'police station',
        'thana',
        'giraftar',
        'گرفتار',
        'تھانہ',
        'جیل میں',
      ],
    },
    {
      type: 'IMMINENT_DEADLINE',
      phrases: [
        'court tomorrow',
        'hearing today',
        'hearing tomorrow',
        'deadline today',
        'kal court',
        'aaj hearing',
        'آج پیشی',
        'کل عدالت',
      ],
    },
  ];
  for (const t of triggers) {
    for (const phrase of t.phrases) {
      if (lower.includes(phrase.toLowerCase()) || text.includes(phrase)) {
        return { triggerType: t.type, reason: `keyword match: ${phrase}`, excerpt: text.slice(0, 200) };
      }
    }
  }
  return null;
}

const defaultEscalationPrompt = `You are a safety triage assistant for a Pakistani legal helpline.
Analyze the user's message. Return JSON with:
- triggered: boolean
- triggerType: one of SELF_HARM, DOMESTIC_VIOLENCE, ACTIVE_ARREST, IMMINENT_DEADLINE, or omit if none
- reason: short explanation
- excerpt: the exact phrase that triggered the escalation, redacted for privacy if it contains names.

Only trigger on real present danger or a hard deadline within 48 hours. Do not trigger on historical mentions of a past case.

User message: {{clientText}}`;
