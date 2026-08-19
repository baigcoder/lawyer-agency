import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { AuthGuard } from '../../../common/auth/auth.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { AnalyticsService } from '../application/analytics.service';

const dailyQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});

/**
 * Analytics read API (Phase 14, D-018/D-113). Dashboard and daily series read
 * live operational aggregates; event projections remain for async enrichment.
 */
@Controller('analytics')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission('analytics:read')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('dashboard')
  dashboard(@TenantId() tenantId: string) {
    return this.analytics.dashboard(tenantId);
  }

  /** Zero-filled daily series (oldest first) for the analytics page chart. */
  @Get('daily')
  daily(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(dailyQuerySchema)) query: z.infer<typeof dailyQuerySchema>,
  ) {
    return this.analytics.daily(tenantId, query.days);
  }

  @Get('funnel')
  funnel(@TenantId() tenantId: string) {
    return this.analytics.funnel(tenantId);
  }

  @Get('revenue-by-practice-area')
  revenueByPracticeArea(@TenantId() tenantId: string) {
    return this.analytics.revenueByPracticeArea(tenantId);
  }

  @Get('sla-breaches')
  slaBreaches(@TenantId() tenantId: string) {
    return this.analytics.slaBreaches(tenantId);
  }
}
