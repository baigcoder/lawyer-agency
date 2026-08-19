import { describe, expect, it, vi } from 'vitest';
import { GreetingIntroGeneratorService } from './greeting-intro-generator.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { AiClientFactory } from '../infrastructure/ai-client.factory';
import type { AiLoggerService } from '../infrastructure/ai-logger.service';
import type { ModelRouter } from './ports';

describe('GreetingIntroGeneratorService', () => {
  const source = {
    displayName: 'Ali & Co Advocates',
    city: 'Lahore',
    practiceAreas: ['Family law', 'Property'],
    firmAbout: 'Boutique firm since 2010.',
  };

  it('returns AI intro when the provider succeeds', async () => {
    const client = {
      call: vi.fn(async () => ({
        output: {
          intro:
            "I'm the AI assistant for {{displayName}} in Lahore. We handle family and property matters — intake only, not legal advice.",
        },
        provider: 'openai',
        model: 'gpt-4o-mini',
        latencyMs: 10,
        tokensIn: 1,
        tokensOut: 1,
        costMicros: 0,
      })),
    };
    const clientFactory = { get: vi.fn(() => client) } as unknown as AiClientFactory;
    const modelRouter = {
      choose: vi.fn(() => ({ provider: 'openai', model: 'gpt-4o-mini', inputCostPer1kTokens: 0, outputCostPer1kTokens: 0 })),
      checkBudget: vi.fn(async () => true),
    } as unknown as ModelRouter;
    const aiLogger = { log: vi.fn(async () => {}) } as unknown as AiLoggerService;
    const uow = {
      withTenant: vi.fn(async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) =>
        fn({ tenant: { findUnique: vi.fn(async () => ({ aiProviderAllowlist: [] })) } }),
      ),
    } as unknown as UnitOfWork;

    const service = new GreetingIntroGeneratorService(clientFactory, modelRouter, aiLogger, uow);
    const result = await service.generate('tenant-1', source, 'en');
    expect(result.source).toBe('ai');
    expect(result.intro).toContain('{{displayName}}');
  });

  it('falls back to template when the provider fails', async () => {
    const client = { call: vi.fn(async () => { throw new Error('rate limit'); }) };
    const clientFactory = { get: vi.fn(() => client) } as unknown as AiClientFactory;
    const modelRouter = {
      choose: vi.fn(() => ({ provider: 'openai', model: 'gpt-4o-mini', inputCostPer1kTokens: 0, outputCostPer1kTokens: 0 })),
      checkBudget: vi.fn(async () => true),
    } as unknown as ModelRouter;
    const aiLogger = { log: vi.fn(async () => {}) } as unknown as AiLoggerService;
    const uow = {
      withTenant: vi.fn(async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) =>
        fn({ tenant: { findUnique: vi.fn(async () => ({ aiProviderAllowlist: [] })) } }),
      ),
    } as unknown as UnitOfWork;

    const service = new GreetingIntroGeneratorService(clientFactory, modelRouter, aiLogger, uow);
    const result = await service.generate('tenant-1', source, 'en');
    expect(result.source).toBe('template');
    expect(result.intro).toContain('{{displayName}}');
  });
});
