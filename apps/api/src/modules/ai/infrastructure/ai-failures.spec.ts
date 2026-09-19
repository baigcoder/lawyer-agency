import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describeRetries, OpenAiAdapter, supportsReasoningEffort } from './openai.adapter';
import { withFailureLogging } from './ai-client.factory';
import type { AiLoggerService } from './ai-logger.service';
import type { AiClient } from '../application/ports';

function makeAdapter(model = 'openai/gpt-oss-20b'): OpenAiAdapter {
  const values: Record<string, string> = {
    GROQ_API_KEY: 'gsk_test',
    GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
    AI_DEFAULT_MODEL: model,
  };
  const config = { get: (key: string) => values[key] } as unknown as ConfigService<never, true>;
  return new OpenAiAdapter(config);
}

const ok = (content: string) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }),
  }) as unknown as Response;

const groqJsonFailure = (failedGeneration: string) =>
  ({
    ok: false,
    status: 400,
    headers: new Headers(),
    text: async () =>
      JSON.stringify({
        error: {
          message: 'Failed to generate JSON.',
          type: 'invalid_request_error',
          code: 'json_validate_failed',
          failed_generation: failedGeneration,
        },
      }),
  }) as unknown as Response;

async function withFetch<T>(responses: Response[], run: (bodies: unknown[]) => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  const bodies: unknown[] = [];
  let i = 0;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return responses[Math.min(i++, responses.length - 1)]!;
  }) as typeof globalThis.fetch;
  try {
    return await run(bodies);
  } finally {
    globalThis.fetch = original;
  }
}

const call = (adapter: OpenAiAdapter, extra: Record<string, unknown> = {}) =>
  adapter.call<{ triggered: boolean }>({
    tenantId: 't1',
    agent: 'escalation',
    messages: [{ role: 'user', content: 'hi' }],
    outputSchema: z.object({ triggered: z.boolean() }),
    ...extra,
  });

describe("Groq's json_validate_failed", () => {
  it('is resampled like our own parse failure, not treated as a bad request', async () => {
    await withFetch(
      [groqJsonFailure('max completion tokens reached before generating a valid document'), ok('{"triggered":true}')],
      async (bodies) => {
        const result = await call(makeAdapter());
        expect(result.output.triggered).toBe(true);
        expect(bodies).toHaveLength(2);
      },
    );
  });

  it('names running out of tokens, the cause that means raise the budget', async () => {
    await withFetch([groqJsonFailure('max completion tokens reached before generating a valid document')], async () => {
      await expect(call(makeAdapter())).rejects.toThrow(/ran out of tokens.*invalid output 4/);
    });
  });

  it("never copies the model's partial output into the error, which lands in ai_logs", async () => {
    // failed_generation is usually the partial JSON, which can quote the client.
    await withFetch([groqJsonFailure('{"responseText":"Aap ke bhai ko police ne')], async () => {
      const error = await call(makeAdapter()).catch((e: Error) => e);
      expect(String(error)).not.toContain('police');
      expect(String(error)).toContain('sample was not valid JSON');
    });
  });
});

describe('reasoning effort', () => {
  it('is sent to gpt-oss, whose reasoning spends maxTokens', async () => {
    await withFetch([ok('{"triggered":false}')], async (bodies) => {
      await call(makeAdapter(), { reasoningEffort: 'low' });
      expect(bodies[0]).toMatchObject({ reasoning_effort: 'low' });
    });
  });

  it('is left out for models that reject the field', async () => {
    await withFetch([ok('{"triggered":false}')], async (bodies) => {
      await call(makeAdapter('llama-3.3-70b-versatile'), { reasoningEffort: 'low' });
      expect(bodies[0]).not.toHaveProperty('reasoning_effort');
    });
  });

  it('is left out when the caller does not ask for it', async () => {
    await withFetch([ok('{"triggered":false}')], async (bodies) => {
      await call(makeAdapter());
      expect(bodies[0]).not.toHaveProperty('reasoning_effort');
    });
  });

  it('recognises gpt-oss with or without the provider prefix', () => {
    expect(supportsReasoningEffort('openai/gpt-oss-20b')).toBe(true);
    expect(supportsReasoningEffort('gpt-oss-120b')).toBe(true);
    expect(supportsReasoningEffort('gpt-4o-mini')).toBe(false);
  });
});

describe('exhausted retries', () => {
  it('say what the attempts were lost to', () => {
    expect(describeRetries({ rateLimited: 2, invalidOutput: 1, network: 0 })).toBe(
      'after 3 failed attempts (rate limited 2, invalid output 1)',
    );
    expect(describeRetries({ rateLimited: 0, invalidOutput: 0, network: 1 })).toBe(
      'after 1 failed attempt (network 1)',
    );
  });

  it('report rate limiting when every attempt was throttled', async () => {
    const throttled = {
      ok: false,
      status: 429,
      headers: new Headers({ 'retry-after': '0' }),
      text: async () => 'Rate limit reached on tokens per minute (TPM)',
    } as unknown as Response;
    await withFetch([throttled], async () => {
      await expect(call(makeAdapter())).rejects.toThrow(/HTTP 429.*tokens per minute.*rate limited 4/);
    });
  });
});

describe('withFailureLogging', () => {
  const quietLogger = { warn: vi.fn() } as unknown as Logger;

  function failing(error: Error): AiClient {
    return { provider: 'openai', call: async () => Promise.reject(error) };
  }

  it('writes a failed call to ai_logs, which callers never did', async () => {
    const logFailure = vi.fn(async () => {});
    const client = withFailureLogging(
      failing(new Error('response failed schema validation after 4 failed attempts (rate limited 3, invalid output 1)')),
      { logFailure } as unknown as AiLoggerService,
      quietLogger,
    );
    await expect(
      client.call({
        tenantId: 't1',
        agent: 'intake',
        model: 'openai/gpt-oss-20b',
        messages: [],
        outputSchema: z.object({}),
        promptVersionId: 'p1',
        correlationId: 'c1',
      }),
    ).rejects.toThrow('schema validation');
    expect(logFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        agent: 'intake',
        provider: 'openai',
        model: 'openai/gpt-oss-20b',
        promptVersionId: 'p1',
        correlationId: 'c1',
        error: expect.stringContaining('rate limited 3'),
      }),
    );
  });

  it("rethrows the provider's error even when the log insert fails", async () => {
    const client = withFailureLogging(
      failing(new Error('HTTP 503')),
      { logFailure: async () => Promise.reject(new Error('db down')) } as unknown as AiLoggerService,
      quietLogger,
    );
    await expect(
      client.call({ tenantId: 't1', agent: 'faq', messages: [], outputSchema: z.object({}) }),
    ).rejects.toThrow('HTTP 503');
  });

  it('leaves successes to the caller, so they are not logged twice', async () => {
    const logFailure = vi.fn(async () => {});
    const client = withFailureLogging(
      {
        provider: 'openai',
        call: async <T>() => ({ output: {} as T, provider: 'openai', model: 'm', latencyMs: 1, tokensIn: 1, tokensOut: 1, costMicros: 0 }),
      },
      { logFailure } as unknown as AiLoggerService,
      quietLogger,
    );
    await client.call({ tenantId: 't1', agent: 'faq', messages: [], outputSchema: z.object({}) });
    expect(logFailure).not.toHaveBeenCalled();
  });
});
