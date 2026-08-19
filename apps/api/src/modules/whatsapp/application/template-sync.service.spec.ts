import { describe, expect, it, vi } from 'vitest';
import { TemplateSyncService } from './template-sync.service';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type {
  ConnectionStage,
  MetaCloudApi,
  WhatsappAccountRepository,
  WhatsappTemplateRepository,
} from './ports';

const MASTER_KEY = 'a'.repeat(64);

function makeService(overrides: {
  account?: { connectionStage?: ConnectionStage } | null;
  templates?: MetaCloudApi['listTemplates'];
  approvedCount?: number;
} = {}) {
  // Use the real CryptoService so encrypt/decrypt round-trips.
  const realConfig = { get: (k: string) => (k === 'MASTER_ENCRYPTION_KEY' ? MASTER_KEY : undefined) } as never;
  const crypto = new CryptoService(realConfig);

  const accounts: WhatsappAccountRepository = {
    findByTenant: vi.fn(async () =>
      overrides.account === null
        ? null
        : {
            tenantId: 'tenant-1',
            wabaId: 'waba-1',
            phoneNumberId: 'pn-1',
            accessTokenEnc: crypto.encrypt('tok-1'),
            connectionStage: overrides.account?.connectionStage ?? 'NUMBER_VERIFIED',
          },
    ),
    updateConnectionStage: vi.fn(async () => {}),
  };
  const templates: WhatsappTemplateRepository = {
    findByNameAndLanguage: vi.fn(async () => null),
    countApproved: vi.fn(async () => overrides.approvedCount ?? 0),
    upsert: vi.fn(async () => {}),
    updateStatusByMetaId: vi.fn(async () => true),
  };
  const meta: MetaCloudApi = {
    postMessage: vi.fn(),
    listTemplates: overrides.templates ?? vi.fn(async () => []),
    downloadMedia: vi.fn(),
  };
  const uow = {
    withTenant: vi.fn(async (tenantId: string, fn: (tx: unknown) => Promise<unknown>) => fn({})),
  } as unknown as UnitOfWork;

  return { service: new TemplateSyncService(uow, crypto, accounts, templates, meta), templates, meta, accounts };
}

describe('TemplateSyncService', () => {
  it('syncs templates returned by Meta', async () => {
    const { service, meta, templates } = makeService({
      approvedCount: 1,
      templates: vi.fn(async () => [
        {
          metaTemplateId: 'mt-1',
          name: 'wakeel_welcome',
          language: 'en',
          category: 'UTILITY',
          status: 'APPROVED',
          components: [{ type: 'BODY', text: 'Hello {{1}}' }],
        },
      ]),
    });
    const result = await service.syncFromMeta('tenant-1');
    expect(result.synced).toBe(1);
    expect(meta.listTemplates).toHaveBeenCalledWith({ accessToken: 'tok-1', wabaId: 'waba-1' });
    expect(templates.upsert).toHaveBeenCalledTimes(1);
  });

  it('seeds default templates only when missing', async () => {
    const { service, templates } = makeService();
    const result = await service.seedDefaultTemplates('tenant-1');
    expect(result.seeded).toBe(8);
    expect(templates.upsert).toHaveBeenCalledTimes(8);
  });

  it('skips existing templates when seeding', async () => {
    const { service, templates } = makeService();
    (templates.findByNameAndLanguage as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 'x', status: 'DRAFT' });
    const result = await service.seedDefaultTemplates('tenant-1');
    expect(result.seeded).toBe(7);
  });

  it('applies template status updates', async () => {
    const { service, templates } = makeService();
    const updated = await service.applyTemplateStatusUpdate('tenant-1', {
      metaTemplateId: 'mt-1',
      status: 'REJECTED',
      rejectionReason: 'policy violation',
    });
    expect(updated).toBe(true);
    expect(templates.updateStatusByMetaId).toHaveBeenCalledWith({}, 'tenant-1', 'mt-1', 'REJECTED', 'policy violation');
  });

  it('B1: a webhook approval advances the stage to READY_TO_GO_LIVE', async () => {
    const { service, accounts, templates } = makeService({ approvedCount: 1 });
    const updated = await service.applyTemplateStatusUpdate('tenant-1', {
      metaTemplateId: 'mt-1',
      status: 'APPROVED',
    });
    expect(updated).toBe(true);
    expect(templates.countApproved).toHaveBeenCalled();
    expect(accounts.updateConnectionStage).toHaveBeenCalledWith({}, 'tenant-1', 'READY_TO_GO_LIVE');
  });

  it('B1: a sync with zero approved templates lands TEMPLATES_PENDING', async () => {
    const { service, accounts } = makeService({ approvedCount: 0 });
    await service.syncFromMeta('tenant-1');
    expect(accounts.updateConnectionStage).toHaveBeenCalledWith({}, 'tenant-1', 'TEMPLATES_PENDING');
  });

  it('B1: settled stages (LIVE) are never moved by template events', async () => {
    const { service, accounts } = makeService({ account: { connectionStage: 'LIVE' }, approvedCount: 0 });
    await service.syncFromMeta('tenant-1');
    expect(accounts.updateConnectionStage).not.toHaveBeenCalled();
  });

  it('B1: no account means no stage write (sync without onboarding)', async () => {
    const { service, accounts } = makeService({ account: null });
    const stage = await service.syncFromMeta('tenant-1').catch(() => 'credentials-missing');
    // No Meta credentials → TenantCredentialsMissingError, stage untouched.
    expect(stage).toBe('credentials-missing');
    expect(accounts.updateConnectionStage).not.toHaveBeenCalled();
  });
});
