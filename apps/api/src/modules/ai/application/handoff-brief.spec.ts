import { describe, expect, it, vi } from 'vitest';
import { buildHandoffBrief, parseHandoffBrief } from './handoff-brief';
import type { Prisma } from '../../../generated/prisma/client';

describe('buildHandoffBrief', () => {
  it('includes pending document requests and intake facts, not file bodies', async () => {
    const tx = {
      documentRequest: {
        findMany: vi.fn(async () => [{ description: 'CNIC copy', status: 'PENDING' }]),
      },
      document: {
        findMany: vi.fn(async () => [{ filename: 'cnic.jpg', docType: 'ID' }]),
      },
      payment: { findMany: vi.fn(async () => []) },
    } as unknown as Prisma.TransactionClient;

    const brief = await buildHandoffBrief(tx, {
      clientId: 'client-1',
      caseId: null,
      intakeFields: {
        practiceArea: 'Family Law',
        city: 'Lahore',
        pendingAppointment: { lawyerId: 'x', slots: [] },
      },
      escalation: {
        triggerType: 'MANUAL',
        reason: 'Client asked for a lawyer',
        excerpt: 'vakil se baat',
      },
    });

    expect(brief.facts).toEqual({ practiceArea: 'Family Law', city: 'Lahore' });
    expect(brief.documents.requests).toEqual([{ description: 'CNIC copy', status: 'PENDING' }]);
    expect(brief.documents.files).toEqual([{ filename: 'cnic.jpg', docType: 'ID' }]);
    expect(brief.openItems.some((item) => item.includes('CNIC copy'))).toBe(true);
    expect(JSON.stringify(brief)).not.toContain('extractedText');
    expect(brief.nextAction).toContain('Review this brief');
  });
});

describe('parseHandoffBrief', () => {
  it('returns an empty brief for invalid JSON', () => {
    expect(parseHandoffBrief({ foo: 1 }).reason).toBe('');
  });
});
