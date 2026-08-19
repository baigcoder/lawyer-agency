#!/bin/sh
# Run Prisma migrations against the owner role before app/worker boots.
# This script is invoked by the production entrypoint / init container.
set -e

cd /app/apps/api

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Migrations complete."
