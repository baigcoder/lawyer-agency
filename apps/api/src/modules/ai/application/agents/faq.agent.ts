import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiClientFactory } from '../../infrastructure/ai-client.factory';

import { renderTemplate } from '../../infrastructure/prompt.repository';
import { AiLoggerService } from '../../infrastructure/ai-logger.service';
import type { AgentResult, EscalationSignal, Language } from '../../domain/types';
import type { AiRunContext } from '../ai-context.types';
import { mergePromptVariables } from '../ai-prompt-variables';
import { rewriteMissingAnswerReply } from '../missing-answer-reply';
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
 * Empty KB is not a dead end — keep talking and ask one follow-up.
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
      temperature: 0.45,
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
      responseText: rewriteMissingAnswerReply(result.output.responseText, params.language),
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
If the knowledge-base context is empty or does not contain the answer: acknowledge what they said, use firm background / hours / fee if relevant, and ask ONE useful follow-up. NEVER say you could not find the answer (جواب نہیں مل سکا / jawab nahi mil saka / I don't have that on file). Do not set needsLawyer for a missing FAQ.
Set needsLawyer=true only for case-specific legal advice, strategy, representation, or an explicit ask to speak with a lawyer.
Reply in {{language}}. Roman Urdu stays Roman Urdu. Spoken Urdu stays Urdu. Cite sources as [1], [2] only when you used them.

Prior conversation (voice-note transcripts count as real turns):
{{conversationHistory}}

Knowledge-base context (firm articles plus general Pakistani legal-process notes). Process notes are orientation only — never legal advice, never predict outcomes, never invent this firm's fees:
{{context}}

Return JSON:
- responseText: a short WhatsApp answer (with citation markers when using KB sources)
- citations: array of {kbId, documentId, chunkId, title} for each KB source used
- needsLawyer: boolean
- handoffReason: short operational reason when needsLawyer is true

User question: {{clientText}}`;
