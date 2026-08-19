import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import { AiProviderError } from './openai.adapter';
import { AnthropicAdapter } from './anthropic.adapter';
import { GoogleAdapter } from './google.adapter';
import { OpenAiAdapter } from './openai.adapter';
import type { AiClient } from '../application/ports';

@Injectable()
export class AiClientFactory {
  private readonly openai: OpenAiAdapter;
  private readonly anthropic: AnthropicAdapter;
  private readonly google: GoogleAdapter;

  constructor(config: ConfigService<Env, true>) {
    this.openai = new OpenAiAdapter(config);
    this.anthropic = new AnthropicAdapter();
    this.google = new GoogleAdapter();
  }

  get(provider: string): AiClient {
    switch (provider) {
      case 'openai':
        return this.openai;
      case 'anthropic':
        return this.anthropic;
      case 'google':
        return this.google;
      default:
        throw new AiProviderError(provider, 'unknown provider');
    }
  }
}
