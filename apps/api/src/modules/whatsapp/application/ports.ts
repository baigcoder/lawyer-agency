import type { DbTx } from '../../../common/persistence/db-tx';

export interface WaRoute {
  tenantId: string;
  wabaId: string;
}

/**
 * Pre-tenant routing: webhook payloads carry only Meta's phone_number_id;
 * this lookup (platform.wa_routes, infrastructure table — D-040) resolves
 * it to a tenant before any RLS-scoped work can begin.
 */
export interface WaRouteLookup {
  findByPhoneNumberId(phoneNumberId: string): Promise<WaRoute | null>;
}

export interface WhatsappAccountRecord {
  tenantId: string;
  wabaId: string;
  phoneNumberId: string;
  accessTokenEnc: string | null;
  connectionStage: ConnectionStage;
}

/**
 * Phase 3 connection state machine (D-092): the go-live journey of the
 * official Meta connection. Mirrors the Prisma enum of the same name;
 * application code must never import the generated client.
 */
export type ConnectionStage =
  | 'OFFICIAL_CONNECT_STARTED'
  | 'META_PENDING_VERIFICATION'
  | 'NUMBER_VERIFIED'
  | 'TEMPLATES_PENDING'
  | 'READY_TO_GO_LIVE'
  | 'LIVE'
  | 'PAUSED'
  | 'REJECTED'
  | 'DISCONNECTED';

/** Tenant-scoped: always called inside UnitOfWork.withTenant. */
export interface WhatsappAccountRepository {
  findByTenant(tx: DbTx, tenantId: string): Promise<WhatsappAccountRecord | null>;
  /** Advance the connection stage; call sites own transition validation. */
  updateConnectionStage(
    tx: DbTx,
    tenantId: string,
    stage: ConnectionStage,
    patch?: { verificationStatus?: 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED'; clearToken?: boolean },
  ): Promise<void>;
}

export interface SendResult {
  wamid: string;
}

export interface OAuthToken {
  accessToken: string;
  expiresAt?: Date | undefined;
}

export interface WabaInfo {
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
}

export interface MetaOAuthClient {
  exchangeCode(code: string): Promise<OAuthToken>;
  getWabaInfo(accessToken: string): Promise<WabaInfo>;
}

export const META_OAUTH_CLIENT = Symbol('META_OAUTH_CLIENT');

export interface MediaDownloadResult {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

export interface MetaTemplate {
  metaTemplateId: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: Record<string, unknown>[];
  rejectionReason?: string | null;
}

/** Vendor port — the only surface that knows Graph API wire shapes. */
export interface MetaCloudApi {
  postMessage(params: {
    accessToken: string;
    phoneNumberId: string;
    body: Record<string, unknown>;
  }): Promise<SendResult>;

  listTemplates(params: { accessToken: string; wabaId: string }): Promise<MetaTemplate[]>;

  /** Download media bytes from Meta's CDN via the Graph API media endpoint. */
  downloadMedia(params: { accessToken: string; mediaId: string }): Promise<MediaDownloadResult>;

