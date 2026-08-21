import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { ModelChoice, ModelRouter } from '../application/ports';

interface Pricing {
  input: number;
  output: number;
}

const CATALOG: Record<string, ModelChoice & Pricing> = {
  'openai/gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    inputCostPer1kTokens: 0.00015,
    outputCostPer1kTokens: 0.0006,
    input: 0.00015,
    output: 0.0006,
  },
  'openai/gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    inputCostPer1kTokens: 0.0025,
    outputCostPer1kTokens: 0.01,
    input: 0.0025,
    output: 0.01,
  },
  'anthropic/claude-3-5-sonnet': {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    inputCostPer1kTokens: 0.003,
    outputCostPer1kTokens: 0.015,
    input: 0.003,
    output: 0.015,
  },
  // OpenRouter free-tier model (used for local/dev testing to avoid direct
  // OpenAI rate limits). Cost is logged as zero; actual billing is per-token
  // on OpenRouter's paid tiers, but :free models have a daily cap.
  // Groq free-tier model (fast inference, high rate limits). Cost is logged
  // as zero; free models have a generous daily cap via groq.com.
  // openai/gpt-oss-20b replaces the retired llama-3.3-70b-versatile (deprecated 2026-08-16).
  'groq/openai/gpt-oss-20b': {
    provider: 'openai',
    model: 'openai/gpt-oss-20b',
    inputCostPer1kTokens: 0,
    outputCostPer1kTokens: 0,
    input: 0,
    output: 0,
  },
  // Alias matching env defaults (AI_DEFAULT_PROVIDER/AI_DEFAULT_MODEL).
  'openai/gpt-oss-20b': {
    provider: 'openai',
    model: 'openai/gpt-oss-20b',
    inputCostPer1kTokens: 0,
    outputCostPer1kTokens: 0,
    input: 0,
    output: 0,
  },
  'groq/openai/gpt-oss-120b': {
    provider: 'openai',
    model: 'openai/gpt-oss-120b',
    inputCostPer1kTokens: 0,
    outputCostPer1kTokens: 0,
    input: 0.000001,
    output: 0.000001,
  },
  'openai/gpt-oss-120b': {
    provider: 'openai',
    model: 'openai/gpt-oss-120b',
    inputCostPer1kTokens: 0,
    outputCostPer1kTokens: 0,
    input: 0.000001,
    output: 0.000001,
  },
};

const AGENT_DEFAULTS: Record<string, string> = {
  router: 'groq/openai/gpt-oss-20b',
  intake: 'groq/openai/gpt-oss-120b',
  faq: 'groq/openai/gpt-oss-120b',
  'case-update': 'groq/openai/gpt-oss-120b',
  escalation: 'groq/openai/gpt-oss-20b',
  greeting: 'groq/openai/gpt-oss-120b',
  'greeting-intro': 'groq/openai/gpt-oss-120b',
  'handoff-brief': 'groq/openai/gpt-oss-120b',
};

/**
 * Model router (D-006): picks a provider/model per agent, respects tenant
 * allow-list, and enforces monthly budget cap. Budget check is a soft gate:
 * exceed → fallback to cheapest model; if even cheapest exceeds, reject.
 */
@Injectable()
export class ModelRouterService implements ModelRouter {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly uow: UnitOfWork,
  ) {}

  choose(agent: string, tenantId: string, tenantAllowlist: string[]): ModelChoice {
    const preferred = AGENT_DEFAULTS[agent] ?? this.defaultKey();
    const allowedKeys = tenantAllowlist.length > 0 ? tenantAllowlist : Object.keys(CATALOG);
    const preferredEntry = CATALOG[preferred];
    if (preferredEntry && allowedKeys.includes(preferred)) {
      return toChoice(preferredEntry);
    }

    const candidates = allowedKeys
      .map((k) => CATALOG[k])
      .filter((c): c is (ModelChoice & Pricing) => c !== undefined)
      .sort((a, b) => a.input + a.output - (b.input + b.output));

    const chosen =
      candidates.find((c) => c.model === preferredEntry?.model) ??
      candidates.find((c) => `${c.provider}/${c.model}` === preferred) ??
      candidates[0];
    if (!chosen) throw new Error(`No allowed AI model for tenant ${tenantId}`);
    return toChoice(chosen);
  }

  async checkBudget(tenantId: string, estimatedCostMicros: number): Promise<boolean> {
    const result = await this.uow.withTenant(tenantId, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { aiMonthlyBudgetMicros: true } });
      if (!tenant || tenant.aiMonthlyBudgetMicros === null) return true;

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const spent = await tx.aiLog.aggregate({
        where: { tenantId, createdAt: { gte: startOfMonth } },
        _sum: { costMicros: true },
      });
      const total = (spent._sum.costMicros ?? 0) + estimatedCostMicros;
      return total <= tenant.aiMonthlyBudgetMicros;
    });
    return result;
  }

  private defaultKey(): string {
    const provider = this.config.get('AI_DEFAULT_PROVIDER', { infer: true });
    const model = this.config.get('AI_DEFAULT_MODEL', { infer: true });
    return `${provider}/${model}`;
  }
}

function toChoice(entry: ModelChoice & Pricing): ModelChoice {
  return {
    provider: entry.provider,
    model: entry.model,
    inputCostPer1kTokens: entry.inputCostPer1kTokens,
    outputCostPer1kTokens: entry.outputCostPer1kTokens,
  };
}
