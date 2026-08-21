import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { Env } from './config/env';

/**
 * One image, three roles (D-013 / D-124):
 *   role=api    — HTTP server (REST /v1 + webhooks)
 *   role=worker — BullMQ consumers (agents, OCR, reminders, outbox dispatcher)
 *   role=voice  — live WhatsApp Cloud Calling receptionist (WebRTC + tools)
 * All boot the same AppModule so domain code never drifts; only the edge
 * differs.
 */
async function bootstrap(): Promise<void> {
  // rawBody: HMAC webhook verification needs the exact bytes Meta signed.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  // Graceful shutdown can hang if a dependency is already dead (observed:
  // BullMQ's queue.close() blocks when Redis is unreachable, holding the
  // port and wedging rollouts). Force-exit after a bounded drain window.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      setTimeout(() => {
        process.stderr.write(`shutdown drain exceeded 10s on ${signal} — forcing exit\n`);
        process.exit(1);
      }, 10_000).unref();
    });
  }

  const config = app.get(ConfigService<Env, true>);
  const role = config.get('API_ROLE', { infer: true });
  const logger = app.get(Logger);

  if (role === 'worker' || role === 'voice') {
    // No HTTP listener. Initialize modules so lifecycle hooks
    // (onModuleInit) register BullMQ workers; PrismaService's pg pool keeps
    // the event loop alive. Draining on SIGTERM via enableShutdownHooks.
    await app.init();
    logger.log(`${role} role started — queue consumers attached`);
    return;
  }

  app.setGlobalPrefix('v1', { exclude: ['health', 'health/ready'] });
  // Dashboard client always expects JSON bodies; Express ETag 304 responses
  // return empty bodies and break fetch().json() + zod validation.
  app.getHttpAdapter().getInstance().set('etag', false);
  // CORS, helmet, and rate limiting are configured in Phase 18 hardening —
  // the dashboard origin is not yet defined (Phase 5).

  const port = config.get('API_PORT', { infer: true });
  await app.listen(port);
  logger.log(`api role listening on :${port}`);
}

void bootstrap();
