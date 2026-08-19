/**
 * Notification channel port (Phase 12). Each channel accepts a prepared
 * notification job and delivers it through its own transport. Channels are
 * stateless; any per-user state (push subscription, email address) is read
 * from the database at send time.
 */

export interface ChannelNotification {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  url?: string | undefined;
  payload: Record<string, unknown>;
}

export interface NotificationChannel {
  readonly name: string;
  send(notification: ChannelNotification): Promise<{ sent: boolean }>;
}

export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');
