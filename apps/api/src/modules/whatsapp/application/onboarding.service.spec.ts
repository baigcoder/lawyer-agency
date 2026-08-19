import { describe, expect, it, vi } from 'vitest';
import { OnboardingService } from './onboarding.service';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import type { MetaOAuthClient, WhatsappAccountRepository } from './ports';
import type { TemplateSyncService } from './template-sync.service';
import type { WhatsappUpgradeService } from './whatsapp-upgrade.service';
import type { PilotApiService } from './pilot-api.service';

const MASTER_KEY = 'a'.repeat(64);

type TxMock = {
  whatsappAccount: {
    upsert: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  whatsappTemplate: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

function makeService(overrides: {
  appId?: string;
  redirectUri?: string;
  oauth?: Partial<MetaOAuthClient>;
  account?: Parameters<WhatsappAccountRepository['findByTenant']>[1];
  templates?: Array<{ status: string }>;
  approvedCount?: number;
  upgradeEnabled?: boolean;
} = {}) {
  const config = {
    get: (k: keyof Env) => {
      if (k === 'META_APP_ID') return overrides.appId ?? 'app-1';
      if (k === 'META_REDIRECT_URI') return overrides.redirectUri ?? 'https://example.com/cb';
      if (k === 'META_WEBHOOK_VERIFY_TOKEN') return 'verify-token';
      if (k === 'MASTER_ENCRYPTION_KEY') return MASTER_KEY;
      return undefined;
    },
  } as ConfigService<Env, true>;
  const crypto = new CryptoService(config);
  const oauth: MetaOAuthClient = {
    exchangeCode: vi.fn(async () => ({ accessToken: 'token-42' })),
    getWabaInfo: vi.fn(async () => ({ wabaId: 'waba-42', phoneNumberId: 'pn-42', displayPhoneNumber: '+923211112222' })),
    ...overrides.oauth,
  };
  const accounts: WhatsappAccountRepository = {
    findByTenant: vi.fn(async () => overrides.account ?? null),
    updateConnectionStage: vi.fn(),
  };

  const templates = overrides.templates ?? [
    { status: 'APPROVED' },
    { status: 'APPROVED' },
    { status: 'SUBMITTED' },
  ];
  const approvedCount = overrides.approvedCount ?? templates.filter((t) => t.status === 'APPROVED').length;
  const templateSync: TemplateSyncService = {
    syncFromMeta: vi.fn(),
    applyTemplateStatusUpdate: vi.fn(),
    seedDefaultTemplates: vi.fn(async () => ({ seeded: 8 })),
    // advanceConnectionStage mirrors the real one against the tx mock.
    advanceConnectionStage: vi.fn(async () =>
      approvedCount > 0 ? ('READY_TO_GO_LIVE' as const) : ('TEMPLATES_PENDING' as const),
    ),
  } as unknown as TemplateSyncService;

  const tx: TxMock = {
    whatsappAccount: {
      upsert: vi.fn(),
      findFirst: vi.fn(async () => ({ connectionStage: 'NUMBER_VERIFIED', verificationStatus: 'VERIFIED' })),
      updateMany: vi.fn(),
    },
    whatsappTemplate: {
      findMany: vi.fn(async () => templates),
      count: vi.fn(async () => overrides.approvedCount ?? templates.filter((t) => t.status === 'APPROVED').length),
    },
  };

  const txLog: unknown[] = [];
  const uow = {
    withTenant: vi.fn(async (_tenantId: string, fn: (tx: TxMock) => Promise<unknown>) => {
      txLog.push('tenant');
      return fn(tx);
    }),
    withPlatform: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      txLog.push('platform');
      return fn({ $executeRaw: vi.fn() });
    }),
  } as unknown as UnitOfWork;

  const upgrade: WhatsappUpgradeService = {
    status: vi.fn(async () => ({ enabled: overrides.upgradeEnabled ?? true, priceCents: 50000, currency: 'PKR' })),
    enable: vi.fn(),
    initiate: vi.fn(),
    complete: vi.fn(),
  } as unknown as WhatsappUpgradeService;

  const pilotApi: PilotApiService = {
    disconnect: vi.fn(async () => ({ status: 'DISCONNECTED' as const })),
  } as unknown as PilotApiService;

  return {
    service: new OnboardingService(config, uow, crypto, oauth, accounts, templateSync, upgrade, pilotApi),
    oauth,
    templateSync,
    uow,
    tx,
    txLog,
    config,
    pilotApi,
  };
}

