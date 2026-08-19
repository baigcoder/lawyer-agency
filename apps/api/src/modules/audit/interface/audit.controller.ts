import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { AuthGuard } from '../../../common/auth/auth.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';
import { AuditService } from '../application/audit.service';

@Controller('audit-log')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission('audit:read')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @TenantId() tenantId: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const opts: { action?: string; limit?: number; offset?: number } = {};
    if (action) opts.action = action;
    if (limit) opts.limit = Number(limit);
    if (offset) opts.offset = Number(offset);
    return this.audit.list(tenantId, opts);
  }
}