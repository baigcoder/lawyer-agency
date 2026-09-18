import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { Env } from '../../../config/env';
import { DomainError } from '../../../common/errors/domain-error';
import type { AiCallOptions, AiCallResult, AiClient, LlmMessage, TokenPricing } from '../application/ports';
import { resolveChatCompletionsRuntime } from '../../../config/llm-runtime';
import { extractJsonObject } from './json-content';

interface OpenAiResponse {
  choices?: Array<{
    message?: { content?: string | null; reasoning?: string | null };
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export class AiProviderError extends DomainError {
  readonly httpStatus = 502;
  constructor(provider: string, message: string) {
    super(`AI provider ${provider} error: ${message}`);
    this.name = 'AiProviderError';
  }
}

@Injectable()
export class OpenAiAdapter implements AiClient {
  readonly provider = 'openai';
  private readonly logger = new Logger(OpenAiAdapter.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async call<T>(options: AiCallOptions<z.ZodType>): Promise<AiCallResult<T>> {
    const runtime = resolveChatCompletionsRuntime(this.config);
    if (!runtime) throw new AiProviderError(this.provider, 'GROQ_API_KEY or OPENAI_API_KEY not configured');
    const { apiKey, baseUrl } = runtime;
    const model: string = options.model ?? this.config.get('AI_DEFAULT_MODEL', { infer: true });
    const started = Date.now();
    const maxAttempts = 4;
    // A WhatsApp turn that retries for a minute is worse than a fallback reply.
    const deadline = started + (options.timeoutMs ?? 20_000) * 2;
    let lastError: Error | null = null;
    // Why earlier attempts failed. They need opposite remedies — rate limits
    // mean change plan or provider; invalid output means fix prompt or schema.
    const retries = { rateLimited: 0, invalidOutput: 0, network: 0 };

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0 && Date.now() >= deadline) break;

      // Timed per attempt, not from the top of the loop. Measuring from
      // `started` folds rate-limit backoff into the model's latency, so a
      // throttled fast model and a genuinely slow one look identical — and
      // they need opposite fixes.
      const attemptStarted = Date.now();
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: options.messages,
            temperature: options.temperature ?? 0.2,
            max_tokens: options.maxTokens ?? 1024,
            response_format: { type: 'json_object' },
          }),
          signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
        });
      } catch (error) {
        // Timeouts, DNS blips and dropped sockets throw instead of returning a
        // response; before this they failed the whole turn on the first hiccup.
        lastError = error instanceof Error ? error : new Error(String(error));
        retries.network += 1;
        this.logger.warn(
          { agent: options.agent, attempt, err: lastError.message },
          'LLM request failed to complete, retrying',
        );
        if (attempt === maxAttempts - 1) break;
        await sleep(backoffMs(attempt));
        continue;
      }

      if (response.ok) {
        const latencyMs = Date.now() - attemptStarted;
        const queuedMs = attemptStarted - started;
        const body = (await response.json()) as OpenAiResponse;
        const content =
          body.choices?.[0]?.message?.content ?? body.choices?.[0]?.message?.reasoning ?? '';

        let parsed: unknown;
        try {
          parsed = this.parseAndValidate(content, options.outputSchema);
        } catch (error) {
          // Malformed JSON from the model is transient — a resample usually
          // fixes it, and it is cheaper than dropping the client's turn.
          lastError = error instanceof Error ? error : new Error(String(error));
          retries.invalidOutput += 1;
          if (attempt === maxAttempts - 1 || Date.now() >= deadline) throw lastError;
          this.logger.warn(
            { agent: options.agent, attempt },
            'LLM returned unusable JSON, resampling',
          );
          await sleep(backoffMs(attempt));
          continue;
        }

        const tokensIn = body.usage?.prompt_tokens ?? estimateTokens(options.messages);
        const tokensOut = body.usage?.completion_tokens ?? estimateTokens([{ role: 'assistant', content }]);
        const costMicros = costInMicros(tokensIn, tokensOut, options.pricing);

        if (attempt > 0) {
          // queuedMs is the time the client waited beyond the model's own
          // latency. `retries` says what it was spent on.
          this.logger.warn(
            { agent: options.agent, model, attempts: attempt + 1, latencyMs, queuedMs, ...retries },
            'LLM call succeeded after retries',
          );
        }

        return {
          output: parsed as T,
          provider: this.provider,
          model,
          latencyMs,
          queuedMs,
          tokensIn,
          tokensOut,
          costMicros,
        };
      }

      const text = await response.text().catch(() => 'unknown');
      if (isRetryableStatus(response.status) && attempt < maxAttempts - 1) {
        if (response.status === 429) retries.rateLimited += 1;
        else retries.network += 1;
        const waitMs =
          response.status === 429 ? this.parseRetryAfter(response, text) : backoffMs(attempt);
        this.logger.warn(
          { status: response.status, agent: options.agent, attempt, waitMs },
          'LLM call retryable, retrying',
        );
        await sleep(waitMs);
        continue;
      }

      this.logger.warn({ status: response.status, agent: options.agent }, 'openai call failed');
      throw new AiProviderError(this.provider, `HTTP ${response.status}: ${text}`);
    }

    throw new AiProviderError(
      this.provider,
      lastError ? `retries exhausted: ${lastError.message}` : 'internal retry exhausted',
    );
  }

  private parseRetryAfter(response: Response, bodyText: string): number {
    const header = response.headers.get('Retry-After')?.trim();
    if (header) {
      const seconds = parseInt(header, 10);
      if (!Number.isNaN(seconds)) return Math.min(seconds * 1000, 30_000);
    }
    const match = /try again in ([\d.]+)\s*(ms|s|m)?/i.exec(bodyText);
    if (match) {
      const value = parseFloat(match[1] ?? '0');
      const unit = (match[2] ?? 's').toLowerCase();
      if (unit === 'ms') return Math.min(value, 30_000);
      if (unit === 'm') return Math.min(value * 60_000, 30_000);
      return Math.min(value * 1000, 30_000);
    }
    return 1000;
  }

  private parseAndValidate(content: string, schema: z.ZodType): unknown {
    let raw: unknown;
    try {
      raw = extractJsonObject(content);
    } catch {
      throw new AiProviderError(this.provider, 'response is not valid JSON');
    }
    const result = schema.safeParse(dropNulls(raw));
    if (!result.success) {
      this.logger.warn({ issues: result.error.issues }, 'structured output validation failed');
      throw new AiProviderError(this.provider, 'response failed schema validation');
    }
    return result.data;
  }
}

