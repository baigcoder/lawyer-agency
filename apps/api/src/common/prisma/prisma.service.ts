import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import type { Env } from '../../config/env';

/**
 * Single PrismaClient for the process, connecting as non-owner `app_user`
 * (DATABASE_URL) through the pg driver adapter (Prisma 7, D-026). All tenant
 * data access flows through UnitOfWork so the RLS GUC is always set — this
 * service is the connection, not the access pattern.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(config: ConfigService<Env, true>) {
    const adapter = new PrismaPg({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      // modest per-process pool; PgBouncer fronts this in production (Phase 15)
      max: 20,
    });
    this.client = new PrismaClient({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
