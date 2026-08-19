import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiClientFactory } from '../../infrastructure/ai-client.factory';

import { renderTemplate } from '../../infrastructure/prompt.repository';
import { AiLoggerService } from '../../infrastructure/ai-logger.service';
import type { AgentResult, EscalationSignal, Language } from '../../domain/types';
import type { AiRunContext } from '../ai-context.types';
import { mergePromptVariables } from '../ai-prompt-variables';
import { MODEL_ROUTER, PROMPT_REPOSITORY, type ModelRouter, type PromptRepository } from '../../application/ports';

const intakeSchema = z.looseObject({
  responseText: z.string(),
  extractedFields: z.record(z.string(), z.unknown()),
  practiceArea: z.string().optional(),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  needsLawyer: z.boolean().default(false),
  handoffReason: z.string().optional(),
});

/**
 * Intake agent: extracts structured legal-intake fields from a new client's
 * messages and drafts a clarifying response. Never gives legal advice.
 */
@Injectable()
export class IntakeAgent {
  private readonly agent = 'intake';

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
    taskFocus?: 'appointment' | 'documents' | undefined;
  }): Promise<AgentResult> {
    const prompt = (await this.prompts.findActive(params.tenantId, this.agent)) ?? {
      id: null,
      agent: this.agent,
      version: 1,
      template: defaultIntakePrompt,
    };

    const choice = this.modelRouter.choose(this.agent, params.tenantId, params.tenantAllowlist);
    const client = this.clientFactory.get(choice.provider);

    const rendered = renderTemplate(
      prompt.template,
      mergePromptVariables(params.context, {
        clientText: params.clientText,
        language: params.language,
        lastAiReply: params.context.lastAiReply.trim() || 'None yet.',
        taskFocus: params.taskFocus === 'appointment'
          ? 'The client wants an appointment. Collect preferred day/time and city only. Do not invent available slots.'
          : params.taskFocus === 'documents'
            ? 'The client is asking about documents. List only items present in Reference material; otherwise ask what they already have.'
            : 'Standard legal intake.',
        escalation: params.escalation
          ? `ESCALATION: ${params.escalation.triggerType} - ${params.escalation.reason}`
          : 'none',
      }),
    );

    const result = await client.call<z.infer<typeof intakeSchema>>({
      tenantId: params.tenantId,
      agent: this.agent,
      messages: [
        { role: 'system', content: rendered },
        { role: 'user', content: params.clientText },
      ],
      outputSchema: intakeSchema,
      model: choice.model,
      promptVersionId: prompt.id,
      correlationId: params.correlationId,
      temperature: 0.3,
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
      citations: [],
      needsLawyer: result.output.needsLawyer,
      handoffReason: result.output.handoffReason,
      intakeFields: result.output.extractedFields,
      escalation: params.escalation ?? undefined,
    };
  }
}

const defaultIntakePrompt = `You are a WhatsApp intake assistant for {{displayName}} ({{city}}). You chat like a careful paralegal — fast, specific, never legal advice.

Firm profile (use only when the client asks): {{firmEnrichment}}
Practice areas (mention only if their matter matches or they ask): {{practiceAreas}}
Office hours: {{officeHours}}. Consultation fee: {{consultationFee}}.

{{dynamicReplyRules}}

Lead lawyer (only when client asks about credentials):
{{ownerProfileBlock}}

Tone: {{aiTone}}. Owner instructions: {{aiCustomInstructions}}

Real-case rules:
{{aiAssumptions}}

Task focus: {{taskFocus}}

Prior conversation:
{{conversationHistory}}

Your last message was:
{{lastAiReply}}

Known intake fields (do not re-ask these):
{{intakeFields}}

Reference material (general process only — cite as general info, not advice):
{{retrievedContext}}

Escalation: {{escalation}}

Reply in {{language}}. If the client used Roman Urdu, reply in Roman Urdu.
Return JSON:
- responseText: 1–4 short WhatsApp sentences. First sentence acknowledges their latest message. Then at most ONE missing intake question. Do not repeat {{lastAiReply}}.
- extractedFields: merge new facts only (name, phone, city, practiceArea, facts, urgency). Keep prior fields; never invent.
- practiceArea: only if clearly stated
- urgency: LOW, MEDIUM, or HIGH
- needsLawyer: true only for case-specific legal advice, strategy, representation, or an explicit ask to speak with a lawyer
- handoffReason: short operational reason when needsLawyer is true

Give useful general process information when it is present in Reference material. If professional judgment is required, set needsLawyer=true; do not promise a response time.

Client message: {{clientText}}`;
