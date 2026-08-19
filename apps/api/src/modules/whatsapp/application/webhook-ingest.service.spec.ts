import { describe, expect, it, vi } from 'vitest';
import { WebhookIngestService } from './webhook-ingest.service';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { Queue } from 'bullmq';
import type { WaRouteLookup } from './ports';
import { TemplateSyncService } from './template-sync.service';

function fakeQueue(): Queue {
  return { add: vi.fn() } as unknown as Queue;
}

const MASTER_KEY = 'a'.repeat(64);

function makeService(overrides: { appSecret?: string; routes?: WaRouteLookup } = {}) {
  const config = {
    get: (k: keyof Env) => {
      if (k === 'META_APP_SECRET') return overrides.appSecret ?? 'secret';
      if (k === 'MASTER_ENCRYPTION_KEY') return MASTER_KEY;
      return undefined;
    },
  } as ConfigService<Env, true>;
  const crypto = new CryptoService(config);
  const uow = { withPlatform: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})) } as unknown as UnitOfWork;
  const templateSync = { applyTemplateStatusUpdate: vi.fn() } as unknown as TemplateSyncService;
  const service = new WebhookIngestService(
    config,
    crypto,
    uow,
    overrides.routes ?? ({ findByPhoneNumberId: vi.fn() } as unknown as WaRouteLookup),
    fakeQueue(),
    fakeQueue(),
    templateSync,
  );
  return { service, templateSync };
}

describe('WebhookIngestService.trimProcessedPayloads', () => {
  it('returns the count of rows updated by the platform tx', async () => {
    const { service } = makeService();
    const tx = { $executeRaw: vi.fn().mockResolvedValue(7) } as unknown as Record<string, unknown>;
    (service as unknown as { uow: UnitOfWork }).uow = {
      withPlatform: async (fn: (tx: unknown) => Promise<unknown>) => fn(tx),
    } as unknown as UnitOfWork;

    const count = await service.trimProcessedPayloads(24);
    expect(count).toBe(7);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
