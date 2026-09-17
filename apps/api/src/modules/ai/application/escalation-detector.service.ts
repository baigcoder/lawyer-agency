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
    if (ambiguousScan(text)) return true;
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
    // A bare "police station" / "murder" / "jail" is the vocabulary of a law
    // firm's inbox, not proof of an emergency. Those go to the model; if the
    // model cannot answer we still escalate, because a missed emergency costs
    // more than an unnecessary handoff.
    const ambiguous = ambiguousScan(params.clientText);
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
      return keywordScan(params.clientText) ?? ambiguous;
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
        pricing: choice,
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

      // A `triggered: false` verdict clears `ambiguous` on purpose: deciding
      // whether "police station" is an emergency is what the model was asked.
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
      // Fail safe: with no verdict available, an ambiguous hit escalates.
      return keywordScan(params.clientText) ?? ambiguous;
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
  'murder',
  'killed',
  'qatl',
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

/**
 * Phrases that mean an emergency on their own, whatever the surrounding text.
 * A match here escalates immediately, with no model call.
 */
const CERTAIN_TRIGGERS: Array<{ type: EscalationSignal['triggerType']; phrases: string[] }> = [
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
      'i was arrested',
      'i am arrested',
      'i have been arrested',
      'they arrested me',
      'arrested me',
      'in jail',
      'in lockup',
      'killed someone',
      'killed him',
      'killed her',
      'brother killed',
      'brother kill',
      'bhai ne mara',
      'bhai ne qatl',
      'گرفتار',
      'جیل میں',
      'مار دیا',
      'maar diya',
      'mar diya',
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

/**
 * Emergencies that need a little grammar to recognise. Someone reporting that
 * their own relative was arrested is an emergency however the sentence is
 * phrased; the same words without a possessive ("procedure after an arrest")
 * are a process question.
 */
const CERTAIN_PATTERNS: Array<{ type: EscalationSignal['triggerType']; pattern: RegExp }> = [
  {
    type: 'ACTIVE_ARREST',
    pattern:
      /\b(my|our|mera|meri|mere|hamara|hamari)\s+(\S+\s+){0,2}(arrested|arrest|giraftar|detained)\b/i,
  },
  {
    type: 'ACTIVE_ARREST',
    pattern: /\b(arrested|detained)\s+(my|our|mera|meri|mere)\b/i,
  },
];

/**
 * Everyday vocabulary of a law firm's inbox. "What is the procedure to get bail
 * for someone in a police station?" is a fee-and-process question, not an
 * emergency — but "my son is at the police station right now" is. These route
 * to the triage model rather than hard-escalating on the word alone.
 */
const AMBIGUOUS_TRIGGERS: Array<{ type: EscalationSignal['triggerType']; phrases: string[] }> = [
  {
    type: 'ACTIVE_ARREST',
    phrases: [
      'arrested',
      'arrest',
      'police station',
      'thana',
      'giraftar',
      'murder',
      'murdered',
      'qatl',
      'bail',
      'fir',
      'تھانہ',
      'قتل',
      'ضمانت',
    ],
  },
];

/** Word-boundary match that also works for Urdu, where \b does not apply. */
export function containsPhrase(text: string, phrase: string): boolean {
  const lower = text.toLowerCase();
  const needle = phrase.toLowerCase();
  const at = lower.indexOf(needle);
  if (at < 0) return false;
  const before = lower[at - 1];
  const after = lower[at + needle.length];
  const isWordChar = (ch: string | undefined) => ch !== undefined && /[a-z0-9_؀-ۿ]/.test(ch);
  // "thana" must not fire inside "Thanawala"; Urdu words are space-delimited too.
  return !isWordChar(before) && !isWordChar(after);
}

function scan(
  text: string,
  table: Array<{ type: EscalationSignal['triggerType']; phrases: string[] }>,
): EscalationSignal | null {
  for (const trigger of table) {
    for (const phrase of trigger.phrases) {
      if (containsPhrase(text, phrase)) {
        return {
          triggerType: trigger.type,
          reason: `keyword match: ${phrase}`,
          excerpt: text.slice(0, 200),
        };
      }
    }
  }
  return null;
}

/** Unambiguous emergency phrases — escalate now, do not ask a model. */
export function keywordScan(text: string): EscalationSignal | null {
  const phraseHit = scan(text, CERTAIN_TRIGGERS);
  if (phraseHit) return phraseHit;
  for (const { type, pattern } of CERTAIN_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      return { triggerType: type, reason: `keyword match: ${match[0]}`, excerpt: text.slice(0, 200) };
    }
  }
  return null;
}

/** Legal vocabulary that only sometimes means an emergency. */
export function ambiguousScan(text: string): EscalationSignal | null {
  if (keywordScan(text)) return null;
  return scan(text, AMBIGUOUS_TRIGGERS);
}

const defaultEscalationPrompt = `You are a safety triage assistant for a Pakistani legal helpline.
Analyze the user's message. Return JSON with:
- triggered: boolean
- triggerType: one of SELF_HARM, DOMESTIC_VIOLENCE, ACTIVE_ARREST, IMMINENT_DEADLINE, or omit if none
- reason: short explanation
- excerpt: the exact phrase that triggered the escalation, redacted for privacy if it contains names.

Only trigger on real present danger or a hard deadline within 48 hours. Do not trigger on historical mentions of a past case.

User message: {{clientText}}`;
