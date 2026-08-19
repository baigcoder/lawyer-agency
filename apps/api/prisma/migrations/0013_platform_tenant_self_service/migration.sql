-- 0013_platform_tenant_self_service — firm provisioning & principal resolution
-- need to create/read the owning tenant row before any app.tenant_id exists.
--
-- Extends the GUC-keyed fail-closed pattern (D-020) with `app.clerk_org_id`:
--   - SELECT/INSERT on platform.tenants are only allowed for the row whose
--     clerkOrgId equals the transaction GUC (set by UnitOfWork.withOrgContext).
--   - UPDATE of a tenant row requires the owning app.tenant_id GUC, exactly
--     like the existing tenant_self_read SELECT policy.
--   - platform.permissions (platform catalog, no RLS) gains INSERT/UPDATE so
--     provisioning can seed the `*` permission and ensureSystemRoles can
--     create catalog entries.

GRANT INSERT, UPDATE ON platform.tenants TO app_user;

-- Principal resolution: map verified Clerk org -> tenant row (clerkOrgId GUC).
CREATE POLICY tenant_org_select ON platform.tenants
  FOR SELECT TO app_user
  USING ("clerkOrgId" = NULLIF(current_setting('app.clerk_org_id', true), ''));

-- Firm provisioning: a verified org may create exactly its own tenant row.
CREATE POLICY tenant_org_insert ON platform.tenants
  FOR INSERT TO app_user
  WITH CHECK ("clerkOrgId" = NULLIF(current_setting('app.clerk_org_id', true), ''));

-- Firm profile updates happen inside withTenant: own row only.
CREATE POLICY tenant_self_update ON platform.tenants
  FOR UPDATE TO app_user
  USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Provisioning seeds the permission catalog (upsert of code '*').
GRANT INSERT, UPDATE ON platform.permissions TO app_user;
