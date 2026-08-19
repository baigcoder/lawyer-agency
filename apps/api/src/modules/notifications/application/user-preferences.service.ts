import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';

export type NotificationChannelName = 'DASHBOARD' | 'WEB_PUSH' | 'WHATSAPP_TEMPLATE' | 'EMAIL_DIGEST';

export interface UserPreferencesInput {
  [channel: string]: boolean;
}

/**
 * Read/update per-user notification channel preferences (Phase 12).
 */
@Injectable()
export class UserPreferencesService {
  constructor(private readonly uow: UnitOfWork) {}

  async get(tenantId: string, userId: string): Promise<Record<NotificationChannelName, boolean>> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId } });
      const stored = (user?.notificationPrefs as Record<string, boolean> | undefined) ?? {};
      return {
        DASHBOARD: stored.DASHBOARD ?? true,
        WEB_PUSH: stored.WEB_PUSH ?? false,
        WHATSAPP_TEMPLATE: stored.WHATSAPP_TEMPLATE ?? false,
        EMAIL_DIGEST: stored.EMAIL_DIGEST ?? false,
      };
    });
  }

  async update(
    tenantId: string,
    userId: string,
    prefs: UserPreferencesInput,
  ): Promise<void> {
    return this.uow.withTenant(tenantId, async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { notificationPrefs: prefs as never },
      });
    });
  }
}
