# Wakeel — Row-Level Security (RLS) Security Model

**Status:** IMPLEMENTED BASELINE & SECURITY POLICY  
**Classification:** Database Tenancy Enforcement, Role Isolation, and RLS Mechanics  
**Cross-References:** `apps/api/src/common/prisma/unit-of-work.ts`, `apps/api/prisma/migrations/0002_rls_and_constraints/migration.sql`  

---

## 1. Engine-Enforced Tenancy Architecture

In Wakeel, tenant isolation is guaranteed at the database engine level by PostgreSQL. It does not rely on application-level developers remembering to add `WHERE tenant_id = ...`:

```text
Incoming Request ──► UnitOfWork.withTenant(tenantId, fn)
                          │
                          ▼
             BEGIN TRANSACTION;
             SELECT set_config('app.tenant_id', '1234...', true);
                          │
                          ▼
             SELECT * FROM app.cases;  <── RLS Policy Enforced by PostgreSQL Engine!
                          │
                          ▼
             COMMIT;
```

---

## 2. PostgreSQL Role Partitioning

| Role Name | Privileges | Bypass RLS? | Operational Usage |
|---|---|:---:|---|
| **`postgres`** | Superuser / Owner | `BYPASSRLS` | Runs `prisma migrate deploy` and database schema updates. |
| **`app_user`** | Non-owner application role | **`NOBYPASSRLS`** | All API traffic, background workers, and voice runtime connections. |

The application connection string (`DATABASE_URL`) connects strictly as `app_user`. Because `app_user` holds `NOBYPASSRLS`, PostgreSQL enforces RLS checks on every single query without exception.

---

## 3. Policy Definition & Fail-Closed Behavior

Applied across all tables in schema `app` in migration `0002`:

```sql
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
    'whatsapp_templates', 'court_hearings', 'conversation_notes'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON app.%I USING (%s) WITH CHECK (%s)', t, policy_expr, policy_expr);
  END LOOP;
END $$;
```

### Fail-Closed Mechanics
1. **Unset Session Setting:** If `app.tenant_id` is empty or unset, `NULLIF('', '')` resolves to `NULL`.
2. **Comparison Evaluation:** `"tenantId" = NULL` evaluates to `UNKNOWN` in SQL 3-valued logic.
3. **Zero Visible Rows:** The query returns 0 rows and rejects any `INSERT` or `UPDATE` operation. Leaking data across tenants is mathematically impossible under this policy.

---

## 4. Organization Context GUC (`app.clerk_org_id`, D-090)

During pre-tenant operations (e.g., initial user provisioning and onboarding status checks before a tenant UUID is assigned):
- `UnitOfWork.withOrgContext(clerkOrgId, fn)` sets `app.clerk_org_id`.
- Policies on `platform.tenants` allow the user to read or create exactly their own firm's tenant row matching their verified Clerk organization ID.
