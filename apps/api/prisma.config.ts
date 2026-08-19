import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 config. Migrations run as the database OWNER (MIGRATION_DATABASE_URL)
// because RLS is FORCEd even for table owners' policies to bind — the owner
// applies DDL, the app connects separately as non-owner `app_user` (ADR-002).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('MIGRATION_DATABASE_URL'),
    shadowDatabaseUrl: env('SHADOW_DATABASE_URL'),
  },
});
