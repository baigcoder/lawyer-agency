import { Body, Controller, Get, Param, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';
import { z } from 'zod';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { AuthGuard } from '../../../common/auth/auth.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { KnowledgeBaseService } from '../application/knowledge-base.service';

const createKbSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(100_000),
  language: z.string().min(2).max(5),
  category: z.string().max(100).optional(),
});

const updateKbSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(100_000).optional(),
  category: z.string().max(100).optional(),
});

type CreateKbEntryDto = z.infer<typeof createKbSchema>;
type UpdateKbEntryDto = z.infer<typeof updateKbSchema>;

/**
 * Knowledge base management API (Phase 8). Protected by AuthGuard/PermissionGuard
 * (Phase 10, D-017).
 */
@Controller('knowledge-base')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission('knowledge-base:read')
export class KnowledgeBaseController {
  constructor(private readonly kb: KnowledgeBaseService) {}

  @Post()
  @RequirePermission('knowledge-base:write')
  @UsePipes(new ZodValidationPipe(createKbSchema))
  create(@TenantId() tenantId: string, @Body() dto: CreateKbEntryDto) {
    return this.kb.create({ tenantId, ...dto });
  }

  @Get()
  list(@TenantId() tenantId: string, @Query('status') status?: string) {
    return this.kb.list(tenantId, status ? { status } : {});
  }

  @Get(':id')
  get(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.kb.get(tenantId, id);
  }

  @Put(':id')
  @RequirePermission('knowledge-base:write')
  @UsePipes(new ZodValidationPipe(updateKbSchema))
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateKbEntryDto) {
    return this.kb.update(tenantId, id, dto);
  }

  @Post(':id/publish')
  @RequirePermission('knowledge-base:write')
  publish(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.kb.publish(tenantId, id);
  }

  @Post(':id/archive')
  @RequirePermission('knowledge-base:write')
  archive(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.kb.archive(tenantId, id);
  }
}
