import { describe, expect, it, vi } from 'vitest';
import { PakistanKbSeedService } from './pakistan-kb-seed.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { PAKISTAN_LAWYER_KNOWLEDGE, PAKISTAN_PROCESS_CATEGORY } from './pakistan-lawyer-knowledge';

describe('PakistanKbSeedService', () => {
  it('creates and publishes missing pack articles', async () => {
    const kb = {
      list: vi.fn(async () => []),
      create: vi.fn(async (input: { title: string }) => ({ id: `id-${input.title}` })),
      publish: vi.fn(async () => ({})),
    };
    const service = new PakistanKbSeedService(kb as unknown as KnowledgeBaseService);
    const created = await service.ensureForTenant('tenant-1');
    expect(created).toBe(PAKISTAN_LAWYER_KNOWLEDGE.length * 2);
    expect(kb.create).toHaveBeenCalledTimes(PAKISTAN_LAWYER_KNOWLEDGE.length * 2);
    expect(kb.publish).toHaveBeenCalledTimes(PAKISTAN_LAWYER_KNOWLEDGE.length * 2);
    expect(kb.create.mock.calls[0]?.[0]).toMatchObject({
      tenantId: 'tenant-1',
      language: 'EN',
      category: PAKISTAN_PROCESS_CATEGORY,
    });
    expect(kb.create.mock.calls.some((call) => call[0]?.language === 'UR')).toBe(true);
  });

  it('skips titles already in the tenant KB for both languages', async () => {
    const kb = {
      list: vi.fn(async () =>
        PAKISTAN_LAWYER_KNOWLEDGE.flatMap((article) => [
          { title: article.title, category: PAKISTAN_PROCESS_CATEGORY, language: 'EN' },
          { title: article.title, category: PAKISTAN_PROCESS_CATEGORY, language: 'UR' },
        ]),
      ),
      create: vi.fn(),
      publish: vi.fn(),
    };
    const service = new PakistanKbSeedService(kb as unknown as KnowledgeBaseService);
    expect(await service.ensureForTenant('tenant-1')).toBe(0);
    expect(kb.create).not.toHaveBeenCalled();
  });
});
