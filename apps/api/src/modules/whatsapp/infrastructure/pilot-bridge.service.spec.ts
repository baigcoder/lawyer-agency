import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';

const makeWASocket = vi.fn();

vi.mock('@whiskeysockets/baileys', () => ({
  Browsers: { ubuntu: () => ['Ubuntu', 'Wakeel Pilot', '22.04.4'] },
  initAuthCreds: () => ({
    noiseKey: { public: new Uint8Array([1, 2, 3]), private: new Uint8Array([4, 5, 6]) },
    signedIdentityKey: { public: new Uint8Array([7, 8]), private: new Uint8Array([9, 10]) },
    registered: false,
  }),
  makeWASocket: (...args: unknown[]) => makeWASocket(...(args as [])),
}));

vi.mock('bullmq', () => {
  class FakeWorker {
    on() { return this; }
    async close() { /* noop */ }
  }
  return { Worker: FakeWorker, Queue: class FakeQueue {} };
});

const redisClient = {
  get: vi.fn(async () => null),
  set: vi.fn(async () => 'OK'),
  del: vi.fn(async () => 1),
  keys: vi.fn(async () => [] as string[]),
};

vi.mock('../../../common/queue/queue-redis.helper', () => ({
  queueRedisClient: vi.fn(async () => redisClient),
}));

import { PilotBridgeService } from './pilot-bridge.service';
import type { PilotSessionRepository } from '../application/ports';
import type { CryptoService } from '../../../common/crypto/crypto.service';
import type { UnitOfWork } from '../../../common/prisma/unit-of-work';

const TENANT = '11111111-1111-1111-1111-111111111111';

interface CapturedUpsert {
  tenantId: string;
  data: Record<string, unknown>;
}

function makeService(overrides: Partial<{ session: unknown; markers: string[] }> = {}) {
  const upserts: CapturedUpsert[] = [];
  const pilots = {
    findByTenant: vi.fn(async () =>
      overrides.session === null
        ? null
        : {
            tenantId: TENANT,
            status: 'PAIRING',
            allowlist: [],
            sessionCredsEnc: null,
            expiresAt: new Date(Date.now() + 3600_000),
            lastSeenAt: null,
            lastError: null,
            lastErrorAt: null,
            ...(overrides.session ?? {}),
          },
    ),
    upsert: vi.fn(async (_tx: unknown, tenantId: string, data: Record<string, unknown>) => {
      upserts.push({ tenantId, data });
    }),
  } as unknown as PilotSessionRepository;

  const uow = {
    withTenant: async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) => fn({}),
  } as unknown as UnitOfWork;

  const crypto = {
    encrypt: (plain: string) => plain,
    decrypt: (enc: string) => enc,
  } as unknown as CryptoService;

  const config = {
    get: (key: string): string | number | undefined =>
      ({ PILOT_BRIDGE_ENABLED: 'true', PILOT_QR_TTL_MINUTES: '5', PILOT_MAX_ALLOWLIST: 25 })[key],
  } as never;

  const queue = { opts: { connection: { url: 'redis://fake' } } } as never;

  const service = new PilotBridgeService(
    config,
    crypto,
    uow,
    { log: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
    pilots,
    queue,
    queue,
  );

  return { service, pilots, upserts };
}

function fakeSocket(): { sock: { ev: EventEmitter; end: () => Promise<void> }; emit: EventEmitter } {
  const ev = new EventEmitter();
  const sock = { ev, end: async () => undefined };
  makeWASocket.mockReturnValueOnce(sock);
  return { sock: sock as never, emit: ev };
}

