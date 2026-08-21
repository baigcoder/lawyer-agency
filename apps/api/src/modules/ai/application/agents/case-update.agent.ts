import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiClientFactory } from '../../infrastructure/ai-client.factory';

import { renderTemplate } from '../../infrastructure/prompt.repository';
import { AiLoggerService } from '../../infrastructure/ai-logger.service';
import type { AgentResult, EscalationSignal, Language } from '../../domain/types';
import type { AiRunContext } from '../ai-context.types';
import { mergePromptVariables } from '../ai-prompt-variables';
import { MODEL_ROUTER, PROMPT_REPOSITORY, type ModelRouter, type PromptRepository } from '../../application/ports';

const caseUpdateSchema = z.looseObject({
  responseText: z.string(),
  summary: z.string(),
});

/**
 * Case-update agent: summarizes new client information against an existing
 * case and drafts a brief acknowledgment.
 */
@Injectable()
export class CaseUpdateAgent {
  private readonly agent = 'case-update';

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
    caseReference: string;
    caseMatterType: string;
    correlationId?: string | null | undefined;
    escalation?: EscalationSignal | null | undefined;
  }): Promise<AgentResult> {
    const prompt = (await this.prompts.findActive(params.tenantId, this.agent)) ?? {
      id: null,
      agent: this.agent,
      version: 1,
      template: defaultCaseUpdatePrompt,
    };

    const choice = this.modelRouter.choose(this.agent, params.tenantId, params.tenantAllowlist);
    const client = this.clientFactory.get(choice.provider);

    const rendered = renderTemplate(
      prompt.template,
      mergePromptVariables(params.context, {
        clientText: params.clientText,
        language: params.language,
        caseReference: params.caseReference,
        caseMatterType: params.caseMatterType,
      }),
    );

    const result = await client.call<z.infer<typeof caseUpdateSchema>>({
      tenantId: params.tenantId,
      agent: this.agent,
      messages: [
        { role: 'system', content: rendered },
        { role: 'user', content: params.clientText },
      ],
      outputSchema: caseUpdateSchema,
      model: choice.model,
      promptVersionId: prompt.id,
      correlationId: params.correlationId,
      temperature: 0.45,
      maxTokens: 500,
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
      citations: [],
      caseSummary: result.output.summary,
      escalation: params.escalation ?? undefined,
    };
  }
}

const defaultCaseUpdatePrompt = `You are updating an existing case for {{displayName}} ({{city}}).
Acknowledge the new information in {{language}} like a WhatsApp message (2–4 short sentences). Do not re-introduce the firm.
Tone: {{aiTone}}. Owner instructions: {{aiCustomInstructions}}
Real-case rules:
{{aiAssumptions}}
{{dynamicReplyRules}}
Do NOT give legal advice or predict outcomes. If they need a legal conclusion, say a lawyer will review.

Case: {{caseReference}} ({{caseMatterType}})

Prior conversation:
{{conversationHistory}}

Reference material:
{{retrievedContext}}

Return JSON:
- responseText: reply to the client
- summary: one-paragraph summary for the lawyer's notes

User message: {{clientText}}`;
