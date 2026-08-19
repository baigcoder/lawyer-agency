import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import {
  clipIntro,
  generateGreetingIntro,
  type GreetingIntroSource,
} from '../../firm-profile/application/ai-settings.dto';
import { AiClientFactory } from '../infrastructure/ai-client.factory';
import { AiLoggerService } from '../infrastructure/ai-logger.service';
import { MODEL_ROUTER, type ModelRouter } from './ports';

const introSchema = z.looseObject({
  intro: z.string().max(500),
});

/**
 * Generates a firm-specific greeting intro via LLM for AI settings.
 * Falls back to the deterministic template when the provider is unavailable.
 */
@Injectable()
export class GreetingIntroGeneratorService {
  private readonly agent = 'greeting-intro';
  private readonly logger = new Logger(GreetingIntroGeneratorService.name);

  constructor(
    private readonly clientFactory: AiClientFactory,
    @Inject(MODEL_ROUTER) private readonly modelRouter: ModelRouter,
    private readonly aiLogger: AiLoggerService,
    private readonly uow: UnitOfWork,
  ) {}

  async generate(
    tenantId: string,
    source: GreetingIntroSource,
    language: 'en' | 'ur',
  ): Promise<{ intro: string; source: 'ai' | 'template' }> {
    const allowlist = await this.loadAllowlist(tenantId);
    const fallback = generateGreetingIntro(source, language);

    try {
      const choice = this.modelRouter.choose(this.agent, tenantId, allowlist);
      const client = this.clientFactory.get(choice.provider);
      const budgetOk = await this.modelRouter.checkBudget(tenantId, 5_000);
      if (!budgetOk) {
        return { intro: fallback, source: 'template' };
      }

      const system = buildIntroPrompt(source, language);
      const result = await client.call<z.infer<typeof introSchema>>({
        tenantId,
        agent: this.agent,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `Write the greeting introduction for ${source.displayName}.`,
          },
        ],
        outputSchema: introSchema,
        model: choice.model,
        temperature: 0.4,
        maxTokens: 300,
      });

      await this.aiLogger.log({
        tenantId,
        agent: this.agent,
        result,
        promptVersionId: null,
        dataTier: 'T2',
        status: 'SUCCESS',
      });

      const intro = normalizeIntro(result.output.intro, source.displayName);
      return { intro, source: 'ai' };
    } catch (error) {
      this.logger.warn(
        { tenantId, reason: error instanceof Error ? error.message.slice(0, 200) : String(error) },
        'AI intro generation failed — using template fallback',
      );
      return { intro: fallback, source: 'template' };
    }
  }

  private async loadAllowlist(tenantId: string): Promise<string[]> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { aiProviderAllowlist: true },
      });
      return tenant?.aiProviderAllowlist ?? [];
    });
  }
}

function buildIntroPrompt(source: GreetingIntroSource, language: 'en' | 'ur'): string {
  const areas = source.practiceAreas.filter(Boolean).slice(0, 4).join(', ') || 'general practice';
  const langLine =
    language === 'ur'
      ? 'Write in Urdu script. Use respectful Pakistani legal-office tone.'
      : 'Write in English with a warm, professional Pakistani law-firm tone.';

  return `You write a short AI identity HINT for a Pakistani law firm's WhatsApp assistant (NOT a script to send to clients).
Return JSON: { "intro": string }

${langLine}

Requirements:
- ONE sentence only, max 200 characters
- MUST include literal placeholder {{displayName}} (firm name from owner settings — never substitute the real name)
- Warm, professional; mention intake help only — no legal advice disclaimer needed here
- Do NOT list practice areas unless one is the firm's sole focus
- This is guidance for the AI — clients never see it verbatim

Owner-configured firm name: ${source.displayName}
City: ${source.city.trim() || 'not specified'}
Practice areas: ${areas}
About: ${source.firmAbout.trim().slice(0, 150) || 'not provided'}`;
}

function normalizeIntro(raw: string, displayName: string): string {
  let intro = raw.replace(/\s+/g, ' ').trim();
  if (!intro.includes('{{displayName}}')) {
    intro = intro.replaceAll(displayName, '{{displayName}}');
  }
  if (!intro.includes('{{displayName}}')) {
    intro = `I'm the AI assistant for {{displayName}}. ${intro}`;
  }
  return clipIntro(intro);
}
