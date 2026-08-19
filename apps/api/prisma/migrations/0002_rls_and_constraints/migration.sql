-- 0002_rls_and_constraints — the isolation layer (D-001 / ADR-002).
-- Everything here is what Prisma cannot express: roles, grants, Row-Level
-- Security with FORCE, the appointment exclusion constraint, append-only
-- audit logs, and the payments idempotency index.
--
-- Applied by `prisma migrate deploy` running as the database owner.
-- The migration role MUST hold BYPASSRLS (or be superuser): FORCE RLS binds
-- even the owner, and future data migrations would otherwise fail closed.

-- ---------------------------------------------------------------------------
-- 1. Application role: non-owner, no bypass. All request/worker traffic.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'change-me' NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA app TO app_user;
GRANT USAGE ON SCHEMA platform TO app_user;

-- Tenant-owned tables: full DML (RLS decides which rows exist for the role).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA app
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- Platform schema: deliberately narrow. app_user reads its own tenant row
-- (RLS below), the permission catalog, and the prompt registry; it writes to
-- the webhook inbox and outbox (infrastructure tables, no RLS — they are the
-- pipes, not the data). No app_user access to platform_users by default.
GRANT SELECT ON platform.tenants TO app_user;
GRANT SELECT ON platform.permissions TO app_user;
GRANT SELECT ON platform.prompt_versions TO app_user;
GRANT SELECT, INSERT, UPDATE ON platform.webhook_events TO app_user;
GRANT SELECT, INSERT, UPDATE ON platform.outbox_events TO app_user;

-- ---------------------------------------------------------------------------
-- 2. RLS on every tenant-owned table in `app`.
--    Fail-closed: if app.tenant_id is unset/empty, NULLIF yields NULL,
--    the comparison is never true, and zero rows are visible.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  policy_expr text := '("tenantId") = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid';
  tables text[] := ARRAY[
    'roles', 'role_permissions', 'users', 'lawyers', 'lawyer_availability',
    'clients', 'cases', 'case_lawyers', 'conversations', 'messages',
    'intake_sessions', 'escalations', 'documents', 'document_requests',
    'appointments', 'payments', 'notifications', 'audit_logs', 'ai_logs',
    'prompt_logs', 'knowledge_base', 'kb_chunks', 'whatsapp_accounts',
    'whatsapp_templates'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON app.%I USING (%s) WITH CHECK (%s)', t, policy_expr, policy_expr);
  END LOOP;
END $$;

-- Tenants table: a tenant may read its own row only (settings, allow-list).
ALTER TABLE platform.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_self_read ON platform.tenants
  FOR SELECT
  USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- 3. Append-only audit (FR-AUD-01): INSERT and SELECT, never UPDATE/DELETE.
-- ---------------------------------------------------------------------------
REVOKE UPDATE, DELETE ON app.audit_logs FROM app_user;

-- ---------------------------------------------------------------------------
-- 4. FR-APT-04: no double-booking — enforced by the database, not app code.
-- ---------------------------------------------------------------------------
ALTER TABLE app.appointments
  ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    "lawyerId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE (status IN ('PENDING', 'CONFIRMED'));

-- ---------------------------------------------------------------------------
-- 5. FR-PAY-02: rail webhook idempotency — one row per (tenant, provider txn).
--    Partial index so manual payments (NULL providerTxnId) are unconstrained.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX payments_provider_txn_uniq
  ON app.payments ("tenantId", "providerTxnId")
  WHERE "providerTxnId" IS NOT NULL;

-- Unread-notification inbox query (hottest notification read).
CREATE INDEX notifications_unread_idx
  ON app.notifications ("tenantId", "userId")
  WHERE "readAt" IS NULL;

-- Open-escalation ops query (SLA dashboard, escalation worker).
CREATE INDEX escalations_open_idx
  ON app.escalations ("tenantId", "slaDeadline")
  WHERE status = 'OPEN';