describe('PilotBridgeService auth-state persistence (SaaS connection lifecycle)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    makeWASocket.mockReset();
    redisClient.keys.mockResolvedValue([]);
    redisClient.get.mockResolvedValue(null);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('REGRESSION: partial creds.update merges instead of replacing — noiseKey survives', async () => {
    // This is the exact bug that broke every post-pairing reconnect: Baileys
    // emits 'creds.update' with partial payloads (e.g. { me }) while keeping
    // the full creds object by reference. Replacing creds with the partial
    // wiped noiseKey and the 515 restart crashed with "reading 'public'".
    const { service, upserts } = makeService();
    const { emit } = fakeSocket();

    await service.pair(TENANT);
    emit.emit('creds.update', { me: { id: '92300@wa', name: 'Test' } });
    await vi.advanceTimersByTimeAsync(200); // flush the debounced persist

    expect(upserts.length).toBeGreaterThan(0);
    const blob = upserts[upserts.length - 1].data.sessionCredsEnc as string;
    const parsed = JSON.parse(blob) as {
      creds: { noiseKey?: { public?: unknown }; me?: { id?: string } };
    };
    expect(parsed.creds.me?.id).toBe('92300@wa'); // partial merged in
    expect(parsed.creds.noiseKey).toBeDefined(); // and nothing was lost
    expect(parsed.creds.noiseKey?.public).toMatchObject({ _type: 'Buffer' });
  });

  it('REGRESSION: Buffer.toJSON() residue in creds.update is normalized (Baileys JSON-clones creds)', async () => {
    // Verified against a live blob: Baileys re-emits creds after an internal
    // JSON clone, so noiseKey.public arrives as {type:'Buffer',data:[…]}
    // (Node's Buffer.toJSON shape) instead of a Uint8Array. Without
    // normalization the reload hands cipher.update() a plain Object.
    const { service, upserts } = makeService();
    const { emit } = fakeSocket();

    await service.pair(TENANT);
    emit.emit('creds.update', {
      registered: true,
      me: { id: '92300@wa' },
      noiseKey: {
        public: { type: 'Buffer', data: [222, 88, 190] },
        private: { type: 'Buffer', data: [1, 2, 3] },
      },
    });
    await vi.advanceTimersByTimeAsync(200);

    const blob = upserts[upserts.length - 1].data.sessionCredsEnc as string;
    const parsed = JSON.parse(blob) as {
      creds: { noiseKey?: { public?: { _type?: string; data?: string }; type?: string } };
    };
    const pub = parsed.creds.noiseKey?.public;
    expect(pub?.type).toBeUndefined(); // toJSON residue gone
    expect(pub?._type).toBe('Buffer'); // normalized marker present
    expect(typeof pub?.data).toBe('string'); // base64, revivable to Uint8Array
  });

  it('REGRESSION: reloaded creds are Node Buffers (libsignal requires instanceof Buffer)', async () => {
    // Verified live: libsignal validatePrivKey throws "Invalid private key
    // type: Uint8Array" when the reviver produces bare Uint8Arrays. The
    // full round-trip persist → reload must hand Baileys real Buffers.
    const { service, upserts } = makeService();
    const { emit } = fakeSocket();

    await service.pair(TENANT);
    emit.emit('creds.update', {
      noiseKey: {
        public: { type: 'Buffer', data: [222, 88, 190] },
        private: { type: 'Buffer', data: [1, 2, 3] },
      },
    });
    await vi.advanceTimersByTimeAsync(200);
    const blob = upserts[upserts.length - 1].data.sessionCredsEnc as string;

    // Reload: a fresh service whose session already carries the persisted blob.
    makeWASocket.mockReset();
    const second = makeService({
      session: { sessionCredsEnc: blob, status: 'PAIRING' },
    });
    fakeSocket();
    await second.service.pair(TENANT);

    const auth = makeWASocket.mock.calls[0][0] as {
      auth: { creds: { noiseKey: { private: unknown; public: unknown } } };
    };
    expect(Buffer.isBuffer(auth.auth.creds.noiseKey.private)).toBe(true);
    expect(Buffer.isBuffer(auth.auth.creds.noiseKey.public)).toBe(true);
    expect((auth.auth.creds.noiseKey.private as Buffer).equals(Buffer.from([1, 2, 3]))).toBe(true);
  });

  it('REGRESSION: graceful shutdown suspends — keeps resume marker and DB status (no disconnect wipe)', async () => {
    // docker restart previously ran disconnectAll(), which cleared the resume
    // marker and set DISCONNECTED — leaving boot-resume nothing to resume.
    const { service, upserts } = makeService();
    const { emit } = fakeSocket();

    await service.pair(TENANT);
    emit.emit('connection.update', { connection: 'open' });
    redisClient.del.mockClear();

    await service.onApplicationShutdown();

    const wiped = upserts.find((u) => u.data.status === 'DISCONNECTED');
    expect(wiped).toBeUndefined(); // DB status untouched by shutdown
    const delTargets = redisClient.del.mock.calls.map((c) => String(c[0]));
    expect(delTargets).not.toContain('wakeel:pilot:resumable:' + TENANT); // marker survives
  });

  it('boot resume: PAIRED marker triggers automatic re-pair on worker start', async () => {
    redisClient.keys.mockResolvedValue(['wakeel:pilot:resumable:' + TENANT]);
    const { service } = makeService({ session: { status: 'PAIRED' } });
    fakeSocket();

    service.onModuleInit();
    await vi.waitFor(() => {
      expect(makeWASocket).toHaveBeenCalledTimes(1);
    }, { timeout: 1000 });
    expect(redisClient.keys).toHaveBeenCalledWith('wakeel:pilot:resumable:*');
  });

  it('terminal failure: after MAX_RECONNECT_ATTEMPTS failed reconnects creds are cleared with a reason', async () => {
    const { service, upserts } = makeService();

    for (let i = 0; i <= 6; i++) {
      const { emit } = fakeSocket();
      await service.pair(TENANT);
      emit.emit('connection.update', {
        connection: 'close',
        lastDisconnect: { error: new TypeError("Cannot read properties of undefined (reading 'public')") },
      });
      await vi.advanceTimersByTimeAsync(70_000); // burn through the backoff
    }

    const terminal = upserts.find((u) => u.data.lastError !== undefined);
    expect(terminal).toBeDefined();
    expect(terminal?.data.status).toBe('DISCONNECTED');
    expect(terminal?.data.sessionCredsEnc).toBeNull();
    expect(typeof terminal?.data.lastError).toBe('string');
  });

  it('logout (401/403/428) clears creds and records an actionable reason', async () => {
    const { service, upserts } = makeService();
    const { emit } = fakeSocket();

    await service.pair(TENANT);
    emit.emit('connection.update', {
      connection: 'close',
      lastDisconnect: { error: Object.assign(new Error('logged out'), { output: { statusCode: 428 } }) },
    });
    await vi.advanceTimersByTimeAsync(10);

    const loggedOut = upserts.find((u) => u.data.lastError !== undefined);
    expect(loggedOut).toBeDefined();
    expect(loggedOut?.data.status).toBe('DISCONNECTED');
    expect(loggedOut?.data.sessionCredsEnc).toBeNull();
    expect(loggedOut?.data.lastError).toMatch(/another device/i);
  });

  it('successful open sets the resume marker and clears lastError', async () => {
    const { service, upserts } = makeService();
    const { emit } = fakeSocket();

    await service.pair(TENANT);
    emit.emit('connection.update', { connection: 'open' });
    await vi.advanceTimersByTimeAsync(10);

    const paired = upserts.find((u) => u.data.status === 'PAIRED');
    expect(paired).toBeDefined();
    expect(paired?.data.lastError).toBeNull();
    expect(paired?.data.lastErrorAt).toBeNull();
    expect(redisClient.set).toHaveBeenCalledWith(
      'wakeel:pilot:resumable:' + TENANT,
      '1',
      'EX',
      7 * 24 * 3600,
    );
  });

  it('keys.set persists signal keys through the debounced write', async () => {
    // Baileys writes signal keys via auth.keys.set without firing
    // creds.update — the store must trigger its own persist.
    const { service, upserts } = makeService();
    fakeSocket();
    await service.pair(TENANT);

    // Reach the store the service handed to makeWASocket.
    const call = makeWASocket.mock.calls[0][0] as {
      auth: { keys: { set: (t: string, i: Array<{ id: string; data: Uint8Array }>) => Promise<void> } };
    };
    await call.auth.keys.set('pre-key', [{ id: 'k1', data: new Uint8Array([9, 9, 9]) }]);
    await vi.advanceTimersByTimeAsync(200);

    const blob = upserts[upserts.length - 1].data.sessionCredsEnc as string;
    const parsed = JSON.parse(blob) as { keys: Record<string, Record<string, { _type?: string }>> };
    expect(parsed.keys['pre-key']).toBeDefined();
    expect(parsed.keys['pre-key'].k1).toMatchObject({ _type: 'Buffer' });
  });
});

