import { describe, expect, it } from 'vitest';
import { backoffMs, costInMicros, isRetryableStatus } from './openai.adapter';

describe('costInMicros', () => {
  const gpt4oMini = { inputCostPer1kTokens: 0.00015, outputCostPer1kTokens: 0.0006 };

  it('charges the real list price, not 1000x it', () => {
    // 1M in + 1M out on gpt-4o-mini = $0.15 + $0.60 = $0.75 = 750_000 micros.
    expect(costInMicros(1_000_000, 1_000_000, gpt4oMini)).toBe(750_000);
  });

  it('charges nothing for a free model', () => {
    expect(costInMicros(50_000, 10_000, { inputCostPer1kTokens: 0, outputCostPer1kTokens: 0 })).toBe(0);
  });

  it('uses the routed model’s own rates', () => {
    const sonnet = { inputCostPer1kTokens: 0.003, outputCostPer1kTokens: 0.015 };
    expect(costInMicros(1_000_000, 0, sonnet)).toBe(3_000_000);
    expect(costInMicros(1_000_000, 0, gpt4oMini)).toBe(150_000);
  });

  it('keeps a realistic WhatsApp turn well under a rupee', () => {
    // ~2k prompt tokens + 200 completion tokens on gpt-4o-mini.
    expect(costInMicros(2_000, 200, gpt4oMini)).toBe(420); // $0.00042
  });

  it('falls back to a sane default when the router passed no pricing', () => {
    expect(costInMicros(1_000_000, 0, undefined)).toBe(150_000);
  });
});

describe('isRetryableStatus', () => {
  it('retries rate limits and server faults', () => {
    for (const status of [408, 429, 500, 502, 503, 504]) {
      expect(isRetryableStatus(status)).toBe(true);
    }
  });

  it('does not retry a request that is simply wrong', () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(isRetryableStatus(status)).toBe(false);
    }
  });
});

describe('backoffMs', () => {
  it('grows exponentially and stays bounded', () => {
    expect(backoffMs(0, () => 1)).toBe(500);
    expect(backoffMs(1, () => 1)).toBe(1_000);
    expect(backoffMs(9, () => 1)).toBe(4_000);
  });

  it('jitters so parallel workers do not retry in lockstep', () => {
    expect(backoffMs(2, () => 0)).toBe(1_000);
    expect(backoffMs(2, () => 1)).toBe(2_000);
  });
});
