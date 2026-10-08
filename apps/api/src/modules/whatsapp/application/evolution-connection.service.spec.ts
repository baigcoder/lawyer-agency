import { describe, expect, it, vi } from 'vitest';
import { EvolutionConnectionService } from './evolution-connection.service';

function setup(state: 'connecting' | 'disconnected' = 'disconnected') {
  const evolution = {
    getConnectionState: vi.fn(async () => ({ instanceName: 'wakeel-t1', connectionType: 'baileys', status: state })),
    resetInstance: vi.fn(async () => undefined),
    createInstance: vi.fn(async () => undefined),
    setWebhook: vi.fn(async () => undefined),
    setInstanceSettings: vi.fn(async () => undefined),
    connectInstance: vi.fn(async () => ({ instanceName: 'wakeel-t1', status: 'connecting', qrCode: 'data:qr-new' })),
  };
  const connections = {
    findByTenant: vi.fn(async () => ({ instanceName: 'wakeel-t1', connectionType: 'baileys', phoneNumber: null, displayName: null })),
    upsert: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  };
  const uow = { withTenant: (_t: string, fn: (tx: unknown) => unknown) => fn({}) };
  const config = { get: () => '' };
  // Stands in for Redis: the real store lets the key expire with the QR.
  const qrs = new Map<string, string>();
  const qrStore = {
    get: async (i: string) => qrs.get(i) ?? null,
    set: async (i: string, qr: string | null) => void (qr ? qrs.set(i, qr) : qrs.delete(i)),
    clear: async (i: string) => void qrs.delete(i),
    expire: (i: string) => qrs.delete(i),
  };
  const held = new Set<string>();
  const locks = {
    withLock: async <T,>(key: string, _ms: number, fn: () => Promise<T>) => {
      if (held.has(key)) return { acquired: false as const };
      held.add(key);
      try {
        return { acquired: true as const, result: await fn() };
      } finally {
        held.delete(key);
      }
    },
    held,
  };
  const service = new EvolutionConnectionService(
    config as never,
    uow as never,
    evolution as never,
    qrStore as never,
    connections as never,
    locks as never,
  );
  return { service, evolution, qrStore, locks };
}

describe('EvolutionConnectionService', () => {
  it('shares one connect attempt between a double click / two tabs', async () => {
    const { service, evolution } = setup();
    const [a, b] = await Promise.all([service.connect('t1'), service.connect('t1')]);
    expect(a).toBe(b);
    expect(evolution.resetInstance).toHaveBeenCalledTimes(1);
    expect(evolution.createInstance).toHaveBeenCalledTimes(1);
  });

  it('re-fetches an expired QR instead of showing it, and keeps a fresh one', async () => {
    const { service, evolution, qrStore } = setup('connecting');
    await qrStore.set('wakeel-t1', 'data:qr-live');
    expect((await service.getStatus('t1')).qrCode).toBe('data:qr-live');
    expect(evolution.connectInstance).not.toHaveBeenCalled();

    qrStore.expire('wakeel-t1');
    expect((await service.getStatus('t1')).qrCode).toBe('data:qr-new');
    expect(evolution.connectInstance).toHaveBeenCalledTimes(1);
  });

  it('reports progress instead of wiping a pairing another replica started', async () => {
    const { service, evolution, locks } = setup('connecting');
    locks.held.add('whatsapp-connect:t1');
    const result = await service.connect('t1');
    expect(evolution.resetInstance).not.toHaveBeenCalled();
    expect(result.status).toBe('connecting');
  });
});
