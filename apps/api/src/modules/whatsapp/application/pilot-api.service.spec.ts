import { describe, expect, it, vi } from 'vitest';
import { PilotApiService } from './pilot-api.service';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import type { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { Queue } from 'bullmq';
import type { PilotSessionRepository } from './ports';
import type { MessagesService } from '../../messages/application/messages.service';

const TENANT = '11111111-1111-1111-1111-111111111111';

function makeService(overrides: {
  session?: { status: string; allowlist: Array<{ number: string; label: string | null }> } | null;
} = {}) {
  const config = {
    get: (k: keyof Env) =>
      ({ PILOT_BRIDGE_ENABLED: 'true', PILOT_QR_TTL_MINUTES: '5', PILOT_MAX_ALLOWLIST: 25 }[k]),
  } as ConfigService<Env, true>;

  const session = overrides.session ?? { status: 'PAIRED', allowlist: [{ number: '923001234567', label: null }] };

  const pilots: PilotSessionRepository = {
    findByTenant: vi.fn(async () => session),
    upsert: vi.fn(),
  } as unknown as PilotSessionRepository;

  const uow = {
    withTenant: vi.fn(async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) => fn({})),
    withPlatform: vi.fn(),
  } as unknown as UnitOfWork;

  const pilotQueue = { add: vi.fn(), getJob: vi.fn(), opts: { connection: {} } } as unknown as Queue;

  const messages: MessagesService = {
    recordInbound: vi.fn(async () => ({ conversationId: 'conv-1', messageId: 'msg-1', duplicate: false })),
  } as unknown as MessagesService;

  return {
    service: new PilotApiService(uow, config, pilots, pilotQueue, messages),
    pilots,
    messages,
  };
}

describe('PilotApiService.testInbound', () => {
  it('records an inbound message for an allowlisted number', async () => {
    const { service, messages } = makeService();
    const result = await service.testInbound(TENANT, { fromWaPhone: '923001234567', body: 'Hello AI' });
    expect(result).toEqual({ conversationId: 'conv-1', messageId: 'msg-1' });
    expect(messages.recordInbound).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({
        fromWaPhone: '923001234567',
        body: 'Hello AI',
        contentType: 'TEXT',
      }),
    );
  });

  it('refuses when pilot is not paired', async () => {
    const { service } = makeService({ session: { status: 'PAIRING', allowlist: [{ number: '923001234567', label: null }] } });
    await expect(service.testInbound(TENANT, { fromWaPhone: '923001234567', body: 'Hello' })).rejects.toMatchObject({ status: 404 });
  });

  it('refuses when number is not in allowlist', async () => {
    const { service } = makeService();
    await expect(service.testInbound(TENANT, { fromWaPhone: '924000000000', body: 'Hello' })).rejects.toMatchObject({ httpStatus: 422 });
  });
});
