import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Liveness is dependency-free (load balancers poll it); readiness checks the
 * database because an API without its RLS-enforcing datastore must not serve.
 * Excluded from the /v1 global prefix and from request auto-logging.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  liveness() {
    return {
      status: 'ok',
      role: this.config.get('API_ROLE', { infer: true }),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  @Get('ready')
  async readiness() {
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        statusCode: 503,
        message: 'database unreachable',
      });
    }
    return { status: 'ready', db: 'up' };
  }
}
