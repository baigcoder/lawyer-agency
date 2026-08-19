import { Inject, Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Logger } from 'nestjs-pino';
import { pino } from 'pino';
import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import {
  Browsers,
  initAuthCreds,
  makeWASocket,
  type WASocket,
  type AuthenticationCreds,
  type ConnectionState,
  type SignalKeyStore,
  type WABrowserDescription,
  type WAMessage,
  type MessageUpsertType,
} from '@whiskeysockets/baileys';
import { z } from 'zod';
import type { Env } from '../../../config/env';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import {
  PILOT_DISCONNECT_JOB,
  PILOT_PAIR_JOB,
  PILOT_SEND_JOB,
  QUEUES,
} from '../../../common/queue/queue.constants';
import { queueRedisClient } from '../../../common/queue/queue-redis.helper';
import type { NormalizedInboundMessage } from '../../../common/messaging/inbound-message';
import { PILOT_SESSION_REPOSITORY, type PilotSessionRepository } from '../application/ports';

const qrRedisKey = (tenantId: string) => `wakeel:pilot:qr:${tenantId}`;
const aliveRedisKey = (tenantId: string) => `wakeel:pilot:alive:${tenantId}`;
/** Alive-key TTL: refreshed every 60s, so ~2.5 missed beats = "dead". */
const ALIVE_TTL_SECONDS = 150;
/**
 * Resume marker: present while a session is PAIRED. On worker boot every
 * marker is re-paired (creds reload from the DB), so deploys/restarts don't
 * force a QR re-scan. Cleared on disconnect/logout/terminal failure.
 */
const resumeRedisKey = (tenantId: string) => `wakeel:pilot:resumable:${tenantId}`;
const UUID_LIKE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
/** Coalesce window for creds/keys DB writes. Short on purpose: the 515
 *  restart can land <1s after the last keys.set(), and the close handler's
 *  flush must see the freshest state. */
const PERSIST_DEBOUNCE_MS = 50;
/** Consecutive failed reconnects before the session is declared terminal. */
const MAX_RECONNECT_ATTEMPTS = 5;

const pilotSendJobSchema = z.object({
  tenantId: z.string().uuid(),
  toWaPhone: z.string(),
  body: z.record(z.string(), z.unknown()),
});

const pilotPairJobSchema = z.object({ tenantId: z.string().uuid() });

const BROWSER: WABrowserDescription = Browsers.ubuntu('Wakeel Pilot');

/** Serializable key-store state: { [type]: { [id]: data } }. */
type KeyStoreData = Record<string, Record<string, unknown>>;

/** JSON replacer: serializes Uint8Array as { _type:'Buffer', data: base64 }.
 *  Also normalizes Node's Buffer.toJSON() residue ({ type:'Buffer', data:[…] })
 *  — Baileys internally JSON-clones creds before emitting `creds.update`, so
 *  binary fields can arrive as plain objects that cipher.update() would
 *  otherwise reject after reload. */
function keyStoreReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return { _type: 'Buffer', data: Buffer.from(value).toString('base64') };
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'Buffer' &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return {
      _type: 'Buffer',
      data: Buffer.from(Uint8Array.from((value as { data: number[] }).data)).toString('base64'),
    };
  }
  return value;
}

/** JSON reviver: restores binary fields as Node Buffers. Buffers, not bare
 *  Uint8Arrays — libsignal's validatePrivKey enforces `instanceof Buffer`
 *  ("Invalid private key type: Uint8Array"), while Buffer (a Uint8Array
 *  subclass) also satisfies every Uint8Array consumer (cipher.update etc.). */
function keyStoreReviver(_key: string, value: unknown): unknown {
  if (
    typeof value === 'object' &&
    value !== null &&
    (value as { _type?: string })._type === 'Buffer' &&
    typeof (value as { data?: string }).data === 'string'
  ) {
    return Buffer.from((value as { data: string }).data, 'base64');
  }
  return value;
}

