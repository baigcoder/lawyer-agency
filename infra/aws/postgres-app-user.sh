#!/bin/sh
# First-boot only (docker-entrypoint-initdb.d, after init.sql): replace the
# dev password init.sql gives app_user with APP_USER_PASSWORD.
set -e

: "${APP_USER_PASSWORD:?APP_USER_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 -v pw="$APP_USER_PASSWORD" \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
ALTER ROLE app_user PASSWORD :'pw';
SQL
