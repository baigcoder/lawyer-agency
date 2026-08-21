import { describe, expect, it, vi } from 'vitest';
import { InvitePark } from './sip-invite-park';

describe('InvitePark', () => {
  it('claims a parked INVITE by matching caller digits', async () => {
    const park = new InvitePark<string>();
    const idle = vi.fn();
    park.park('sip:+923001112233@sipv2.wavoip.com', 'dialog-a', 1_000, idle);
    await expect(park.claim('923001112233', 50)).resolves.toBe('dialog-a');
    expect(idle).not.toHaveBeenCalled();
  });

  it('delivers an INVITE that arrives after claim starts waiting', async () => {
    const park = new InvitePark<string>();
    const pending = park.claim('923001112233', 200);
    park.park('923001112233', 'dialog-b', 1_000, vi.fn());
    await expect(pending).resolves.toBe('dialog-b');
  });

  it('returns null when no INVITE arrives before the wait timeout', async () => {
    const park = new InvitePark<string>();
    await expect(park.claim('923001112233', 20)).resolves.toBeNull();
  });

  it('rejects an unclaimed INVITE after idle timeout', async () => {
    const park = new InvitePark<string>();
    const idle = vi.fn();
    park.park('923001112233', 'dialog-c', 20, idle);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(idle).toHaveBeenCalledWith('dialog-c');
    await expect(park.claim('923001112233', 20)).resolves.toBeNull();
  });

  it('claims the sole parked INVITE when WhatsApp LID and SIP PN differ', async () => {
    const park = new InvitePark<string>();
    park.park('175853392666628', 'dialog-lid', 1_000, vi.fn());
    await expect(park.claim('923241047761', 50)).resolves.toBe('dialog-lid');
  });

  it('delivers a sole late INVITE to the only waiter despite digit mismatch', async () => {
    const park = new InvitePark<string>();
    const pending = park.claim('923241047761', 200);
    park.park('175853392666628', 'dialog-late', 1_000, vi.fn());
    await expect(pending).resolves.toBe('dialog-late');
  });
});
