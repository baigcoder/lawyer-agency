# Phase 12 — Notification Channels

**Goal:** Extend notifications beyond the dashboard to web push, WhatsApp templates, and email digests, with per-user preferences and push subscriptions.

## What was built

### Backend (`apps/api`)

1. **Schema / migration**
   - Added `EMAIL_DIGEST` to `NotificationChannel` enum.
   - Added `User.notificationPrefs` JSON column.
   - Added `PushSubscription` model (endpoint, p256dh, auth) with RLS policy.
   - Migration `0008_notification_channels` created; Prisma client regenerated.

2. **Notification channel port + adapters** (`modules/notifications/application/channels/`, `infrastructure/channels/`)
   - `NotificationChannel` port: `send(notification)`.
   - `DashboardChannel`: persists an in-app notification row.
   - `WebPushChannel`: VAPID-based push using `web-push`; auto-removes stale subscriptions on 404/410.
   - `WhatsappTemplateChannel`: sends approved-template alerts to lawyers' WhatsApp numbers via `SendService`.
   - `EmailDigestChannel`: pluggable `EmailClient` port; dev stand-in logs messages.

3. **Dispatcher + worker**
   - `NotificationDispatcher`: reads user preferences, sends dashboard synchronously, enqueues async channel jobs.
   - `ChannelSendProcessor`: worker on the `notifications` queue that routes channel jobs to the right adapter.

4. **Preferences & subscriptions**
   - `UserPreferencesService`: get/update per-user channel toggles.
   - `PushSubscriptionService`: save/remove browser push subscriptions.
   - Extended `NotificationsController` with `/v1/notifications/preferences`, `/v1/notifications/vapid-public-key`, `/v1/notifications/push-subscriptions`.

5. **Event handlers updated**
   - `createNotificationHandlers` now uses `NotificationDispatcher` instead of only creating dashboard rows.
   - `EscalationSlaMonitor` still creates dashboard notifications; it can be extended to dispatch to all channels.

### Frontend (`apps/web`)

1. **Settings page** (`/dashboard/settings`)
   - Added "Notification channels" card with toggles for dashboard, web push, WhatsApp templates, email digest.
   - Browser push subscription flow: requests permission, registers service worker, subscribes with VAPID public key, sends subscription to backend.

2. **Service worker** (`public/service-worker.js`)
   - Handles `push` events and displays browser notifications.
   - Handles `notificationclick` to focus/open the dashboard.

## Decisions (D-076…D-079)

- **D-076:** Notification channels as a port with adapters; async channel sends via `notifications` queue.
- **D-077:** Per-user notification preferences stored as JSON on `User.notificationPrefs`; dashboard default-on, others default-off.
- **D-078:** Web push subscriptions stored per user; stale subscriptions auto-deleted on 404/410.
- **D-079:** Email digest uses a pluggable `EmailClient` port; dev mode logs, production wires SMTP/Resend.

## Verification

- `npx tsc -p tsconfig.build.json --noEmit` — clean.
- `npx vitest run` — **22 test files, 76 tests pass**.
- `npx eslint "src/**/*.ts"` — clean.
- `npm run build` — API and web both build.

## Next

- Phase 13 (payments: JazzCash/Easypaisa/card rails) or Phase 14 (analytics CQRS read models).
