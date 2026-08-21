import { describe, expect, it, vi } from 'vitest';
import {
  detectLanguage,
  languageForUnusableVoiceNote,
  languageFromTranscript,
  MasterRouterService,
} from './master-router.service';
import { AiClientFactory } from '../../infrastructure/ai-client.factory';
import { AiLoggerService } from '../../infrastructure/ai-logger.service';
import type { AiClient, ModelRouter, PromptRepository } from '../../application/ports';

function fakeClient(output: unknown): AiClient {
  return {
    provider: 'openai',
    call: vi.fn(async () => ({
      output,
      provider: 'openai',
      model: 'gpt-4o-mini',
      latencyMs: 100,
      tokensIn: 50,
      tokensOut: 20,
      costMicros: 20,
    })),
  };
}

function makeService(overrides: { output?: unknown; budgetOk?: boolean } = {}) {
  const factory = {
    get: vi.fn(() => fakeClient(overrides.output ?? { intent: 'INTAKE', reasoning: 'new client', confidence: 0.9 })),
  } as unknown as AiClientFactory;
  const modelRouter: ModelRouter = {
    choose: vi.fn(() => ({ provider: 'openai', model: 'gpt-4o-mini', inputCostPer1kTokens: 0.00015, outputCostPer1kTokens: 0.0006 })),
    checkBudget: vi.fn(async () => overrides.budgetOk ?? true),
  };
  const prompts: PromptRepository = {
    findActive: vi.fn(async () => null),
  };
  const logger = { log: vi.fn() } as unknown as AiLoggerService;
  return { service: new MasterRouterService(factory, modelRouter, prompts, logger), factory, modelRouter };
}

describe('MasterRouterService', () => {
  it('routes INTAKE for a new client message', async () => {
    const { service } = makeService({ output: { intent: 'INTAKE', reasoning: 'new inquiry', confidence: 0.85 } });
    const result = await service.route({
      tenantId: 't1',
      tenantAllowlist: [],
      clientText: 'I need help with a family matter',
      conversationState: 'AI_ACTIVE',
      hasOpenCase: false,
    });
    expect(result.intent).toBe('INTAKE');
    expect(result.language).toBe('EN');
  });

  it('treats STT urd as Urdu even when the transcript is Latin', () => {
    expect(languageFromTranscript('hello', ['EN', 'UR'], 'urd')).toBe('UR');
    expect(languageFromTranscript('مجھے مدد چاہیے', ['EN'], 'eng')).toBe('UR');
    expect(languageForUnusableVoiceNote(['EN', 'UR'])).toBe('UR');
    expect(languageForUnusableVoiceNote(['EN'])).toBe('EN');
  });

  it('detects Urdu language', async () => {
    const { service } = makeService({ output: { intent: 'FAQ', reasoning: 'Urdu question', confidence: 0.8 } });
    const result = await service.route({
      tenantId: 't1',
      tenantAllowlist: [],
      clientText: 'میرے پاس ایک قانونی سوال ہے',
      conversationState: 'AI_ACTIVE',
      hasOpenCase: false,
    });
    expect(result.language).toBe('UR');
  });

  it('detects Roman Urdu even when UR is listed without ROMAN_URDU', async () => {
    const { service } = makeService({ output: { intent: 'INTAKE', reasoning: 'roman', confidence: 0.8 } });
    const result = await service.route({
      tenantId: 't1',
      tenantAllowlist: [],
      clientText: 'mujhe divorce ke masle mein madad chahiye',
      conversationState: 'AI_ACTIVE',
      hasOpenCase: false,
      clientLanguages: ['EN', 'UR'],
    });
    expect(result.language).toBe('UR');
    expect(detectLanguage('Khana kha raha', ['EN', 'UR'])).toBe('UR');
  });

  it('forces human handoff when budget exhausted', async () => {
    const { service } = makeService({ budgetOk: false });
    const result = await service.route({
      tenantId: 't1',
      tenantAllowlist: [],
      clientText: 'hello',
      conversationState: 'AI_ACTIVE',
      hasOpenCase: false,
    });
    expect(result.intent).toBe('HUMAN_HANDOFF');
  });
});
