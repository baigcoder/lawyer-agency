import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiClientFactory } from '../../infrastructure/ai-client.factory';

import { renderTemplate } from '../../infrastructure/prompt.repository';
import { AiLoggerService } from '../../infrastructure/ai-logger.service';
import type { AgentResult, EscalationSignal, Language } from '../../domain/types';
import type { AiRunContext } from '../ai-context.types';
import { mergePromptVariables } from '../ai-prompt-variables';
import { MODEL_ROUTER, PROMPT_REPOSITORY, type ModelRouter, type PromptRepository } from '../../application/ports';

const faqSchema = z.looseObject({
  responseText: z.string(),
  needsLawyer: z.boolean().default(false),
  handoffReason: z.string().optional(),
  citations: z.array(
    z.looseObject({
      kbId: z.string().optional(),
      documentId: z.string().optional(),
      chunkId: z.string(),
      title: z.string(),
    }),
  ).default([]),
});

/**
 * FAQ agent: answers general process questions using retrieved context.
 * If no relevant material is found, it declines rather than hallucinate.
 */
@Injectable()
export class FaqAgent {
  private readonly agent = 'faq';

  constructor(
    private readonly clientFactory: AiClientFactory,
    @Inject(MODEL_ROUTER) private readonly modelRouter: ModelRouter,
    @Inject(PROMPT_REPOSITORY) private readonly prompts: PromptRepository,
    private readonly logger: AiLoggerService,
  ) {}

  async run(params: {
    tenantId: string;
    tenantAllowlist: string[];
    clientText: string;
    language: Language;
    context: AiRunContext;
    correlationId?: string | null | undefined;
    escalation?: EscalationSignal | null | undefined;
  }): Promise<AgentResult> {
    if (params.context.retrievedChunks.length === 0 && !hasOwnerCredentialsContext(params.context)) {
      return {
        responseText:
          params.language === 'UR'
            ? `معذرت، مجھے اس سوال کا جواب نہیں مل سکا۔ ${params.context.firm.displayName} کا وکیل جلد مدد کرے گا۔`
            : `I'm sorry, I don't have information on that. A lawyer at ${params.context.firm.displayName} will assist you shortly.`,
        languageDetected: params.language,
        citations: [],
        needsLawyer: true,
        handoffReason: 'No approved knowledge-base information matched the client question',
        escalation: params.escalation ?? undefined,
      };
    }

    const prompt = (await this.prompts.findActive(params.tenantId, this.agent)) ?? {
      id: null,
      agent: this.agent,
      version: 1,
      template: defaultFaqPrompt,
    };

    const choice = this.modelRouter.choose(this.agent, params.tenantId, params.tenantAllowlist);
    const client = this.clientFactory.get(choice.provider);

    const rendered = renderTemplate(
      prompt.template,
      mergePromptVariables(params.context, {
        context: params.context.retrievedContext,
        clientText: params.clientText,
        language: params.language,
      }),
    );

    const result = await client.call<z.infer<typeof faqSchema>>({
      tenantId: params.tenantId,
      agent: this.agent,
      messages: [
        { role: 'system', content: rendered },
        { role: 'user', content: params.clientText },
      ],
      outputSchema: faqSchema,
      model: choice.model,
      promptVersionId: prompt.id,
      correlationId: params.correlationId,
      temperature: 0.2,
      maxTokens: 700,
      timeoutMs: 20_000,
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
      responseText: result.output.responseText,
      languageDetected: params.language,
      needsLawyer: result.output.needsLawyer,
      handoffReason: result.output.handoffReason,
      citations: result.output.citations.map((c) => ({
        kbId: c.kbId,
        documentId: c.documentId,
        chunkId: c.chunkId,
        title: c.title,
      })),
      escalation: params.escalation ?? undefined,
    };
  }
}

const defaultFaqPrompt = `You answer questions about {{displayName}} ({{city}}) using ONLY the provided context.
Tone: {{aiTone}}. Owner instructions: {{aiCustomInstructions}}

{{dynamicReplyRules}}

Real-case rules:
{{aiAssumptions}}

Firm background (use only if the question is about the firm):
{{firmEnrichment}}

Lead lawyer / owner credentials (T1-safe, anonymized — never invent details):
{{ownerProfileBlock}}

Do NOT give specific legal advice, predict outcomes, or cite laws beyond the context.
Answer useful general process and document-checklist questions directly when the context supports them.
If the context does not contain the answer, say you will have a lawyer confirm — set needsLawyer=true. Never invent fees, timelines, or document lists.
Set needsLawyer=true for case-specific interpretation, strategy, or representation.
Reply in {{language}}. Roman Urdu stays Roman Urdu. Cite sources as [1], [2] only when you used them.

Prior conversation:
{{conversationHistory}}

Knowledge-base context:
{{context}}

Return JSON:
- responseText: a short WhatsApp answer (with citation markers when using KB sources)
- citations: array of {kbId, documentId, chunkId, title} for each KB source used
- needsLawyer: boolean
- handoffReason: short operational reason when needsLawyer is true

User question: {{clientText}}`;

function hasOwnerCredentialsContext(ctx: AiRunContext): boolean {
  const o = ctx.ownerProfile;
  if (!o) return false;
  return Boolean(
    o.bio?.trim() ||
      o.bioUr?.trim() ||
      o.yearsExperience != null ||
      o.barCouncil?.trim() ||
      o.achievements.length ||
      o.featuredCases.length,
  );
}