function estimateTokens(messages: LlmMessage[]): number {
  return Math.ceil(messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Removes object keys whose value is `null`, recursively.
 *
 * In JSON mode a model says "no value" with `null` — `"handoffReason": null` —
 * while every agent schema marks such fields `.optional()`, which accepts a
 * missing key and rejects `null`. A correct answer was therefore thrown away as
 * invalid and cost a full retry; under rate limiting that sometimes exhausted
 * the retries and the client got the canned fallback reply.
 *
 * Normalising at the adapter fixes all agents at once. No LLM output schema
 * here gives `null` a meaning of its own. Array elements are kept in place so
 * list lengths never change; objects inside arrays (citations) are cleaned.
 */
export function dropNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropNulls);
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    if (inner === null) continue;
    out[key] = dropNulls(inner);
  }
  return out;
}

/**
 * Transient server-side and connection failures. A 4xx other than these is the
 * request's own fault and will fail identically on retry.
 */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

/** Exponential backoff with jitter, so retries do not stampede in lockstep. */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(500 * 2 ** attempt, 4_000);
  return Math.round(base * (0.5 + random() * 0.5));
}

/** Fallback when the router did not pass pricing — gpt-4o-mini list price. */
const DEFAULT_PRICING: TokenPricing = {
  inputCostPer1kTokens: 0.00015,
  outputCostPer1kTokens: 0.0006,
};

/**
 * USD per 1k tokens → micro-dollars for `ai_logs.costMicros`, which the monthly
 * budget gate sums. This used to be `(tokensIn * 0.15 + tokensOut * 0.6) * 1000`
 * — gpt-4o-mini's per-*million* price applied per token, i.e. 1000x over, and
 * charged even for free Groq models. Any tenant with a budget hit the cap
 * almost immediately and the router fell back to permanent HUMAN_HANDOFF.
 */
export function costInMicros(
  tokensIn: number,
  tokensOut: number,
  pricing: TokenPricing | undefined,
): number {
  const rates = pricing ?? DEFAULT_PRICING;
  const usd =
    (tokensIn / 1000) * rates.inputCostPer1kTokens + (tokensOut / 1000) * rates.outputCostPer1kTokens;
  return Math.round(usd * 1_000_000);
}
