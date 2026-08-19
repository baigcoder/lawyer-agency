# Phase 10 — Authentication & Authorization

**Goal:** Replace the tenant-header dev seam with Clerk JWT verification, resolve the authenticated principal (tenant + user + role + permissions), and enforce RBAC on dashboard API endpoints.

## What was built

### Backend (`apps/api`)

1. **Clerk JWT verification** (`modules/auth/infrastructure/clerk.verifier.ts`)
   - Uses `@clerk/backend` `verifyToken()` against the configured `CLERK_JWKS_URL`.
   - Extracts `sub` → `clerkUserId`, `org_id` → `clerkOrgId`, plus email/name claims.

2. **Auth application service** (`modules/auth/application/auth.service.ts`)
   - Maps `clerkOrgId` → `Tenant` via the new `tenant.clerkOrgId` column.
   - Lazily seeds system roles (`Admin`, `Lawyer`, `Staff`) and permissions on first login.
   - Creates a local `User` record on first login, assigning the `Staff` role by default.
   - Rejects unknown orgs, missing org context, and inactive users.

3. **Auth guard** (`common/auth/auth.guard.ts`, replaces `TenantGuard`)
   - **Production mode** (`CLERK_JWKS_URL` set): verifies `Authorization: Bearer <jwt>`, resolves principal.
   - **Dev seam** (no Clerk keys): validates `x-tenant-id` (UUID) and optional `x-user-id`.
   - Writes `tenantId` (and `userId` when known) into the request-scoped `RequestContextStore`.

4. **RBAC guards / decorators**
   - `@RequirePermission(...permissions)` — OR semantics within the decorator.
   - `PermissionGuard` — checks principal permissions; wildcard `*` grants everything; dev seam bypasses.
   - `CurrentUser` decorator — resolves the full `RequestPrincipal` in handlers.

5. **Protected controllers**
   - `CasesController`, `KnowledgeBaseController`, `NotificationsController`, `WhatsappOnboardingController`, `WhatsappTemplatesController` now use `@UseGuards(AuthGuard, PermissionGuard)` and appropriate `@RequirePermission()` decorators.
   - `WhatsappWebhookController` remains unguarded — HMAC signature is its authentication.

6. **Schema / migration**
   - Added `Tenant.clerkOrgId` unique nullable column.
   - Migration `0006_tenant_clerk_org` created.
   - Prisma client regenerated.

### Frontend (`apps/web`)

- Updated `src/proxy.ts`:
  - In Clerk mode, attaches the Clerk session token as `Authorization: Bearer <token>` for `/backend/*` rewrites.
  - In dev seam mode, forwards `NEXT_PUBLIC_DEV_TENANT_ID` and `NEXT_PUBLIC_DEV_USER_ID` as `x-tenant-id` / `x-user-id` headers.

## Decisions (D-070…D-072)

- **D-070:** Clerk JWT verification via `@clerk/backend`; `AuthGuard` replaces `TenantGuard`; dev seam fallback; `tenant.clerkOrgId` org mapping; lazy user/role provisioning.
- **D-071:** RBAC via `PermissionGuard` + `@RequirePermission()`; OR semantics; wildcard `*`; dev seam bypass.
- **D-072:** Frontend proxy forwards Clerk token (or dev headers) for `/backend/*`; no CORS.

## Verification

- `npx tsc -p tsconfig.build.json --noEmit` — clean.
- `npx vitest run` — **21 test files, 69 tests pass**.
- `npx eslint "src/**/*.ts"` — clean.
- `npm run build` — API and web both build.

## Next

- Phase 11 (dashboard inbox/assignment UX) or Phase 12 (notification channels: web push, WhatsApp templates, digest emails).
