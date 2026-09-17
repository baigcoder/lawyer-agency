import { describe, expect, it, vi } from 'vitest';
import { ResourceLockService } from './resource-lock.service';

/** Minimal Redis stand-in with real SET NX / compare-and-delete semantics. */
function fakeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    set: vi.fn(async (key: string, value: string, _px: string, _ms: number, nx: string) => {
      if (nx === 'NX' && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    }),
    eval: vi.fn(async (_script: string, _n: number, key: string, token: string) => {
      if (store.get(key) !== token) return 0;
      store.delete(key);
      return 1;
    }),
    quit: vi.fn(async () => 'OK'),
  };
}

function makeService(redis: ReturnType<typeof fakeRedis>): ResourceLockService {
  const service = Object.create(ResourceLockService.prototype) as ResourceLockService;
  Object.assign(service, { redis, logger: { warn: vi.fn(), log: vi.fn() } });
  return service;
}

describe('ResourceLockService', () => {
  it('runs the task and releases the lock afterwards', async () => {
    const redis = fakeRedis();
    const outcome = await makeService(redis).withLock('k', 1_000, async () => 'done');
    expect(outcome).toEqual({ acquired: true, result: 'done' });
    expect(redis.store.size).toBe(0);
  });

  it('refuses a second holder while the first is running', async () => {
    const redis = fakeRedis();
    const service = makeService(redis);
    let release!: () => void;
    const first = service.withLock('k', 1_000, () => new Promise<void>((r) => { release = r; }));

    const second = await service.withLock('k', 1_000, async () => 'should not run');
    expect(second).toEqual({ acquired: false });

    release();
    await first;
    // Once the first finishes the lock is free again.
    expect((await service.withLock('k', 1_000, async () => 'ok')).acquired).toBe(true);
  });

  it('releases even when the task throws', async () => {
    const redis = fakeRedis();
    const service = makeService(redis);
    await expect(
      service.withLock('k', 1_000, async () => {
        throw new Error('turn failed');
      }),
    ).rejects.toThrow('turn failed');
    expect(redis.store.size).toBe(0);
  });

  it('never deletes a lock a later holder now owns', async () => {
    const redis = fakeRedis();
    const service = makeService(redis);
    // Simulate an expired lease reacquired by someone else mid-task.
    await service.withLock('k', 1_000, async () => {
      redis.store.set('lock:k', 'someone-elses-token');
    });
    expect(redis.store.get('lock:k')).toBe('someone-elses-token');
  });

  it('keeps working when Redis is unreachable rather than dropping the job', async () => {
    const redis = fakeRedis();
    redis.set.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const outcome = await makeService(redis).withLock('k', 1_000, async () => 'ran anyway');
    expect(outcome).toEqual({ acquired: true, result: 'ran anyway' });
  });

  it('does not fail the task when releasing the lock errors', async () => {
    const redis = fakeRedis();
    redis.eval.mockRejectedValueOnce(new Error('connection reset'));
    const outcome = await makeService(redis).withLock('k', 1_000, async () => 'done');
    expect(outcome).toEqual({ acquired: true, result: 'done' });
  });
});
