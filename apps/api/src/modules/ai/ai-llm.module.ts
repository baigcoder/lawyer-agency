import { Module } from '@nestjs/common';
import { AiClientFactory } from './infrastructure/ai-client.factory';
import { AiLoggerService } from './infrastructure/ai-logger.service';
import { ModelRouterService } from './infrastructure/model-router.service';
import { GreetingIntroGeneratorService } from './application/greeting-intro-generator.service';
import { MODEL_ROUTER } from './application/ports';
import { AI_USAGE } from './application/ai-usage.port';

/**
 * Shared LLM wiring for API-only features (settings intro generation) and the
 * full AI module. Imported once per process — no role-specific providers.
 */
@Module({
  providers: [
    AiClientFactory,
    { provide: MODEL_ROUTER, useClass: ModelRouterService },
    AiLoggerService,
    // Speech spend from the voice module lands in the same `ai_logs` table, so
    // one budget covers every kind of AI cost a tenant incurs.
    { provide: AI_USAGE, useExisting: AiLoggerService },
    GreetingIntroGeneratorService,
  ],
  exports: [AiClientFactory, MODEL_ROUTER, AiLoggerService, AI_USAGE, GreetingIntroGeneratorService],
})
export class AiLlmModule {}