/**
 * In-memory SignalKeyStore backed by a plain object so it can be
 * JSON-serialised (unlike makeCacheableSignalKeyStore, whose internal
 * Cache is not enumerable and silently serialises to `{}`).
 * The `onSave` callback is invoked after every `set`/`clear` so signal keys
 * (prekeys, identity keys) are persisted immediately — Baileys does NOT fire
 * `creds.update` when it stores signal keys, only when the creds object
 * changes, so without this the keys would be lost on restart.
 */
function makeInMemoryKeyStore(data: KeyStoreData, onSave: () => void): SignalKeyStore {
  return {
    get: async (type: string, ids: string[]) => {
      const typeStore = data[type];
      if (!typeStore) return ids.map(() => undefined);
      return ids.map((id) => typeStore[id] ?? undefined);
    },
    set: async (type: string, items: { id: string; data: Uint8Array | null | undefined }[]) => {
      if (!data[type]) data[type] = {};
      for (const item of items) {
        if (item.data === null || item.data === undefined) {
          delete data[type][item.id];
        } else {
          data[type][item.id] = item.data;
        }
      }
      onSave();
    },
    clear: async () => {
      for (const key of Object.keys(data)) delete data[key];
      onSave();
    },
  } as unknown as SignalKeyStore;
}

/**
 * Pilot bridge (D-092) — worker role only.
 *
 * Owns one Baileys socket per tenant. Pairing starts a socket and exposes the
 * QR via Redis (API role reads it); on `connection.update open` the session
 * credential is stored AES-256-GCM encrypted and the session flips to PAIRED.
 * Inbound messages are gated by the allowlist and normalized into
 * NormalizedInboundMessage, then enqueued on WHATSAPP_INBOUND (jobId
 * `pilot-<key>` for idempotency) so the existing pipeline handles them.
 * Outbound pilot sends (PILOT_SEND_JOB) go through the socket as text.
 */
