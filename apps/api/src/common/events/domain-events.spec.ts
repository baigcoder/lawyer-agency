import { describe, expect, it } from 'vitest';
import { DOMAIN_EVENTS, domainEventPayloads } from './domain-events';

describe('domain event payloads (T1/T2 discipline, D-005)', () => {
  it('accepts a well-formed case.created payload', () => {
    const parsed = domainEventPayloads[DOMAIN_EVENTS.CaseCreated].parse({
      caseId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d0e',
      clientId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d0f',
      reference: 'FAM-2026-4821',
      matterType: 'Family Law',
    });
    expect(parsed.reference).toBe('FAM-2026-4821');
  });

  it('rejects payloads missing identifiers (they would poison consumers)', () => {
    expect(() =>
      domainEventPayloads[DOMAIN_EVENTS.CaseCreated].parse({
        caseId: 'not-a-uuid',
        clientId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d0f',
        reference: 'FAM-2026-4821',
        matterType: 'Family Law',
      }),
    ).toThrow();
  });

  it('accepts document.received with ids only (no T3)', () => {
    const parsed = domainEventPayloads[DOMAIN_EVENTS.DocumentReceived].parse({
      documentId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d0e',
      clientId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d0f',
      messageId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d10',
    });
    expect(parsed.documentId).toBeDefined();
  });
});
