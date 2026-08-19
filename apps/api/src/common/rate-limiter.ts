import { DomainError } from './errors/domain-error';

/** Too many requests from this principal (A12) — HTTP 429. */
export class RateLimitError extends DomainError {
  readonly httpStatus = 429;
  constructor(action: string, retryAfterSeconds: number) {
    super(`Too many ${action} attempts — retry in ~${Math.ceil(retryAfterSeconds)}s`);
    this.name = 'RateLimitError';
  }
}

/**
 * Minimal in-memory sliding-window limiter (A12). Process-local by design —
 * enough for per-tenant churn guards on the API role; a Redis-backed
 * limiter lands with Phase 6 hardening if ever needed cross-instance.
 * Unbounded keys are not a concern at tenant cardinality; entries self-prune
 * on access and the maps hold only timestamps.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Records a hit and reports whether it was within the budget. */
  allow(key: string, now = Date.now()): boolean {
    const windowStart = now - this.windowMs;
    const prior = (this.hits.get(key) ?? []).filter((t) => t > windowStart);
    if (prior.length >= this.limit) {
      this.hits.set(key, prior);
      return false;
    }
    prior.push(now);
    this.hits.set(key, prior);
    return true;
  }

  /** Seconds until the oldest hit leaves the window (for Retry-After copy). */
  retryAfterSeconds(key: string, now = Date.now()): number {
    const prior = this.hits.get(key) ?? [];
    const oldest = prior[0];
    if (oldest === undefined) return 0;
    return Math.max(0, (oldest + this.windowMs - now) / 1000);
  }
}
