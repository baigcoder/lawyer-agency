import { describe, expect, it, vi } from 'vitest';
import { ChainedOutboundSender } from './outbound-sender.service';
import type { PilotSessionRepository, WhatsappAccountRepository, MetaCloudApi } from './ports';
import { PILOT_SEND_JOB } from '../../../common/queue/queue.constants';
import { WindowClosedError } from '../../../common/messaging/window-policy';
import { MetaApiError } from '../domain/errors';
import type { DbTx } from '../../../common/persistence/db-tx';
import type { CryptoService } from '../../../common/crypto/crypto.service';
import type { Queue } from 'bullmq';

const tx = {} as unknown as DbTx;

function makeSender(overrides: Partial<{
  pilots: Partial<PilotSessionRepository>;
  accounts: Partial<WhatsappAccountRepository>;
  meta: Partial<MetaCloudApi>;
  crypto: Partial<CryptoService>;
  queue: Partial<Queue>;
}> = {}) {
  const pilots = overrides.pilots ?? {};
  const accounts = overrides.accounts ?? {};
  const meta = overrides.meta ?? {};
  const crypto = overrides.crypto ?? { decrypt: (s: string) => s };
  const queue = overrides.queue ?? { add: vi.fn(async () => ({})) as never };

  const sender = new ChainedOutboundSender(
    crypto as never as CryptoService,
    accounts as never as WhatsappAccountRepository,
    pilots as never as PilotSessionRepository,
    meta as never as MetaCloudApi,
    queue as unknown as Queue,
  );
  return { sender, pilots, accounts, meta, crypto, queue };
}

function pairedAllowlisted(phone = '923000000001') {
  return {
    findByTenant: async () => ({
      tenantId: 't1', status: 'PAIRED', allowlist: [{ number: phone, label: null }],
      sessionCredsEnc: null, expiresAt: new Date(Date.now() + 3600_000), lastSeenAt: null,
      lastError: null, lastErrorAt: null,
    }),
  };
}

describe('ChainedOutboundSender (D-092 routing)', () => {
  it('routes to pilot when session is PAIRED, unexpired, and recipient is allowlisted', async () => {
    const { sender, queue } = makeSender({ pilots: pairedAllowlisted() });
    queue.add = vi.fn(async () => ({})) as never;
    let captured: unknown = null;
    queue.add.mockImplementation((async (name: string, payload: unknown) => {
      captured = { name, payload };
      return {} as never;
    }) as never);

    const result = await sender.postMessage({
      tenantId: 't1', toWaPhone: '923000000001',
      body: { type: 'text', text: { body: 'hi' } }, tx,
    });

    expect(result).toEqual({ wamid: expect.stringContaining('pilot-') });
    expect(captured).toMatchObject({ name: PILOT_SEND_JOB, payload: { tenantId: 't1', toWaPhone: '923000000001' } });
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('falls back to Meta when recipient is not allowlisted', async () => {
    const metaPost = vi.fn(async () => ({ wamid: 'wamid-123' }));
    const { sender } = makeSender({
      pilots: pairedAllowlisted(),
      meta: { postMessage: metaPost as never },
      accounts: { findByTenant: async () => ({ tenantId: 't1', wabaId: 'w', phoneNumberId: 'pn', accessTokenEnc: 'a', displayPhoneNumber: '+x' }) },
      crypto: { decrypt: () => 'decrypted-token' },
    });

    const result = await sender.postMessage({
      tenantId: 't1', toWaPhone: '923999999999', // not allowlisted
      body: { type: 'text', text: { body: 'hi' } }, tx,
    });

    expect(result).toEqual({ wamid: 'wamid-123' });
    expect(metaPost).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'decrypted-token',
        body: expect.objectContaining({ messaging_product: 'whatsapp', to: '923999999999', type: 'text' }),
      }),
    );
  });

  it('falls back to Meta when the pilot session is expired', async () => {
    const metaPost = vi.fn(async () => ({ wamid: 'wamid-456' }));
    const { sender } = makeSender({
      pilots: { findByTenant: async () => ({
        tenantId: 't1', status: 'PAIRED', allowlist: [{ number: '923000000001', label: null }],
        sessionCredsEnc: null, expiresAt: new Date(Date.now() - 10_000), lastSeenAt: null,
      }) },
      meta: { postMessage: metaPost as never },
      accounts: { findByTenant: async () => ({ tenantId: 't1', wabaId: 'w', phoneNumberId: 'pn', accessTokenEnc: 'a', displayPhoneNumber: '+x' }) },
      crypto: { decrypt: () => 'tok' },
    });

    await sender.postMessage({
      tenantId: 't1', toWaPhone: '923000000001', body: { type: 'text', text: { body: 'hi' } }, tx,
    });

    expect(metaPost).toHaveBeenCalledTimes(1); // did not enqueue pilot send, hit meta instead
  });

  it('falls back to Meta when there is no pilot session', async () => {
    const metaPost = vi.fn(async () => ({ wamid: 'wamid-789' }));
    const { sender } = makeSender({
      pilots: { findByTenant: async () => null },
      meta: { postMessage: metaPost as never },
      accounts: { findByTenant: async () => ({ tenantId: 't1', wabaId: 'w', phoneNumberId: 'pn', accessTokenEnc: 'a', displayPhoneNumber: '+x' }) },
      crypto: { decrypt: () => 't' },
    });

    const result = await sender.postMessage({
      tenantId: 't1', toWaPhone: '923000000001', body: { type: 'text', text: { body: 'hi' } }, tx,
    });

    expect(result).toEqual({ wamid: 'wamid-789' });
  });

  it('maps Meta 131047 to WindowClosedError', async () => {
    const { sender } = makeSender({
      pilots: { findByTenant: async () => null }, // no pilot → meta path
      meta: { postMessage: async () => { throw new MetaApiError(131047, 'window closed'); } },
      accounts: { findByTenant: async () => ({ tenantId: 't1', wabaId: 'w', phoneNumberId: 'pn', accessTokenEnc: 'a', displayPhoneNumber: '+x' }) },
      crypto: { decrypt: () => 't' },
    });

    await expect(
      sender.postMessage({ tenantId: 't1', toWaPhone: '923000000001', body: { type: 'text', text: { body: 'hi' } }, tx }),
    ).rejects.toBeInstanceOf(WindowClosedError);
  });

  it('A1: template bodies never route to the pilot bridge even when allowlisted', async () => {
    const { sender, queue } = makeSender({ pilots: pairedAllowlisted() });
    queue.add = vi.fn(async () => ({})) as never;
    const metaPost = vi.fn(async () => ({ wamid: 'meta-wamid-1' }));
    const meta = { postMessage: metaPost as never };
    const sender2 = new (ChainedOutboundSender as new (...args: never[]) => never)(
      { decrypt: () => 't' } as never,
      { findByTenant: async () => ({ tenantId: 't1', wabaId: 'w', phoneNumberId: 'pn', accessTokenEnc: 'a', displayPhoneNumber: '+x', connectionStage: 'LIVE' }) } as never,
      pairedAllowlisted() as never,
      meta as never,
      queue as unknown as Queue,
    );
    void sender;
    const result = await sender2.postMessage({
      tenantId: 't1', toWaPhone: '923000000001',
      body: { type: 'template', template: { name: 'wakeel_welcome', language: { code: 'en' } } }, tx,
    });
    expect(result).toEqual({ wamid: 'meta-wamid-1' }); // fell through to Meta
    expect(queue.add).not.toHaveBeenCalled(); // pilot queue untouched
  });
});