@Injectable()
export class PilotBridgeService implements OnModuleInit, OnApplicationShutdown {
  private sockets = new Map<string, WASocket>();
  private readonly creds = new Map<string, AuthenticationCreds>();
  private readonly keys = new Map<string, SignalKeyStore>();
  private readonly keyStoreData = new Map<string, KeyStoreData>();
  /** Debounce timers for persisting creds+keys to the DB (Baileys fires many
   *  keys.set() calls in rapid succession during handshake). */
  private readonly persistTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private worker: Worker | null = null;
  private readonly baileysLogger: ReturnType<typeof pino>;
  private readonly qrTtlSeconds: number;
  /** Reconnect backoff (A4): scheduled timers + attempt counters per tenant. */
  private readonly reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly reconnectAttempts = new Map<string, number>();
  /** Bridge liveness heartbeat (A10): per-tenant alive key in Redis. */
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly crypto: CryptoService,
    private readonly uow: UnitOfWork,
    private readonly logger: Logger,
    @Inject(PILOT_SESSION_REPOSITORY) private readonly pilots: PilotSessionRepository,
    @InjectQueue(QUEUES.WHATSAPP_PILOT) private readonly pilotQueue: Queue,
    @InjectQueue(QUEUES.WHATSAPP_INBOUND) private readonly inboundQueue: Queue,
  ) {
    this.qrTtlSeconds = this.config.get('PILOT_QR_TTL_MINUTES', { infer: true }) * 60;
    // Baileys v7 calls logger.child() internally; nestjs-pino's Logger proxy
    // doesn't expose .child(), so build a real pino logger for the socket.
    this.baileysLogger = pino({ level: 'info', base: { service: 'wakeel-pilot' } });
  }

  onModuleInit(): void {
    if (this.config.get('PILOT_BRIDGE_ENABLED', { infer: true }) !== 'true') {
      this.logger.warn('Pilot bridge disabled (PILOT_BRIDGE_ENABLED unset)');
      return;
    }
    const connection = (this.pilotQueue.opts as { connection?: ConnectionOptions }).connection;
    if (!connection) {
      throw new Error('Pilot bridge could not resolve Redis connection from queue options');
    }

    this.worker = new Worker(
      QUEUES.WHATSAPP_PILOT,
      (job: Job) => this.process(job),
      { connection, concurrency: 5 },
    );
    this.worker.on('error', (error: Error) => {
      this.logger.error({ error: error.message }, 'pilot worker error');
    });
    this.worker.on('failed', (job, error) => {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error({ jobId: job?.id, error: err.message }, 'pilot job failed');
    });

    // Bridge liveness heartbeat (A10): every connected socket refreshes a
    // per-tenant alive key; the API surfaces it as `bridgeAlive` on /status.
    this.heartbeat = setInterval(() => {
      for (const tenantId of this.sockets.keys()) {
        void this.markAlive(tenantId);
      }
    }, 60_000);
    this.heartbeat.unref?.();

    // Boot resume (SaaS lifecycle): every session that was PAIRED when this
    // worker (re)started reconnects automatically from its persisted creds —
    // no QR re-scan after deploys. pair() validates expiry + session presence.
    void this.resumePersistedSessions();

    this.logger.log('Pilot bridge worker started');
  }

  private async resumePersistedSessions(): Promise<void> {
    try {
      const client = await queueRedisClient(this.pilotQueue);
      const markers = await client.keys(resumeRedisKey('*'));
      for (const marker of markers) {
        const tenantId = marker.slice(resumeRedisKey('').length);
        if (!UUID_LIKE.test(tenantId)) continue;
        this.logger.log({ tenantId }, 'resuming pilot session after worker restart');
        void this.pair(tenantId).catch((error: unknown) => {
          this.logger.error({ tenantId, error: (error as Error).message }, 'pilot resume failed');
        });
      }
    } catch (error) {
      this.logger.warn({ error: (error as Error).message }, 'failed to scan pilot resume markers');
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    for (const timer of this.reconnectTimers.values()) clearTimeout(timer);
    this.reconnectTimers.clear();
    // persistTimers are intentionally NOT cleared here — suspendAll() flushes
    // each of them so the final creds state reaches the DB before exit.
    await this.suspendAll();
    await this.worker?.close();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case PILOT_PAIR_JOB: {
        const { tenantId } = pilotPairJobSchema.parse(job.data);
        await this.pair(tenantId);
        return;
      }
      case PILOT_DISCONNECT_JOB: {
        const { tenantId } = pilotPairJobSchema.parse(job.data);
        await this.disconnect(tenantId);
        return;
      }
      case PILOT_SEND_JOB: {
        const { tenantId, toWaPhone, body } = pilotSendJobSchema.parse(job.data);
        await this.send(tenantId, toWaPhone, body);
        return;
      }
      default:
        this.logger.warn({ name: job.name }, 'unknown pilot job name');
    }
  }

  async pair(tenantId: string): Promise<void> {
    // Silent teardown of any existing socket — remove listeners first so the
    // old socket's close event can't fire the reconnect logic and kill the
    // new socket we're about to create (race condition fix).
    const oldSock = this.sockets.get(tenantId);
    if (oldSock) {
      try {
        oldSock.ev.removeAllListeners('connection.update');
        oldSock.ev.removeAllListeners('creds.update');
        oldSock.ev.removeAllListeners('messages.upsert');
        void oldSock.end(new Error('Pilot session replaced'));
      } catch { /* best-effort */ }
      this.sockets.delete(tenantId);
    }
    this.creds.delete(tenantId);
    this.keys.delete(tenantId);
    this.keyStoreData.delete(tenantId);
    await this.clearQr(tenantId);
    await this.clearAlive(tenantId);

    const session = await this.uow.withTenant(tenantId, async (tx) =>
      this.pilots.findByTenant(tx, tenantId),
    );
    if (!session || session.expiresAt <= new Date()) {
      this.logger.warn({ tenantId }, 'pilot pair skipped: no session or expired');
      return;
    }

    const auth = session.sessionCredsEnc ? this.loadCreds(session.sessionCredsEnc) : null;
    const creds = auth?.creds ?? initAuthCreds();
    const keyData: KeyStoreData = auth?.keyData ?? {};
    const keys = makeInMemoryKeyStore(keyData, () => this.schedulePersist(tenantId));

    this.creds.set(tenantId, creds);
    this.keys.set(tenantId, keys);
    this.keyStoreData.set(tenantId, keyData);

    const sock = makeWASocket({
      auth: { creds, keys },
      printQRInTerminal: false,
      browser: BROWSER,
      logger: this.baileysLogger,
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });
    this.sockets.set(tenantId, sock);
    this.logger.log({ tenantId }, 'pilot socket constructed; connecting');

    sock.ev.on('connection.update', (update) =>
      void this.onConnectionUpdate(tenantId, update),
    );
    sock.ev.on('creds.update', (credsUpdate) =>
      void this.onCredsUpdate(tenantId, credsUpdate),
    );
    sock.ev.on('messages.upsert', (upsert) =>
      void this.onMessagesUpsert(tenantId, upsert),
    );
  }

  async disconnect(tenantId: string): Promise<void> {
    // Cancel any pending auto-reconnect (A4) — a user-initiated disconnect
    // must stay disconnected.
    const timer = this.reconnectTimers.get(tenantId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(tenantId);
    }
    this.reconnectAttempts.delete(tenantId);
    const persistTimer = this.persistTimers.get(tenantId);
    if (persistTimer) {
      clearTimeout(persistTimer);
      this.persistTimers.delete(tenantId);
    }
    const sock = this.sockets.get(tenantId);
    if (sock) {
      void sock.end(new Error('Pilot session closed'));
      this.sockets.delete(tenantId);
    }
    this.creds.delete(tenantId);
    this.keys.delete(tenantId);
    this.keyStoreData.delete(tenantId);
    await this.clearQr(tenantId);
    await this.clearAlive(tenantId);
    await this.clearResumeMarker(tenantId);
    await this.uow.withTenant(tenantId, async (tx) => {
      await this.pilots.upsert(tx, tenantId, { status: 'DISCONNECTED' });
    });
  }

  async disconnectAll(): Promise<void> {
    for (const tenantId of [...this.sockets.keys()]) {
      try {
        await this.disconnect(tenantId);
      } catch (error) {
        this.logger.warn({ tenantId, error: (error as Error).message }, 'disconnect error');
      }
    }
  }

  /**
   * Graceful-shutdown counterpart to disconnectAll: SUSPEND, don't disconnect.
   * Ends the sockets (no dangling WSS) but keeps creds, DB status, and resume
   * markers so the next worker boot resumes sessions without a QR re-scan
   * (D-099). Socket listeners are stripped first so Baileys' close event
   * can't run the disconnect/logout path and wipe the resumable state.
   */
  private async suspendAll(): Promise<void> {
    for (const tenantId of [...this.sockets.keys()]) {
      // Flush pending creds/keys BEFORE clearing in-memory state so the
      // resume starts from the freshest persisted blob.
      const persistTimer = this.persistTimers.get(tenantId);
      if (persistTimer) {
        clearTimeout(persistTimer);
        this.persistTimers.delete(tenantId);
        await this.persistCreds(tenantId).catch(() => { /* best-effort */ });
      }
      const sock = this.sockets.get(tenantId);
      if (sock) {
        try {
          sock.ev.removeAllListeners('connection.update');
          sock.ev.removeAllListeners('creds.update');
          sock.ev.removeAllListeners('messages.upsert');
          void sock.end(new Error('Pilot session suspended (worker shutdown)'));
        } catch { /* best-effort */ }
      }
      this.sockets.delete(tenantId);
      this.creds.delete(tenantId);
      this.keys.delete(tenantId);
      this.keyStoreData.delete(tenantId);
      await this.clearAlive(tenantId); // heartbeat is process-local; resume re-marks it
    }
  }

  private async onConnectionUpdate(tenantId: string, update: Partial<ConnectionState>): Promise<void> {
    if (update.qr) {
      const client = await queueRedisClient(this.pilotQueue);
      await client.set(qrRedisKey(tenantId), update.qr, 'EX', this.qrTtlSeconds);
      return;
    }
    if (update.connection === 'open') {
      this.reconnectAttempts.delete(tenantId);
      await this.clearQr(tenantId);
      await this.markAlive(tenantId);
      await this.setResumeMarker(tenantId);
      await this.uow.withTenant(tenantId, async (tx) => {
        await this.pilots.upsert(tx, tenantId, {
          status: 'PAIRED',
          lastSeenAt: new Date(),
          lastError: null,
          lastErrorAt: null,
        });
      });
      this.logger.log({ tenantId }, 'pilot session paired');
      return;
    }
    if (update.connection === 'close') {
      const lastDisconnect = update.lastDisconnect as { error?: unknown } | undefined;
      // Baileys wraps the close reason in a Boom error whose statusCode is
      // the DisconnectReason (A4): 401/403 = device logged out; 428 = another
      // device took the session over; 515/stream errors = transient and
      // reconnectable. String-matching is unreliable.
      const err = (lastDisconnect?.error ?? null) as {
        statusCode?: number;
        output?: { statusCode?: number };
      } | null;
      const statusCode = err?.output?.statusCode ?? err?.statusCode ?? null;
      const isLoggedOut = statusCode === 401 || statusCode === 403 || statusCode === 428;
      // Deliberate teardown (pair/disconnect) removes the map entry before
      // the close event lands — those closes must not auto-reconnect.
      const isReplacing = !this.sockets.has(tenantId);

      // Flush any debounced persist BEFORE clearing in-memory state, so the
      // 515 restart can reload the latest signal keys from the DB.
      const pendingTimer = this.persistTimers.get(tenantId);
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        this.persistTimers.delete(tenantId);
        await this.persistCreds(tenantId);
      }

      this.sockets.delete(tenantId);
      this.creds.delete(tenantId); // A12: pair() reloads creds from the DB blob
      this.keys.delete(tenantId);
      this.keyStoreData.delete(tenantId);
      await this.clearAlive(tenantId);

      if (isLoggedOut) {
        await this.clearResumeMarker(tenantId);
        await this.uow.withTenant(tenantId, async (tx) => {
          await this.pilots.upsert(tx, tenantId, {
            status: 'DISCONNECTED',
            sessionCredsEnc: null,
            lastError: statusCode === 428
              ? 'This WhatsApp number was paired on another device — pair again'
              : 'The WhatsApp device link was revoked — pair again',
            lastErrorAt: new Date(),
          });
        });
        this.logger.warn({ tenantId, statusCode }, 'pilot session logged out — creds cleared, re-pair required');
        return;
      }
      if (isReplacing) return;

      // Transient close (restart-required 515, stream errors, network blips):
      // schedule a reconnect with capped exponential backoff (A4). Repeated
      // failures (e.g. corrupted creds crashing the handshake) escalate to a
      // terminal DISCONNECTED instead of looping forever.
      this.scheduleReconnect(tenantId, statusCode);
    }
  }

  /**
   * Capped exponential backoff reconnect (A4): 4s, 8s, 16s, 32s, 60s, 60s…
   * After MAX_RECONNECT_ATTEMPTS consecutive failures the session goes
   * terminal: creds cleared, DISCONNECTED with a reason, no marker (no boot
   * resume). A fresh pair resets everything.
   */
  private scheduleReconnect(tenantId: string, statusCode: number | null): void {
    if (this.reconnectTimers.has(tenantId)) return;
    const attempt = (this.reconnectAttempts.get(tenantId) ?? 0) + 1;
    if (attempt > MAX_RECONNECT_ATTEMPTS) {
      this.logger.error(
        { tenantId, attempt },
        'pilot failed to reconnect after repeated attempts — marking session terminal',
      );
      void this.terminalFailure(tenantId);
      return;
    }
    this.reconnectAttempts.set(tenantId, attempt);
    const delayMs = Math.min(2000 * 2 ** Math.min(attempt, 5), 60_000);
    this.logger.warn({ tenantId, attempt, delayMs, statusCode }, 'pilot socket closed — scheduling reconnect');
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(tenantId);
      void this.pair(tenantId).catch((error: unknown) => {
        this.logger.error({ tenantId, error: (error as Error).message }, 'pilot reconnect failed');
        this.scheduleReconnect(tenantId, null);
      });
    }, delayMs);
    timer.unref?.();
    this.reconnectTimers.set(tenantId, timer);
  }

  /** Terminal failure: stop retrying, clear creds, record the reason. */
  private async terminalFailure(tenantId: string): Promise<void> {
    this.reconnectAttempts.delete(tenantId);
    const timer = this.reconnectTimers.get(tenantId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(tenantId);
    }
    await this.clearResumeMarker(tenantId);
    await this.uow.withTenant(tenantId, async (tx) => {
      await this.pilots.upsert(tx, tenantId, {
        status: 'DISCONNECTED',
        sessionCredsEnc: null,
        lastError: 'The bridge could not re-establish the WhatsApp session — pair again',
        lastErrorAt: new Date(),
      });
    }).catch((error: unknown) => {
      this.logger.error({ tenantId, error: (error as Error).message }, 'failed to mark pilot session terminal');
    });
  }

  private async setResumeMarker(tenantId: string): Promise<void> {
    try {
      const client = await queueRedisClient(this.pilotQueue);
      await client.set(resumeRedisKey(tenantId), '1', 'EX', 7 * 24 * 3600);
    } catch (error) {
      this.logger.warn({ tenantId, error: (error as Error).message }, 'failed to set pilot resume marker');
    }
  }

  private async clearResumeMarker(tenantId: string): Promise<void> {
    try {
      const client = await queueRedisClient(this.pilotQueue);
      await client.del(resumeRedisKey(tenantId));
    } catch {
      // Best-effort; terminal states also clear creds so a stale marker just
      // triggers one skipped resume (pair() guards on missing/expired creds).
    }
  }

  private async markAlive(tenantId: string): Promise<void> {
    try {
      const client = await queueRedisClient(this.pilotQueue);
      await client.set(aliveRedisKey(tenantId), String(Date.now()), 'EX', ALIVE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn({ tenantId, error: (error as Error).message }, 'failed to write pilot alive key');
    }
  }

  private async clearAlive(tenantId: string): Promise<void> {
    try {
      const client = await queueRedisClient(this.pilotQueue);
      await client.del(aliveRedisKey(tenantId));
    } catch {
      // TTL expiry handles it; alive-key cleanup is best-effort.
    }
  }

  /** Debounced persist: Baileys fires many keys.set() + creds.update events
   *  in rapid succession during handshake. Coalesce them into one DB write. */
  private schedulePersist(tenantId: string): void {
    const existing = this.persistTimers.get(tenantId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.persistTimers.delete(tenantId);
      void this.persistCreds(tenantId);
    }, PERSIST_DEBOUNCE_MS);
    timer.unref?.();
    this.persistTimers.set(tenantId, timer);
  }

  private async persistCreds(tenantId: string): Promise<void> {
    try {
      const keyData = this.keyStoreData.get(tenantId) ?? {};
      const saved = this.creds.get(tenantId) ?? initAuthCreds();
      const encrypted = this.crypto.encrypt(JSON.stringify({ creds: saved, keys: keyData }, keyStoreReplacer));
      await this.uow.withTenant(tenantId, async (tx) => {
        await this.pilots.upsert(tx, tenantId, { sessionCredsEnc: encrypted });
      });
    } catch (error) {
      this.logger.error({ tenantId, error: (error as Error).message }, 'failed to persist pilot creds');
    }
  }

  /**
   * Baileys emits 'creds.update' with PARTIAL objects (e.g. `{ me: … }` or
   * `{ myAppStateKeyId }` — see lib/Socket/messages-recv.js), while also
   * mutating the creds object we passed to makeWASocket in place. The
   * reference we hold in `this.creds` IS the live object, so we merge the
   * partial into it — never replace it. (Replacing it with a partial wiped
   * noiseKey/signedIdentityKey, and the post-515 reload crashed with
   * "Cannot read properties of undefined (reading 'public')".)
   */
  private onCredsUpdate(tenantId: string, partial: Partial<AuthenticationCreds>): void {
    const current = this.creds.get(tenantId);
    if (current) Object.assign(current, partial);
    this.schedulePersist(tenantId);
  }

  private async onMessagesUpsert(
    tenantId: string,
    upsert: { messages: WAMessage[]; type: MessageUpsertType },
  ): Promise<void> {
    let allowlistedAny = false;
    for (const message of upsert.messages) {
      const normalized = this.normalize(tenantId, message);
      if (!normalized) continue;

      const allowlisted = await this.ensureAllowlisted(tenantId, normalized.fromWaPhone);
      if (!allowlisted) {
        this.logger.warn({ tenantId, from: normalized.fromWaPhone }, 'pilot inbound blocked by allowlist');
        continue;
      }
      allowlistedAny = true;

      const jobId = `pilot-${message.key?.id ?? normalized.wamid}`;
      const queued = await this.inboundQueue.getJob(jobId);
      if (queued) continue; // already enqueued (at-least-once)
      await this.inboundQueue.add(
        'process',
        { tenantId, message: { ...normalized, sentAt: normalized.sentAt.toISOString() } },
        { jobId, attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: { age: 3600, count: 5000 } },
      );
    }
    // Inbound activity is real liveness (A10): lastSeenAt used to move only
    // on connect/send, leaving healthy receiving sessions looking stale.
    if (allowlistedAny) await this.touchLastSeen(tenantId);
  }

  /**
   * Outbound pilot send. Throws instead of dropping (A1): the job then
   * retries via BullMQ backoff and lands in the failed set — an honest,
   * visible signal — rather than completing successfully after a silent loss.
   */
  private async send(tenantId: string, toWaPhone: string, body: Record<string, unknown>): Promise<void> {
    const sock = this.sockets.get(tenantId);
    if (!sock) {
      throw new Error('pilot send failed: no live socket for tenant — re-pair the pilot session');
    }
    if (body?.type !== 'text' || typeof (body.text as Record<string, unknown> | undefined)?.body !== 'string') {
      throw new Error(`pilot send failed: unsupported body type ${String(body?.type)}`);
    }
    const jid = `${toWaPhone}@s.whatsapp.net`;
    const text = (body.text as Record<string, unknown>).body as string;
    const result = await sock.sendMessage(jid, { text });
    await this.touchLastSeen(tenantId);
    this.logger.log(
      { tenantId, to: toWaPhone, wamid: result?.key?.id ?? null },
      'pilot send delivered',
    );
  }

  private async touchLastSeen(tenantId: string): Promise<void> {
    await this.markAlive(tenantId);
    await this.uow.withTenant(tenantId, async (tx) => {
      await this.pilots.upsert(tx, tenantId, { lastSeenAt: new Date() });
    });
  }

  private async isAllowlisted(tenantId: string, fromWaPhone: string): Promise<boolean> {
    const session = await this.uow.withTenant(tenantId, async (tx) =>
      this.pilots.findByTenant(tx, tenantId),
    );
    return !!session && session.allowlist.some((entry) => entry.number === fromWaPhone);
  }

  /**
   * Auto-allowlist inbound senders up to PILOT_MAX_ALLOWLIST. This makes the
   * free pilot bridge behave like an open WhatsApp inbox: any customer who
   * messages the connected number can reach the AI. A hard cap prevents
   * unbounded growth and the UI warns that pilot is not a production-grade
   * replacement for the official Meta Cloud API.
   */
  private async ensureAllowlisted(tenantId: string, fromWaPhone: string): Promise<boolean> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const session = await this.pilots.findByTenant(tx, tenantId);
      if (!session) return false;
      if (session.allowlist.some((entry) => entry.number === fromWaPhone)) return true;

      const max = this.config.get('PILOT_MAX_ALLOWLIST', { infer: true });
      if (session.allowlist.length >= max) {
        this.logger.warn(
          { tenantId, from: fromWaPhone, cap: max },
          'pilot auto-allowlist skipped: cap reached',
        );
        return false;
      }

      await this.pilots.upsert(tx, tenantId, {
        allowlist: [...session.allowlist, { number: fromWaPhone, label: null }],
      });
      this.logger.log(
        { tenantId, from: fromWaPhone },
        'pilot auto-added inbound number to allowlist',
      );
      return true;
    });
  }

  private loadCreds(encrypted: string): { creds: AuthenticationCreds; keyData: KeyStoreData } | null {
    try {
      const parsed = JSON.parse(this.crypto.decrypt(encrypted), keyStoreReviver) as {
        creds: AuthenticationCreds;
        keys: KeyStoreData;
      };
      if (!parsed.creds || !parsed.keys) return null;
      return {
        creds: parsed.creds,
        keyData: parsed.keys,
      };
    } catch (error) {
      this.logger.warn({ error: (error as Error).message }, 'failed to load pilot creds');
      return null;
    }
  }

  private async clearQr(tenantId: string): Promise<void> {
    const client = await queueRedisClient(this.pilotQueue);
    await client.del(qrRedisKey(tenantId));
  }

  /**
   * Maps a Baileys WebMessageInfo to our normalized inbound shape. Returns
   * null for messages we must not process (own sends, groups, status
   * broadcasts, protocol/retry messages).
   */
  private normalize(tenantId: string, info: WAMessage): NormalizedInboundMessage | null {
    void tenantId;
    if (info.key?.fromMe) return null;
    const jid: string = (info.key?.remoteJid ?? '') as string;
    if (!jid || jid.endsWith('@g.us')) return null; // groups not supported in pilot
    if (jid === 'status@broadcast') return null;

    const msg = info.message ?? {};
    const textMsg = msg.conversation ?? msg.extendedTextMessage?.text;
    const image = msg.imageMessage;
    const audio = msg.audioMessage;
    const video = msg.videoMessage;
    const doc = msg.documentMessage;
    const location = msg.locationMessage;
    const sticker = msg.stickerMessage;
    const interactive = msg.interactiveResponseMessage ?? msg.buttonsResponseMessage;

    let contentType: NormalizedInboundMessage['contentType'] = 'TEXT';
    let body: string | null = null;
    const payload: Record<string, unknown> = {};

    if (typeof textMsg === 'string' && textMsg.length > 0) {
      body = textMsg;
    } else if (image) {
      contentType = 'IMAGE';
      body = image.caption ?? null;
    } else if (audio) {
      contentType = 'AUDIO';
    } else if (video) {
      contentType = 'VIDEO';
      body = video.caption ?? null;
    } else if (doc) {
      contentType = 'DOCUMENT';
      body = doc.caption ?? null;
    } else if (location) {
      contentType = 'LOCATION';
      payload.latitude = location.degreesLatitude ?? null;
      payload.longitude = location.degreesLongitude ?? null;
    } else if (sticker) {
      contentType = 'STICKER';
    } else if (interactive) {
      // Extract what the client actually selected (A8): without this the
      // normalized body stays null and the AI never learns which button or
      // list row the client tapped.
      contentType = 'INTERACTIVE';
      const selectedId =
        msg.buttonsResponseMessage?.selectedButtonId ??
        msg.listResponseMessage?.singleSelectReply?.selectedRowId ??
        null;
      const paramsJson = msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
      body =
        selectedId ??
        (typeof paramsJson === 'string' && paramsJson.length > 0 ? paramsJson : null);
      if (selectedId) payload.selectedId = selectedId;
    } else if (msg.protocolMessage) {
      return null; // retry/poll events — never AI-visible
    } else {
      contentType = 'OTHER';
    }

    const fromWaPhone: string = jid.split('@')[0] ?? '';
    const timestamp = info.messageTimestamp as number | Date | { toNumber(): number } | undefined;
    const sentAt =
      typeof timestamp === 'number'
        ? new Date(Math.round(timestamp * 1000))
        : timestamp instanceof Date
          ? timestamp
          : // Baileys timestamps are frequently Long objects (A8 fix): a Long
            // that fell through here silently became "now", skewing intake.
            typeof timestamp?.toNumber === 'function'
            ? new Date(Math.round(timestamp.toNumber() * 1000))
            : new Date();

    const wamidRaw = info.key?.id ?? 'unknown';

    return {
      wamid: `pilot:${wamidRaw}`,
      fromWaPhone,
      fromDisplayName: info.pushName ?? null,
      contentType,
      body,
      mediaId: null, // pilot media download is out of scope (D-092)
      payload,
      sentAt,
    };
  }
}
