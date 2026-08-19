import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { AuthGuard, type RequestPrincipal } from '../../../common/auth/auth.guard';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { EscalationsService } from '../application/escalations.service';

const listQuerySchema = z.object({
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']).optional(),
  assigneeUserId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

type ListQuery = z.infer<typeof listQuerySchema>;

/**
 * Dashboard escalations API — urgent AI handoffs requiring human review.
 */
@Controller('escalations')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission('inbox:read')
export class EscalationsController {
  constructor(private readonly escalations: EscalationsService) {}

  @Get()
  list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery,
  ) {
    return this.escalations.list(tenantId, query);
  }

  @Post(':id/acknowledge')
  @RequirePermission('inbox:write')
  acknowledge(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.escalations.acknowledge(tenantId, id, user.userId);
  }

  @Post(':id/assign')
  @RequirePermission('inbox:write')
  assign(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(z.object({ assigneeUserId: z.string().uuid().nullable() })))
    body: { assigneeUserId: string | null },
  ) {
    return this.escalations.assign(tenantId, id, body.assigneeUserId);
  }

  @Post(':id/resolve')
  @RequirePermission('inbox:write')
  resolve(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.escalations.resolve(tenantId, id);
  }
}
