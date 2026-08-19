import { describe, expect, it, vi } from 'vitest';
import { EscalationDetectorService } from './escalation-detector.service';
import { AiClientFactory } from '../infrastructure/ai-client.factory';
import { AiLoggerService } from '../infrastructure/ai-logger.service';
import type { AiClient, ModelRouter, PromptRepository } from './ports';

function makeService(overrides: { output?: unknown; budgetOk?: boolean } = {}) {
  const factory = {
    get: vi.fn(
      () =>
        ({
          provider: 'openai',
          call: vi.fn(async () => ({
            output: overrides.output ?? { triggered: false },
            provider: 'openai',
            model: 'gpt-4o',
            latencyMs: 80,
            tokensIn: 60,
            tokensOut: 15,
            costMicros: 100,
          })),
        }) as AiClient,
    ),
  } as unknown as AiClientFactory;
  const modelRouter: ModelRouter = {
    choose: vi.fn(() => ({ provider: 'openai', model: 'gpt-4o', inputCostPer1kTokens: 0.0025, outputCostPer1kTokens: 0.01 })),
    checkBudget: vi.fn(async () => overrides.budgetOk ?? true),
  };
  const prompts: PromptRepository = { findActive: vi.fn(async () => null) };
  const logger = { log: vi.fn() } as unknown as AiLoggerService;
  return { service: new EscalationDetectorService(factory, modelRouter, prompts, logger) };
}

describe('EscalationDetectorService', () => {
  it('returns null when the LLM reports no escalation', async () => {
    const { service } = makeService({ output: { triggered: false } });
    const result = await service.detect({
      tenantId: 't1',
      tenantAllowlist: [],
      clientText: 'Thank you for your help yesterday.',
    });
    expect(result).toBeNull();
  });

  it('returns escalation when LLM flags domestic violence', async () => {
    const { service } = makeService({
      output: { triggered: true, triggerType: 'DOMESTIC_VIOLENCE', reason: 'mentions abuse', excerpt: 'my husband beats me' },
    });
    const result = await service.detect({
      tenantId: 't1',
      tenantAllowlist: [],
      clientText: 'there is ongoing abuse at home and I do not feel safe',
    });
    expect(result).toMatchObject({ triggerType: 'DOMESTIC_VIOLENCE', reason: 'mentions abuse' });
  });

  it('returns immediately on a hard keyword match without calling the LLM', async () => {
    const { service } = makeService({
      output: { triggered: false },
    });
    const result = await service.detect({
      tenantId: 't1',
      tenantAllowlist: [],
      clientText: 'my husband beats me',
    });
    expect(result).toMatchObject({ triggerType: 'DOMESTIC_VIOLENCE' });
  });

  it('skips the LLM for greetings with no safety signal', async () => {
    const factory = {
      get: vi.fn(),
    };
    const modelRouter = {
      choose: vi.fn(),
      checkBudget: vi.fn(),
    };
    const prompts = { findActive: vi.fn() };
    const logger = { log: vi.fn() };
    const service = new EscalationDetectorService(
      factory as never,
      modelRouter as never,
      prompts as never,
      logger as never,
    );
    const result = await service.detect({
      tenantId: 't1',
      tenantAllowlist: [],
      clientText: 'Salam',
    });
    expect(result).toBeNull();
    expect(factory.get).not.toHaveBeenCalled();
  });

  it('falls back to keyword scan when budget exhausted', async () => {
    const { service } = makeService({ budgetOk: false });
    const result = await service.detect({
      tenantId: 't1',
      tenantAllowlist: [],
      clientText: 'I am at the police station and was arrested.',
    });
    expect(result).toMatchObject({ triggerType: 'ACTIVE_ARREST' });
  });
});
