import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ConfigService } from '@nestjs/config';
import { OpenAiAdapter } from './openai.adapter';

function makeAdapter(): OpenAiAdapter {
  const values: Record<string, string> = {
    GROQ_API_KEY: 'gsk_test',
    GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
    AI_DEFAULT_MODEL: 'openai/gpt-oss-20b',
  };
  const config = { get: (key: string) => values[key] } as unknown as ConfigService<never, true>;
  return new OpenAiAdapter(config);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** First request is rate-limited after `throttleMs`; the retry succeeds quickly. */
function stubThrottleThenSuccess(throttleMs: number) {
  const original = globalThis.fetch;
  let call = 0;
  globalThis.fetch = (async () => {
    call += 1;
    if (call === 1) {
      await sleep(throttleMs);
      return {
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '0' }),
        text: async () => 'rate limited',
      } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"answer":"ok"}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    } as unknown as Response;
  }) as typeof globalThis.fetch;
  return () => {
    globalThis.fetch = original;
  };
}

describe('OpenAiAdapter latency', () => {
  it('times the model separately from time lost to rate limiting', async () => {
    const restore = stubThrottleThenSuccess(120);
    try {
      const result = await makeAdapter().call({
        tenantId: 't1',
        agent: 'faq',
        messages: [{ role: 'user', content: 'hi' }],
        outputSchema: z.object({ answer: z.string() }),
      });
      // latencyMs used to start before the retry loop, so a throttled fast
      // model and a genuinely slow one reported the same number.
      expect(result.queuedMs ?? 0).toBeGreaterThanOrEqual(100);
      expect(result.latencyMs).toBeLessThan(100);
    } finally {
      restore();
    }
  });

  it('reports no queueing when the first attempt succeeds', async () => {
    const restore = stubThrottleThenSuccess(0);
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '{"answer":"ok"}' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }),
      }) as unknown as Response) as typeof globalThis.fetch;
    try {
      const result = await makeAdapter().call({
        tenantId: 't1',
        agent: 'faq',
        messages: [{ role: 'user', content: 'hi' }],
        outputSchema: z.object({ answer: z.string() }),
      });
      expect(result.queuedMs ?? 0).toBeLessThan(20);
    } finally {
      globalThis.fetch = original;
      restore();
    }
  });
});
