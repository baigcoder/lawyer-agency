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