describe('PilotBridgeService auto-allowlist', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    makeWASocket.mockReset();
    redisClient.keys.mockResolvedValue([]);
    redisClient.get.mockResolvedValue(null);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function messageUpsert(fromPhone: string, messageId = 'msg-1') {
    return {
      messages: [
        {
          key: { remoteJid: `${fromPhone}@s.whatsapp.net`, id: messageId, fromMe: false },
          message: { conversation: 'Hello AI' },
          messageTimestamp: Math.floor(Date.now() / 1000),
          pushName: 'Test Client',
        },
      ],
      type: 'notify',
    };
  }

  it('auto-adds an unknown inbound sender to the allowlist and enqueues the message', async () => {
    const { service, pilots } = makeService({ session: { status: 'PAIRED', allowlist: [] } });
    const inboundQueueAdd = vi.fn();
    const inboundQueue = { add: inboundQueueAdd, getJob: vi.fn(async () => null) };
    (service as unknown as { inboundQueue: typeof inboundQueue }).inboundQueue = inboundQueue as never;
    const { emit } = fakeSocket();

    await service.pair(TENANT);
    emit.emit('messages.upsert', messageUpsert('923001234567'));
    await vi.advanceTimersByTimeAsync(10);

    expect(pilots.upsert).toHaveBeenCalledWith(
      expect.anything(),
      TENANT,
      expect.objectContaining({
        allowlist: [{ number: '923001234567', label: null }],
      }),
    );
    expect(inboundQueueAdd).toHaveBeenCalled();
  });

  it('does not duplicate an already allowlisted sender', async () => {
    const { service, pilots } = makeService({
      session: { status: 'PAIRED', allowlist: [{ number: '923001234567', label: null }] },
    });
    const inboundQueueAdd = vi.fn();
    const inboundQueue = { add: inboundQueueAdd, getJob: vi.fn(async () => null) };
    (service as unknown as { inboundQueue: typeof inboundQueue }).inboundQueue = inboundQueue as never;
    const { emit } = fakeSocket();

    await service.pair(TENANT);
    emit.emit('messages.upsert', messageUpsert('923001234567'));
    await vi.advanceTimersByTimeAsync(10);

    expect(pilots.upsert).not.toHaveBeenCalledWith(
      expect.anything(),
      TENANT,
      expect.objectContaining({ allowlist: expect.anything() }),
    );
    expect(inboundQueueAdd).toHaveBeenCalled();
  });

  it('blocks auto-add when the allowlist cap is reached', async () => {
    const allowlist = Array.from({ length: 25 }, (_, i) => ({ number: `92300${String(i).padStart(7, '0')}`, label: null }));
    const { service } = makeService({ session: { status: 'PAIRED', allowlist } });
    const inboundQueueAdd = vi.fn();
    const inboundQueue = { add: inboundQueueAdd, getJob: vi.fn(async () => null) };
    (service as unknown as { inboundQueue: typeof inboundQueue }).inboundQueue = inboundQueue as never;
    const { emit } = fakeSocket();

    await service.pair(TENANT);
    emit.emit('messages.upsert', messageUpsert('924000000000'));
    await vi.advanceTimersByTimeAsync(10);

    expect(inboundQueueAdd).not.toHaveBeenCalled();
  });
});
