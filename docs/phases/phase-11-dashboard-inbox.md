# Phase 11 — Dashboard Inbox / Assignment UX

**Goal:** Build the dashboard inbox where firm staff can see WhatsApp conversations, assign them, change conversation state, and send manual replies.

## What was built

### Backend (`apps/api`)

1. **Schema / migration**
   - Added `Conversation.assignedToId` (nullable FK to `User`) and index.
   - Added `Message.senderUser` relation so outbound manual messages know which staff user sent them.
   - Migration `0007_conversation_assignment` created; Prisma client regenerated.

2. **Users module**
   - `UsersService.listActive()` returns active tenant users for the assignment dropdown.

3. **Inbox module** (`modules/inbox/`)
   - `InboxService`:
     - `listConversations`: paginated conversation list with latest-message preview, unread count (inbound messages since last outbound), client/case/assignee, and filters (state, unassigned, assigned-to-me, search).
     - `getConversation`: full message thread with sender names.
     - `assignConversation`: sets/unsets `assignedToId`.
     - `transitionState`: moves conversation between `AI_ACTIVE`, `HUMAN_REQUIRED`, `HUMAN_ACTIVE`, `CLOSED`.
     - `reply`: validates sender, maps role to `LAWYER`/`STAFF`, and reuses `SendService.send` so the 24h window rule is enforced.
   - `InboxController` (`/v1/inbox`) protected by `AuthGuard`/`PermissionGuard` with permissions `inbox:read` / `inbox:write`.
   - `InboxModule.register(role)` imports `MessagesModule`, `UsersModule`, and `WhatsappModule.register(role)` to avoid circular dependencies.

4. **App wiring**
   - Registered `InboxModule` in `AppModule`.

### Frontend (`apps/web`)

1. **Schemas** (`src/lib/schemas/inbox.ts`)
   - Runtime-validated types for inbox summaries, messages, states, and assignees.

2. **Inbox page** (`/dashboard/inbox`)
   - Split-pane layout: conversation list on the left, detail on the right.
   - Filter tabs: All, AI active, Needs human, Human active, Unassigned, Mine, Closed.
   - Search by client name, phone, or message text.
   - Unread badge and 24h-window indicator.

3. **Components**
   - `ConversationList`: scrollable list with tabs + search.
   - `ConversationDetail`: message thread, state selector, reply composer.
   - Manual replies disabled when the 24h window is closed (template replies planned for Phase 12).

## Decisions (D-073…D-075)

- **D-073:** Inbox as a dedicated read/handoff module importing Messages, Users, and WhatsApp; avoids circular dependency and keeps send-path ownership in WhatsApp.
- **D-074:** Conversation assignment via `assignedToId` on `Conversation`; active-user list powers the assignment dropdown.
- **D-075:** Manual dashboard replies reuse `SendService.send` so the 24h window is enforced; out-of-window UI is blocked, template reply channel lands in Phase 12.

## Verification

- `npx tsc -p tsconfig.build.json --noEmit` — clean.
- `npx vitest run` — **22 test files, 76 tests pass**.
- `npx eslint "src/**/*.ts"` — clean.
- `npm run build` — API and web both build.

## Next

- Phase 12 (notification channels: web push, WhatsApp templates, digest emails) or Phase 13 (payments).