describe('OnboardingService', () => {
  it('start returns app config when upgrade is enabled', async () => {
    const { service } = makeService({ appId: '123', redirectUri: 'https://wakeel.test/cb' });
    await expect(service.start('tenant-1')).resolves.toEqual({
      appId: '123',
      redirectUri: 'https://wakeel.test/cb',
      scopes: ['whatsapp_business_management', 'business_management'],
    });
  });

  it('start refuses when upgrade is not enabled', async () => {
    const { service } = makeService({ appId: '123', upgradeEnabled: false });
    await expect(service.start('tenant-1')).rejects.toMatchObject({ status: 403 });
  });

  it('complete exchanges code, writes account + route, and seeds templates', async () => {
    const { service, oauth, templateSync } = makeService();
    const result = await service.complete('tenant-1', 'auth-code');

    expect(oauth.exchangeCode).toHaveBeenCalledWith('auth-code');
    expect(oauth.getWabaInfo).toHaveBeenCalledWith('token-42');
    expect(templateSync.seedDefaultTemplates).toHaveBeenCalledWith('tenant-1');
    expect(result).toMatchObject({
      tenantId: 'tenant-1',
      wabaId: 'waba-42',
      phoneNumberId: 'pn-42',
      displayPhoneNumber: '+923211112222',
      templatesSeeded: 8,
    });
  });

  it('complete advances to READY_TO_GO_LIVE when an approved template exists', async () => {
    const { service } = makeService({ templates: [{ status: 'APPROVED' }] });
    const result = await service.complete('tenant-1', 'auth-code');
    expect(result.connectionStage).toBe('READY_TO_GO_LIVE');
  });

  it('complete stays TEMPLATES_PENDING without approved templates', async () => {
    const { service } = makeService({ templates: [{ status: 'SUBMITTED' }] });
    const result = await service.complete('tenant-1', 'auth-code');
    expect(result.connectionStage).toBe('TEMPLATES_PENDING');
  });

  it('complete refuses when upgrade is not enabled', async () => {
    const { service } = makeService({ upgradeEnabled: false });
    await expect(service.complete('tenant-1', 'auth-code')).rejects.toMatchObject({ status: 403 });
  });

  it('goLive flips LIVE from READY_TO_GO_LIVE with approved templates and disconnects pilot', async () => {
    const { service, tx, pilotApi } = makeService();
    tx.whatsappAccount.findFirst.mockResolvedValue({ connectionStage: 'READY_TO_GO_LIVE', verificationStatus: 'VERIFIED' });
    const result = await service.goLive('tenant-1');
    expect(result).toEqual({ connectionStage: 'LIVE' });
    expect(tx.whatsappAccount.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { connectionStage: 'LIVE' } }),
    );
    expect(pilotApi.disconnect).toHaveBeenCalledWith('tenant-1');
  });

  it('goLive refuses from a non-READY stage (ConflictException)', async () => {
    const { service, tx } = makeService();
    tx.whatsappAccount.findFirst.mockResolvedValue({ connectionStage: 'TEMPLATES_PENDING', verificationStatus: 'VERIFIED' });
    await expect(service.goLive('tenant-1')).rejects.toMatchObject({ status: 409 });
  });

  it('goLive refuses without approved templates even from READY stage', async () => {
    const { service, tx } = makeService({ approvedCount: 0 });
    tx.whatsappAccount.findFirst.mockResolvedValue({ connectionStage: 'READY_TO_GO_LIVE', verificationStatus: 'VERIFIED' });
    await expect(service.goLive('tenant-1')).rejects.toMatchObject({ status: 409 });
  });

  it('goLive 404s when no account exists', async () => {
    const { service, tx } = makeService();
    tx.whatsappAccount.findFirst.mockResolvedValue(null);
    await expect(service.goLive('tenant-1')).rejects.toMatchObject({ status: 404 });
  });

  it('disconnect clears the token and marks DISCONNECTED', async () => {
    const { service, tx } = makeService();
    tx.whatsappAccount.findFirst.mockResolvedValue({ connectionStage: 'LIVE' });
    const result = await service.disconnect('tenant-1');
    expect(result).toEqual({ connectionStage: 'DISCONNECTED' });
    expect(tx.whatsappAccount.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      data: { connectionStage: 'DISCONNECTED', accessTokenEnc: null },
    });
  });

  it('health reports stage, webhook wiring, and go-live checklist', async () => {
    const { service, tx } = makeService();
    tx.whatsappAccount.findFirst.mockResolvedValue({
      wabaId: 'waba-42',
      displayPhoneNumber: '+923211112222',
      verificationStatus: 'VERIFIED',
      connectionStage: 'READY_TO_GO_LIVE',
    });
    const health = await service.health('tenant-1');
    expect(health).toMatchObject({
      connectionStage: 'READY_TO_GO_LIVE',
      verificationStatus: 'VERIFIED',
      displayPhoneNumber: '+923211112222',
      webhookConfigured: true,
      webhookVerifyTokenPresent: true,
      goLiveChecklist: {
        accountConnected: true,
        numberVerified: true,
        hasApprovedTemplates: true,
        readyForGoLive: true,
      },
      templates: { approved: 2, pending: 1, rejected: 0, paused: 0 },
    });
  });

  it('connectionStatus defaults to OFFICIAL_CONNECT_STARTED with no account', async () => {
    const { service, tx } = makeService();
    tx.whatsappAccount.findFirst.mockResolvedValue(null);
    const status = await service.connectionStatus('tenant-1');
    expect(status).toMatchObject({
      connected: false,
      connectionStage: 'OFFICIAL_CONNECT_STARTED',
      verificationStatus: 'NOT_STARTED',
    });
  });
});