  /** WhatsApp Cloud Calling actions (D-124): pre_accept / accept / reject / terminate. */
  postCall(params: {
    accessToken: string;
    phoneNumberId: string;
    body: Record<string, unknown>;
  }): Promise<void>;
}

export interface UpsertTemplateInput {
  name: string;
  language: string;
  category: string;
  status: string;
  components: Record<string, unknown>[];
  metaTemplateId?: string | null;
  rejectionReason?: string | null;
}

/** Tenant-scoped template store. Always called inside UnitOfWork.withTenant. */
export interface WhatsappTemplateRepository {
  findByNameAndLanguage(tx: DbTx, tenantId: string, name: string, language: string): Promise<{ id: string; status: string } | null>;
  countApproved(tx: DbTx, tenantId: string): Promise<number>;
  upsert(tx: DbTx, tenantId: string, input: UpsertTemplateInput): Promise<void>;
  updateStatusByMetaId(
    tx: DbTx,
    tenantId: string,
    metaTemplateId: string,
    status: string,
    rejectionReason?: string | null,
  ): Promise<boolean>;
}

export const WA_ROUTE_LOOKUP = Symbol('WA_ROUTE_LOOKUP');
export const WHATSAPP_ACCOUNT_REPOSITORY = Symbol('WHATSAPP_ACCOUNT_REPOSITORY');
export const WHATSAPP_TEMPLATE_REPOSITORY = Symbol('WHATSAPP_TEMPLATE_REPOSITORY');
export const META_CLOUD_API = Symbol('META_CLOUD_API');

// --- Evolution API transport (replaces pilot + official Meta) ---

export type EvolutionConnectionType = 'baileys' | 'cloud_api';
export type EvolutionConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface WhatsappConnectionRecord {
  tenantId: string;
  instanceName: string;
  connectionType: EvolutionConnectionType;
  status: EvolutionConnectionStatus;
  phoneNumber: string | null;
  displayName: string | null;
}

/** Tenant-scoped: always called inside UnitOfWork.withTenant. */
export interface WhatsappConnectionRepository {
  findByTenant(tx: DbTx, tenantId: string): Promise<WhatsappConnectionRecord | null>;
  upsert(
    tx: DbTx,
    tenantId: string,
    data: Partial<Omit<WhatsappConnectionRecord, 'tenantId'>>,
  ): Promise<void>;
  remove(tx: DbTx, tenantId: string): Promise<void>;
}

export const WHATSAPP_CONNECTION_REPOSITORY = Symbol('WHATSAPP_CONNECTION_REPOSITORY');

// --- Pilot bridge (D-092) ---

export type PilotSessionStatus = 'PAIRING' | 'PAIRED' | 'EXPIRED' | 'DISCONNECTED';

/** One allowlist entry (A9): E.164 number (no '+') plus an optional label. */
export interface PilotAllowlistEntry {
  number: string;
  label: string | null;
}

export interface PilotSessionRecord {
  tenantId: string;
  status: PilotSessionStatus;
  /** E.164 numbers (no '+') allowed to talk to the pilot bridge, with labels. */
  allowlist: PilotAllowlistEntry[];
  /** AES-256-GCM ciphertext of Baileys session creds (never plaintext). */
  sessionCredsEnc: string | null;
  expiresAt: Date;
  lastSeenAt: Date | null;
  /** Terminal failure reason (handshake exhausted / logged out), if any. */
  lastError: string | null;
  lastErrorAt: Date | null;
}

/** Tenant-scoped: always called inside UnitOfWork.withTenant. */
export interface PilotSessionRepository {
  findByTenant(tx: DbTx, tenantId: string): Promise<PilotSessionRecord | null>;
  upsert(tx: DbTx, tenantId: string, data: Partial<Omit<PilotSessionRecord, 'tenantId'>>): Promise<void>;
}

export const PILOT_SESSION_REPOSITORY = Symbol('PILOT_SESSION_REPOSITORY');

/**
 * Outbound sender seam (D-092): routes a send to the pilot bridge when the
 * tenant has a paired, unexpired pilot session whose allowlist includes the
 * recipient; otherwise falls through to the official Meta Cloud API. The
 * pilot branch is also available in production for the free tier, with
 * auto-allowlisted inbound numbers capped at PILOT_MAX_ALLOWLIST.
 *
 * Called from within an active withTenant transaction (the caller owns the
 * tx and the RLS GUC — nested interactive transactions are not supported).
 */
export interface OutboundSender {
  postMessage(params: {
    tenantId: string;
    toWaPhone: string;
    body: Record<string, unknown>;
    tx: DbTx;
  }): Promise<SendResult>;
}

export const OUTBOUND_SENDER = Symbol('OUTBOUND_SENDER');

// Re-export domain errors that are part of the WhatsApp application contract
// (thrown by SendService / DocumentsService collaborators).
export { TenantCredentialsMissingError } from '../domain/errors';

/** Object storage port — implemented by filesystem in dev, Supabase S3 in production. */
export interface ObjectStorage {
  put(path: string, buffer: Buffer): Promise<{ path: string }>;
  get(path: string): Promise<Buffer>;
  getUrl(path: string): string;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export type WhatsappCallAction = 'pre_accept' | 'accept' | 'reject' | 'terminate';

export interface WhatsappCallActionInput {
  tenantId: string;
  instanceName: string;
  providerCallId: string;
  action: WhatsappCallAction;
  sdpAnswer?: string | undefined;
}

export interface WhatsappCallingPort {
  sendCallAction(input: WhatsappCallActionInput): Promise<void>;
}

export const WHATSAPP_CALLING = Symbol('WHATSAPP_CALLING');
