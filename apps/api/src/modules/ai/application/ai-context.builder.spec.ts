import { describe, expect, it, vi } from 'vitest';
import { AiContextBuilder } from './ai-context.builder';

describe('AiContextBuilder', () => {
  it('loads firm profile, history, intake fields, and retrieval chunks', async () => {
    const tx = {
      role: {
        findFirst: vi.fn(async () => ({ id: 'role-admin' })),
      },
      user: {
        findFirst: vi.fn(async () => ({ id: 'user-admin', name: 'Adv. Ali' })),
      },
      lawyer: {
        findFirst: vi.fn(async () => ({
          bio: '15 years in family law',
          bioUr: '',
          yearsExperience: 15,
          barCouncil: 'Punjab Bar Council',
          barEnrollmentNumber: '',
          education: ['LLB'],
          achievements: [],
          languages: ['Urdu', 'English'],
          practiceAreas: ['Family Law'],
          caseHighlights: [{ publicTitle: 'Custody matter', publicOutcome: 'Settled amicably' }],
        })),
      },
      tenant: {
        findUnique: vi.fn(async () => ({
          name: 'ABC Law',
          settings: {
            displayName: 'ABC Law Associates',
            city: 'Lahore',
            practiceAreas: ['Family Law'],
            aiTone: 'formal',
            aiAutoReplyEnabled: true,
          },
        })),
      },
      conversation: {
        findUnique: vi.fn(async () => ({ clientId: 'client-1', caseId: 'case-1' })),
      },
      message: {
        findMany: vi.fn(async () => [
          {
            direction: 'OUTBOUND',
            senderType: 'AI',
            body: 'جی، بتائیں کیا ہوا؟',
            contentType: 'AUDIO',
            createdAt: new Date(),
          },
          {
            direction: 'INBOUND',
            senderType: 'CLIENT',
            body: 'مجھے طلاق کے کیس میں مدد چاہیے',
            contentType: 'AUDIO',
            createdAt: new Date(),
          },
          { direction: 'OUTBOUND', senderType: 'AI', body: 'Hi there', contentType: 'TEXT', createdAt: new Date() },
          { direction: 'INBOUND', senderType: 'CLIENT', body: 'Hello', contentType: 'TEXT', createdAt: new Date() },
        ]),
        count: vi.fn(async () => 1),
      },
      intakeSession: {
        findUnique: vi.fn(async () => ({ extractedFields: { practiceArea: 'Family Law' } })),
      },
    };

    const builder = new AiContextBuilder();
    const ctx = await builder.build({
      tenantId: 't1',
      conversationId: 'conv-1',
      tx: tx as never,
      retrievedChunks: [
        {
          chunkId: 'chunk-1',
          content: 'Consultation fee is PKR 5000',
          score: 0.9,
          source: 'knowledge_base',
          kbId: 'kb-1',
          title: 'Fees',
        },
      ],
    });

    expect(ctx.firm.displayName).toBe('ABC Law Associates');
    expect(ctx.firm.city).toBe('Lahore');
    expect(ctx.aiSettings.aiTone).toBe('formal');
    expect(ctx.clientId).toBe('client-1');
    expect(ctx.caseId).toBe('case-1');
    expect(ctx.conversationHistory).toContain('Client: Hello');
    expect(ctx.conversationHistory).toContain('AI: Hi there');
    expect(ctx.conversationHistory).toContain('مجھے طلاق کے کیس میں مدد چاہیے');
    expect(ctx.lastAiReply).toBe('جی، بتائیں کیا ہوا؟');
    expect(ctx.intakeFields).toEqual({ practiceArea: 'Family Law' });
    expect(ctx.retrievedContext).toContain('Consultation fee');
    expect(ctx.ownerProfile?.ownerName).toBe('Adv. Ali');
    expect(ctx.isFirstClientTurn).toBe(false);
  });
});
