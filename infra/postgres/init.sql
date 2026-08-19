-- Bootstrap for the dev container. Production provisions equivalently via
-- the deployment pipeline (Phase 15). Idempotent by design.

-- Extensions required by the schema:
--   vector      -> pgvector for RAG embeddings (FR-KB-02)
--   btree_gist  -> exclusion constraint preventing double-booking (FR-APT-04)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Schemas: `platform` = cross-tenant infrastructure (tenant registry, webhook
-- inbox, outbox, prompt registry); `app` = tenant-owned, RLS-enforced (D-001).
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS platform;

-- Application role: NON-OWNER, no RLS bypass. All request/worker-scoped
-- queries run as this role so `FORCE ROW LEVEL SECURITY` actually binds.
-- Migrations run as the database owner (postgres here) — never as app_user.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'change-me' NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA app TO app_user;
GRANT USAGE ON SCHEMA platform TO app_user;
-- Table-level grants are applied in migration 0002 (after tables exist).
