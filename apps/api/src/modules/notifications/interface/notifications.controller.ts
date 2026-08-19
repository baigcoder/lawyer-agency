import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import { NotificationsService } from '../application/notifications.service';
import { UserPreferencesService } from '../application/user-preferences.service';
import { PushSubscriptionService } from '../application/push-subscription.service';

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const prefsSchema = z.record(z.string(), z.boolean());

type SubscriptionDto = z.infer<typeof subscriptionSchema>;
type PrefsDto = z.infer<typeof prefsSchema>;

/**
 * Notification API (Phase 9/12). Reads in-app notifications, manages channel
 * preferences, and registers browser push subscriptions.
 */
@Controller('notifications')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission('notifications:read')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly preferences: UserPreferencesService,
    private readonly pushSubscriptions: PushSubscriptionService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  list(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.list(tenantId, {
      userId: user.userId ?? '',
      unreadOnly: unreadOnly === 'true',
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('unread-count')
  unreadCount(@TenantId() tenantId: string, @CurrentUser() user: RequestPrincipal) {
    return this.notifications.unreadCount(tenantId, user.userId ?? '');
  }

  @Post(':id/read')
  @RequirePermission('notifications:write')
  markRead(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Param('id') id: string,
  ) {
    return this.notifications.markRead(tenantId, user.userId ?? '', id);
  }

  @Get('preferences')
  getPreferences(@TenantId() tenantId: string, @CurrentUser() user: RequestPrincipal) {
    return this.preferences.get(tenantId, user.userId ?? '');
  }

  @Post('preferences')
  @RequirePermission('notifications:write')
  updatePreferences(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Body(new ZodValidationPipe(prefsSchema)) body: PrefsDto,
  ) {
    return this.preferences.update(tenantId, user.userId ?? '', body);
  }

  @Get('vapid-public-key')
  vapidPublicKey() {
    return { publicKey: this.config.get('VAPID_PUBLIC_KEY', { infer: true }) ?? null };
  }

  @Post('push-subscriptions')
  @RequirePermission('notifications:write')
  subscribe(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Body(new ZodValidationPipe(subscriptionSchema)) body: SubscriptionDto,
  ) {
    return this.pushSubscriptions.save(tenantId, user.userId ?? '', {
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    });
  }

  @Delete('push-subscriptions')
  @RequirePermission('notifications:write')
  unsubscribe(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Body(new ZodValidationPipe(z.object({ endpoint: z.string().url() }))) body: { endpoint: string },
  ) {
    return this.pushSubscriptions.remove(tenantId, user.userId ?? '', body.endpoint);
  }
}
