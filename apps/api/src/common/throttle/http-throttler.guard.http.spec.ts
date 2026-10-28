import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Controller, Get, Module, type INestApplication } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { SkipThrottle, ThrottlerModule } from '@nestjs/throttler';
import { HttpThrottlerGuard } from './http-throttler.guard';

@Controller('things')
class ThingsController {
  @Get()
  list() {
    return { ok: true };
  }
}

@SkipThrottle()
@Controller('webhooks')
class WebhookController {
  @Get()
  inbound() {
    return { received: true };
  }
}

@Module({
  imports: [ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 3 }] })],
  controllers: [ThingsController, WebhookController],
  providers: [{ provide: APP_GUARD, useClass: HttpThrottlerGuard }],
})
class TestModule {}

function bearer(sub: string): string {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `Bearer ${part({ alg: 'RS256' })}.${part({ sub })}.sig`;
}

describe('HttpThrottlerGuard over HTTP', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    app = await NestFactory.create(TestModule, { logger: false });
    await app.listen(0);
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  const hit = (path: string, headers: Record<string, string>) =>
    fetch(`${base.replace('[::1]', 'localhost')}${path}`, { headers }).then((r) => r.status);

  it('returns 429 once a user passes the limit, without affecting other users on the same IP', async () => {
    const sameProxy = { 'x-real-ip': '76.76.21.1' };
    const alice = { ...sameProxy, authorization: bearer('user_alice') };
    const bob = { ...sameProxy, authorization: bearer('user_bob') };

    const aliceStatuses = [];
    for (let i = 0; i < 4; i++) aliceStatuses.push(await hit('/things', alice));
    expect(aliceStatuses).toEqual([200, 200, 200, 429]);
    expect(await hit('/things', bob)).toBe(200);
  });

  it('never throttles routes marked @SkipThrottle (webhooks, health)', async () => {
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push(await hit('/webhooks', { 'x-real-ip': '10.1.1.1' }));
    expect(statuses.every((s) => s === 200)).toBe(true);
  });
});
