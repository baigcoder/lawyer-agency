import { describe, expect, it } from 'vitest';
import { computeStatusTransition } from './messages.service';

describe('computeStatusTransition', () => {
  it('updates SENT and ignores a subsequent downgrade to SENT', () => {
    expect(computeStatusTransition('QUEUED', 'sent')).toMatchObject({ newStatus: 'SENT', updated: true });
    expect(computeStatusTransition('SENT', 'sent')).toBeNull();
  });

  it('upgrades through delivered then read', () => {
    expect(computeStatusTransition('SENT', 'delivered')).toMatchObject({ newStatus: 'DELIVERED', updated: true });
    expect(computeStatusTransition('DELIVERED', 'read')).toMatchObject({ newStatus: 'READ', updated: true });
  });

  it('ignores downgrades (read -> delivered)', () => {
    expect(computeStatusTransition('READ', 'delivered')).toBeNull();
  });

  it('treats FAILED as terminal', () => {
    expect(computeStatusTransition('SENT', 'failed')).toMatchObject({ newStatus: 'FAILED', updated: true });
    expect(computeStatusTransition('FAILED', 'delivered')).toBeNull();
    expect(computeStatusTransition('FAILED', 'read')).toBeNull();
  });
});
