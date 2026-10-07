# Wakeel — Backend Authorization Model & RBAC

**Status:** IMPLEMENTED BASELINE & RBAC SPECIFICATION  
**Classification:** Authentication Verification, Local RBAC, and Guard Architecture  
**Source Code References:** `apps/api/src/common/auth/permission.guard.ts`, `apps/api/src/common/auth/require-permission.decorator.ts`, `apps/api/src/modules/auth/`  

---

## 1. Authentication Layer (Clerk v7 JWKS Verification)

1. **Incoming Request:** The browser proxy attaches the verified Clerk session token in the `Authorization: Bearer <token>` header.
2. **`AuthGuard`:** Verifies the JWT signature against Clerk's public JWKS endpoints (`@clerk/backend`).
3. **Principal Resolution:** Extracts user ID (`sub`) and organization ID (`o.id`). Matches `tenant.clerkOrgId` in `platform.tenants` to resolve the internal `tenantId`.
4. **Lazy User Provisioning:** If the user is logging in for the first time, `AuthService` lazily provisions the user in `app.users` under the active tenant, assigning the appropriate role.

---

## 2. Local RBAC Engine & `@RequirePermission`

Authorization is decoupled from external identity providers. Permissions are checked locally against `app.role_permissions`:

```typescript
@Controller('cases')
@UseGuards(AuthGuard, PermissionGuard)
export class CasesController {
  @Get()
  @RequirePermission('cases:read')
  async listCases(@CurrentUser() user: RequestUser) {
    // ...
  }

  @Post(':id/status')
  @RequirePermission('cases:write')
  async updateStatus() {
    // ...
  }
}
```

### Permission Guard Mechanics (`PermissionGuard`)
- Reads metadata set by `@RequirePermission()`.
- Resolves caller roles and assigned permission strings.
- Supports **OR semantics**: `@RequirePermission('users:manage', 'lawyers:write')` grants access if the user holds *either* permission.
- **Wildcard Super-Admin:** The `*` wildcard grants universal access.
- In-memory 60-second caching prevents repetitive database queries for user permissions during high-frequency requests.

---

## 3. Dev Seam Authorization Fallback (D-037, D-071)

When running locally without Clerk keys:
- `AuthGuard` detects dev mode and extracts `x-tenant-id` and `x-user-id` headers.
- `PermissionGuard` bypasses permission checks in development when Clerk is disabled, granting full access for local automated tests and offline development.
