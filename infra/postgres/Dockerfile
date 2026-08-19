FROM pgvector/pgvector:pg16

# Bootstrap script run once by the upstream entrypoint when the data directory
# is first initialized (local dev only; production provisions equivalently).
COPY init.sql /docker-entrypoint-initdb.d/

# Dev seam tenant seed (D-037). The `.seed` extension prevents the upstream
# entrypoint from auto-executing it; the compose `seed` service runs it after
# migrations complete.
COPY seed-dev-tenant.sql.seed /seed.sql.seed
