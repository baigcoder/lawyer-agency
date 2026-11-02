import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { AuthGuard } from '../../../common/auth/auth.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { QuickRepliesService } from '../application/quick-replies.service';

const quickReplySchema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(4000),
  language: z.enum(['en', 'ur']),
});
type QuickReplyBody = z.infer<typeof quickReplySchema>;

/** Everyone who can read the inbox can use quick replies; owners and lawyers edit them. */
@Controller('quick-replies')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission('inbox:read')
export class QuickRepliesController {
  constructor(private readonly quickReplies: QuickRepliesService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.quickReplies.list(tenantId);
  }

  @Post()
  @RequirePermission('quick-replies:manage')
  create(@TenantId() tenantId: string, @Body(new ZodValidationPipe(quickReplySchema)) body: QuickReplyBody) {
    return this.quickReplies.create(tenantId, body);
  }

  @Post('starter-pack')
  @RequirePermission('quick-replies:manage')
  addStarterPack(@TenantId() tenantId: string) {
    return this.quickReplies.addStarterPack(tenantId);
  }

  @Put(':id')
  @RequirePermission('quick-replies:manage')
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(quickReplySchema)) body: QuickReplyBody,
  ) {
    return this.quickReplies.update(tenantId, id, body);
  }

  @Delete(':id')
  @RequirePermission('quick-replies:manage')
  remove(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.quickReplies.remove(tenantId, id);
  }
}
