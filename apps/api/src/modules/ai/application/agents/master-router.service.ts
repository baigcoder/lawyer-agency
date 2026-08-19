import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiClientFactory } from '../../infrastructure/ai-client.factory';

import { renderTemplate } from '../../infrastructure/prompt.repository';
import { AiLoggerService } from '../../infrastructure/ai-logger.service';
import type { Language, RouterDecision } from '../../domain/types';
import { MODEL_ROUTER, PROMPT_REPOSITORY, type ModelRouter, type PromptRepository } from '../ports';

const routerSchema = z.looseObject({
  intent: z.enum([
    'INTAKE',
    'FAQ',
    'CASE_UPDATE',
    'APPOINTMENT',
    'DOCUMENT_REQUEST',
    'HUMAN_HANDOFF',
    'GREETING',
    'OFF_TOPIC',
  ]),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
});

/**
 * Master router (D-054): reads the inbound message and conversation context,
 * decides which agent should handle it, and detects language.
 */
@Injectable()
export class MasterRouterService {
  private readonly agent = 'router';

  constructor(
    private readonly clientFactory: AiClientFactory,
    @Inject(MODEL_ROUTER) private readonly modelRouter: ModelRouter,
    @Inject(PROMPT_REPOSITORY) private readonly prompts: PromptRepository,
    private readonly logger: AiLoggerService,
  ) {}

  async route(params: {
    tenantId: string;
    tenantAllowlist: string[];
    clientText: string;
    conversationState: string;
    hasOpenCase: boolean;
    clientLanguages?: string[] | undefined;
    conversationHistory?: string | undefined;
    correlationId?: string | null | undefined;
  }): Promise<RouterDecision & { language: Language }> {
    const prompt = (await this.prompts.findActive(params.tenantId, this.agent)) ?? {
      id: null,
      agent: this.agent,
      version: 1,
      template: defaultRouterPrompt,
    };

    const choice = this.modelRouter.choose(this.agent, params.tenantId, params.tenantAllowlist);
    const client = this.clientFactory.get(choice.provider);
    const budgetOk = await this.modelRouter.checkBudget(params.tenantId, 10_000);
    if (!budgetOk) {
      return { intent: 'HUMAN_HANDOFF', reasoning: 'AI budget exhausted', confidence: 1, language: 'UNKNOWN' };
    }

    const rendered = renderTemplate(prompt.template, {
      clientText: params.clientText,
      conversationState: params.conversationState,
      hasOpenCase: params.hasOpenCase ? 'yes' : 'no',
      conversationHistory: params.conversationHistory?.trim() || 'No prior messages.',
    });

    const result = await client.call<z.infer<typeof routerSchema>>({
      tenantId: params.tenantId,
      agent: this.agent,
      messages: [
        { role: 'system', content: rendered },
        { role: 'user', content: params.clientText },
      ],
      outputSchema: routerSchema,
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

    return {
      intent: result.output.intent,
      reasoning: result.output.reasoning,
      confidence: result.output.confidence,
      language: detectLanguage(params.clientText, params.clientLanguages ?? ['EN', 'UR', 'ROMAN_URDU']),
    };
  }
}

export function detectLanguage(text: string, clientLanguages: string[]): Language {
  const urduRange = /[\u0600-\u06FF]/;
  if (urduRange.test(text)) return 'UR';
  const lower = text.toLowerCase();
  const romanUrduHints = [
    'kya',
    'kia',
    'aap',
    'apko',
    'mujhe',
    'mujh',
    'mera',
    'meri',
    'hamara',
    'madad',
    'chahiye',
    'chahye',
    'salam',
    'shukriya',
    'masla',
    'maslay',
    'vakil',
    'wakeel',
    'batao',
    'theek',
    'haan',
    'nahi',
    'nahin',
    'kitni',
    'kab',
    'kahan',
  ];
  const allowRoman = clientLanguages.includes('ROMAN_URDU') || clientLanguages.includes('UR');
  if (allowRoman && romanUrduHints.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(lower))) {
    return 'UR';
  }
  return 'EN';
}

const defaultRouterPrompt = `You are the intake router for a Pakistani legal-assistant WhatsApp service.
Decide the user's intent from the message. Return JSON:
- intent: one of INTAKE, FAQ, CASE_UPDATE, APPOINTMENT, DOCUMENT_REQUEST, HUMAN_HANDOFF, GREETING, OFF_TOPIC
- reasoning: one sentence
- confidence: 0.0 to 1.0

Rules:
- GREETING: hi, hy, hello, salam, assalamu alaikum, thanks — with NO legal question or case detail yet.
- OFF_TOPIC: flirting, jokes, small talk, or anything not about this law firm, legal intake, appointments, documents, or a case (example: "hi love", "what's up baby").
- If the message mixes a greeting with a legal question (e.g. "Salam, I need help with divorce"), choose INTAKE or FAQ — not GREETING.
- INTAKE: client describes a legal need, asks for help, appointment, or shares case facts — NOT a bare greeting.
- FAQ: client asks a general legal-process, eligibility, fee, timeline, or required-document question (for example, "what documents are needed to become an income-tax filer?").
- HUMAN_HANDOFF: client explicitly asks for a lawyer or the request inherently requires case-specific legal judgment or representation. General process questions are FAQ, not automatic handoff.

Prefer INTAKE when the client is answering a previous intake question (city, name, what happened, documents they have).
Prefer CASE_UPDATE when has open case is yes and they are adding facts, not asking a general FAQ.
Do not classify a legal problem as GREETING even if it starts with salam/hi.

Context:
- conversation state: {{conversationState}}
- has open case: {{hasOpenCase}}
- recent thread:
{{conversationHistory}}

User message: {{clientText}}`;
