import { describe, expect, it, vi } from 'vitest';
import { FirmProfileService } from './firm-profile.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { defaultAiSettings } from './ai-settings.dto';

describe('FirmProfileService AI settings', () => {
  it('round-trips ai settings in tenant.settings JSON', async () => {
    let storedSettings: Record<string, unknown> = { displayName: 'Test Firm' };
    const tx = {
      tenant: {
        findUnique: vi.fn(async () => ({ settings: storedSettings, name: 'Test Firm' })),
        update: vi.fn(async ({ data }: { data: { settings: unknown } }) => {
          storedSettings = data.settings as Record<string, unknown>;
          return {};
        }),
      },
    };
    const uow = {
      withTenant: vi.fn(async (_tenantId: string, fn: (inner: unknown) => Promise<unknown>) => fn(tx)),
    } as unknown as UnitOfWork;

    const service = new FirmProfileService(uow);
    const input = {
      ...defaultAiSettings(),
      aiAutoReplyEnabled: false,
      aiTone: 'formal' as const,
      aiCustomInstructions: 'Always mention office hours.',
    };

    const saved = await service.setAiSettings('t1', input);
    expect(saved.aiAutoReplyEnabled).toBe(false);
    expect(saved.aiTone).toBe('formal');

    const loaded = await service.getAiSettings('t1');
    expect(loaded).toEqual(input);
  });
});
