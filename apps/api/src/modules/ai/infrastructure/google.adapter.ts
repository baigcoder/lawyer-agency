import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiProviderError } from './openai.adapter';
import type { AiCallOptions, AiCallResult, AiClient } from '../application/ports';

/**
 * Google Gemini adapter stub — present in the provider registry so model
 * routing can prefer it when configured. Implement with native fetch when a
 * project key is available (no SDK dependency).
 */
@Injectable()
export class GoogleAdapter implements AiClient {
  readonly provider = 'google';

  async call<T>(options: AiCallOptions<z.ZodType>): Promise<AiCallResult<T>> {
    void options;
    throw new AiProviderError(this.provider, 'Google adapter not yet implemented');
  }
}
