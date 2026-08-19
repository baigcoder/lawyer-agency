import { Module } from '@nestjs/common';
import { AiClientFactory } from './infrastructure/ai-client.factory';
import { AiLoggerService } from './infrastructure/ai-logger.service';
import { ModelRouterService } from './infrastructure/model-router.service';
import { GreetingIntroGeneratorService } from './application/greeting-intro-generator.service';
import { MODEL_ROUTER } from './application/ports';

/**
 * Shared LLM wiring for API-only features (settings intro generation) and the
 * full AI module. Imported once per process — no role-specific providers.
 */
@Module({
  providers: [
    AiClientFactory,
    { provide: MODEL_ROUTER, useClass: ModelRouterService },
    AiLoggerService,
    GreetingIntroGeneratorService,
  ],
  exports: [AiClientFactory, MODEL_ROUTER, AiLoggerService, GreetingIntroGeneratorService],
})
export class AiLlmModule {}
