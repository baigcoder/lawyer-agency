import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { z } from 'zod';
import type { Env } from '../../../config/env';
import { AiProviderError } from './openai.adapter';
import { AnthropicAdapter } from './anthropic.adapter';
import { GoogleAdapter } from './google.adapter';
import { OpenAiAdapter } from './openai.adapter';
import { AiLoggerService } from './ai-logger.service';
import type { AiCallOptions, AiCallResult, AiClient } from '../application/ports';

@Injectable()
export class AiClientFactory {
  private readonly logger = new Logger(AiClientFactory.name);
  private readonly clients: Record<string, AiClient>;

  constructor(config: ConfigService<Env, true>, aiLogger: AiLoggerService) {
    const adapters = [new OpenAiAdapter(config), new AnthropicAdapter(), new GoogleAdapter()];
    this.clients = Object.fromEntries(
      adapters.map((adapter) => [adapter.provider, withFailureLogging(adapter, aiLogger, this.logger)]),
    );
  }

  get(provider: string): AiClient {
    const client = this.clients[provider];
    if (!client) throw new AiProviderError(provider, 'unknown provider');
    return client;
  }
}

/**
 * Logs a call that throws to `ai_logs`, then rethrows.
 *
 * Callers log their own successes after `call` returns, so a throw skipped the
 * log line: the failures — the calls that send the client a canned fallback —
 * were exactly the rows missing. Done here, it covers every caller, including
 * ones added later. Logging is best effort: a failed insert must not replace
 * the provider's error, which is what the caller handles.
 */
export function withFailureLogging(client: AiClient, aiLogger: AiLoggerService, logger: Logger): AiClient {
  return {
    provider: client.provider,
    async call<T>(options: AiCallOptions<z.ZodType>): Promise<AiCallResult<T>> {
      const started = Date.now();
      try {
        return await client.call<T>(options);
      } catch (error) {
        await aiLogger
          .logFailure({
            tenantId: options.tenantId,
            agent: options.agent,
            provider: client.provider,
            model: options.model ?? 'default',
            promptVersionId: options.promptVersionId,
            correlationId: options.correlationId,
            elapsedMs: Date.now() - started,
            error: error instanceof Error ? error.message : String(error),
          })
          .catch((logError: unknown) => {
            logger.warn(
              { agent: options.agent, err: logError instanceof Error ? logError.message : String(logError) },
              'could not record failed LLM call in ai_logs',
            );
          });
        throw error;
      }
    },
  };
}
