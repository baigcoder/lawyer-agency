import { Controller, Post, UseGuards } from '@nestjs/common';
import { TemplateSyncService } from '../application/template-sync.service';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { AuthGuard } from '../../../common/auth/auth.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';

/**
 * WhatsApp template management (Phase 6b). Sync with Meta and apply webhook
 * status updates. Template seeding is normally invoked from onboarding; it is
 * also exposed here for admin/dev convenience.
 *
 * Template-status webhook updates are applied by the webhook ingest pipeline
 * (HMAC-verified POST /webhooks/whatsapp) — never over an open HTTP route.
 */
@Controller('whatsapp/templates')
@UseGuards(AuthGuard, PermissionGuard)
export class WhatsappTemplatesController {
  constructor(private readonly templateSync: TemplateSyncService) {}

  @Post('sync')
  @RequirePermission('whatsapp:templates:sync')
  async sync(@TenantId() tenantId: string) {
    const result = await this.templateSync.syncFromMeta(tenantId);
    return result;
  }

  @Post('seed-defaults')
  @RequirePermission('whatsapp:templates:manage')
  async seedDefaults(@TenantId() tenantId: string) {
    return this.templateSync.seedDefaultTemplates(tenantId);
  }
}
