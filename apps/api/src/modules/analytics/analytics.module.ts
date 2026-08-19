import { Module, type DynamicModule } from '@nestjs/common';
import { AnalyticsService } from './application/analytics.service';
import { AnalyticsProjector } from './application/analytics-projector.service';
import { AnalyticsEventHandler, createAnalyticsHandlers } from './application/analytics-event.handler';
import { AnalyticsController } from './interface/analytics.controller';

/**
 * Analytics — event-projected read models (CQRS read side, D-018): firm
 * funnel, containment, response times, platform tenant-health. Never scans
 * operational tables; reads projections fed by domain events.
 * Owns: analytics read models (platform schema aggregates).
 * Phase 14: daily aggregate projection + dashboard metrics endpoint.
 */
@Module({})
export class AnalyticsModule {
  static register(role: 'api' | 'worker'): DynamicModule {
    return {
      module: AnalyticsModule,
      controllers: role === 'api' ? [AnalyticsController] : [],
      providers: [
        AnalyticsService,
        AnalyticsProjector,
        AnalyticsEventHandler,
      ],
      exports: [AnalyticsService, AnalyticsProjector],
    };
  }
}

export { createAnalyticsHandlers };
