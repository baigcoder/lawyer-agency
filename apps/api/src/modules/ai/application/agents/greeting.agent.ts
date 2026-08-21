import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiClientFactory } from '../../infrastructure/ai-client.factory';
import { renderTemplate } from '../../infrastructure/prompt.repository';
import { AiLoggerService } from '../../infrastructure/ai-logger.service';
import type { AgentResult, Language } from '../../domain/types';
import type { AiRunContext } from '../ai-context.types';
import { mergePromptVariables, renderGreetingMessage } from '../ai-prompt-variables';
import { isUnusableVoiceTranscript } from '../fast-route';
import { MODEL_ROUTER, PROMPT_REPOSITORY, type ModelRouter, type PromptRepository } from '../ports';

const greetingSchema = z.looseObject({
  responseText: z.string(),
});

@Injectable()
export class GreetingAgent {
  private readonly agent = 'greeting';

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
  }): Promise<AgentResult> {
    const fallbackText = renderGreetingMessage(params.context, params.language);
    if (isUnusableVoiceTranscript(params.clientText)) {
      return {
        responseText: unheardVoiceNoteMessage(params.language),
        languageDetected: params.language,
        citations: [],
      };
    }

    try {
      const budgetOk = await this.modelRouter.checkBudget(params.tenantId, 5_000);
      if (!budgetOk) {
        return { responseText: fallbackText, languageDetected: params.language, citations: [] };
      }

      const prompt = (await this.prompts.findActive(params.tenantId, this.agent)) ?? {
        id: null,
        agent: this.agent,
        version: 1,
        template: defaultGreetingPrompt,
      };

      const choice = this.modelRouter.choose(this.agent, params.tenantId, params.tenantAllowlist);
      const client = this.clientFactory.get(choice.provider);

      const rendered = renderTemplate(
        prompt.template,
        mergePromptVariables(params.context, {
          clientText: params.clientText,
          language: params.language,
        }),
      );

      const result = await client.call<z.infer<typeof greetingSchema>>({
        tenantId: params.tenantId,
        agent: this.agent,
        messages: [
          { role: 'system', content: rendered },
          { role: 'user', content: params.clientText },
        ],
        outputSchema: greetingSchema,
        model: choice.model,
        promptVersionId: prompt.id,
        correlationId: params.correlationId,
        temperature: 0.55,
        maxTokens: 220,
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

      const text = result.output.responseText.trim();
      return {
        responseText: text || fallbackText,
        languageDetected: params.language,
        citations: [],
      };
    } catch {
      return { responseText: fallbackText, languageDetected: params.language, citations: [] };
    }
  }
}

const defaultGreetingPrompt = `You reply on WhatsApp for {{displayName}} in {{city}}.
Talk like a normal person texting — warm, short, everyday words. Tone: {{aiTone}}.

{{dynamicReplyRules}}

Real-case rules:
{{aiAssumptions}}

Owner instructions: {{aiCustomInstructions}}

Prior conversation (include spoken/voice-note turns):
{{conversationHistory}}

The client sent a greeting or very short opener. Write ONE natural WhatsApp reply (1–2 sentences) that:
- Matches their language/script ({{language}}). Roman Urdu stays Roman Urdu.
- Reacts to the exact words they just said (including a voice-note transcript)
- Sounds like a receptionist, not a website
- Does NOT say you are an AI/assistant (that line is added separately)
- Does NOT list practice areas or give a firm brochure
- Invites them to say what they need in one short question

Return JSON: { "responseText": string }

Client message: {{clientText}}`;

function unheardVoiceNoteMessage(language: Language): string {
  if (language === 'EN') {
    return "Sorry, I couldn't catch that voice note. Can you say it again or type it?";
  }
  return 'معاف کیجیے، وائس نوٹ سمجھ نہیں آیا۔ دوبارہ بولیں یا لکھ دیں۔';
}
