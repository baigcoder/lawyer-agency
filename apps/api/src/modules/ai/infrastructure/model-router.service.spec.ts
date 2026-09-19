import { describe, expect, it } from 'vitest';
import { ModelRouterService } from './model-router.service';

function mockConfig(model = 'openai/gpt-oss-20b') {
  return { get: () => model } as never;
}

describe('ModelRouterService.choose', () => {
  const router = new ModelRouterService(mockConfig(), {} as never);

  it('selects gpt-oss-120b for intake', () => {
    expect(router.choose('intake', 't1', [])).toMatchObject({
      provider: 'openai',
      model: 'openai/gpt-oss-120b',
    });
  });

  it('keeps the fast 20b model for the router', () => {
    expect(router.choose('router', 't1', []).model).toBe('openai/gpt-oss-20b');
  });
});

describe('ModelRouterService rate-limit fallback', () => {
  const router = new ModelRouterService(mockConfig(), {} as never);

  it('pairs each gpt-oss model with the other, which has its own Groq quota', () => {
    expect(router.choose('intake', 't1', []).fallbackModel).toBe('openai/gpt-oss-20b');
    expect(router.choose('router', 't1', []).fallbackModel).toBe('openai/gpt-oss-120b');
  });

  it('leaves the fallback out when the tenant has not allowed that model', () => {
    const choice = router.choose('intake', 't1', ['groq/openai/gpt-oss-120b']);
    expect(choice.model).toBe('openai/gpt-oss-120b');
    expect(choice.fallbackModel).toBeUndefined();
  });

  it('keeps the fallback when the tenant allows both', () => {
    const choice = router.choose('intake', 't1', ['groq/openai/gpt-oss-120b', 'groq/openai/gpt-oss-20b']);
    expect(choice.fallbackModel).toBe('openai/gpt-oss-20b');
  });
});
