import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { Env } from '../../../config/env';
import { DomainError } from '../../../common/errors/domain-error';
import type { AiCallOptions, AiCallResult, AiClient, LlmMessage } from '../application/ports';

interface OpenAiResponse {
  choices?: Array<{
    message?: { content?: string | null };
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
    const apiKey = this.config.get('OPENAI_API_KEY', { infer: true });
    if (!apiKey) throw new AiProviderError(this.provider, 'OPENAI_API_KEY not configured');

    const baseUrl = this.config.get('OPENAI_BASE_URL', { infer: true }).replace(/\/$/, '');
    const model: string = options.model ?? this.config.get('AI_DEFAULT_MODEL', { infer: true });
    const started = Date.now();
    const maxAttempts = 4;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
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

      if (response.ok) {
        const latencyMs = Date.now() - started;
        const body = (await response.json()) as OpenAiResponse;
        const content = body.choices?.[0]?.message?.content ?? '';
        const parsed = this.parseAndValidate(content, options.outputSchema);

        const tokensIn = body.usage?.prompt_tokens ?? estimateTokens(options.messages);
        const tokensOut = body.usage?.completion_tokens ?? estimateTokens([{ role: 'assistant', content }]);
        const costMicros = Math.round(
          (tokensIn * 0.15 + tokensOut * 0.6) * 1000,
        );

        return {
          output: parsed as T,
          provider: this.provider,
          model,
          latencyMs,
          tokensIn,
          tokensOut,
          costMicros,
        };
      }

      const text = await response.text().catch(() => 'unknown');
      if (response.status === 429 && attempt < maxAttempts - 1) {
        const waitMs = this.parseRetryAfter(response, text);
        this.logger.warn({ status: 429, agent: options.agent, attempt, waitMs }, 'rate limited, retrying');
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      this.logger.warn({ status: response.status, agent: options.agent }, 'openai call failed');
      throw new AiProviderError(this.provider, `HTTP ${response.status}: ${text}`);
    }

    throw new AiProviderError(this.provider, 'internal retry exhausted');
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
      const stripped = content
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '');
      raw = JSON.parse(stripped || '{}');
    } catch {
      throw new AiProviderError(this.provider, 'response is not valid JSON');
    }
    const result = schema.safeParse(raw);
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
