import { describe, expect, it } from 'vitest';
import { EvolutionQrStore } from './evolution-qr.store';

describe('EvolutionQrStore', () => {
  it('keeps pairing working from memory when Redis is unreachable', async () => {
    // Nothing listens on port 1: every Redis call fails fast.
    const store = new EvolutionQrStore({ get: () => 'redis://127.0.0.1:1' } as never);
    await store.set('wakeel-t1', 'data:qr');
    expect(await store.get('wakeel-t1')).toBe('data:qr');
    await store.clear('wakeel-t1');
    expect(await store.get('wakeel-t1')).toBeNull();
    await store.onModuleDestroy();
  });
});
