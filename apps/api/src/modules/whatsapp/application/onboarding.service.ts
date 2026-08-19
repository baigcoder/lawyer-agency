import { Inject, Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { Env } from '../../../config/env';
import {
  META_OAUTH_CLIENT,
  WHATSAPP_ACCOUNT_REPOSITORY,
  type ConnectionStage,
  type MetaOAuthClient,
  type WhatsappAccountRepository,
} from './ports';
import { TemplateSyncService } from './template-sync.service';
import { WhatsappUpgradeService } from './whatsapp-upgrade.service';
import { PilotApiService } from './pilot-api.service';

export interface OnboardingStart {
  appId: string;
  redirectUri: string | null;
  scopes: string[];
}

export interface OnboardingResult {
  tenantId: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  templatesSeeded: number;
  connectionStage: ConnectionStage;
}

export interface WhatsappConnectionStatus {
  connected: boolean;
  provider: 'META_CLOUD';
  verificationStatus: 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  connectionStage: ConnectionStage;
  displayPhoneNumber: string | null;
  wabaId: string | null;
  templates: {
    approved: number;
    pending: number;
    rejected: number;
    paused: number;
  };
}

export interface WhatsappConnectionHealth {
  connectionStage: ConnectionStage;
  verificationStatus: 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  displayPhoneNumber: string | null;
  webhookConfigured: boolean;
  webhookVerifyTokenPresent: boolean;
  goLiveChecklist: GoLiveChecklist;
  templates: {
    approved: number;
    pending: number;
    rejected: number;
    paused: number;
  };
}

export interface GoLiveChecklist {
  accountConnected: boolean;
  numberVerified: boolean;
  hasApprovedTemplates: boolean;
  readyForGoLive: boolean;
}

/**
 * Embedded Signup completion (Phase 6b): exchange code → token → WABA info,
 * then write whatsapp_account + platform.wa_routes and seed the default
 * template pack. Token is encrypted at rest (D-024).
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly uow: UnitOfWork,
    private readonly crypto: CryptoService,
    @Inject(META_OAUTH_CLIENT) private readonly oauth: MetaOAuthClient,
    @Inject(WHATSAPP_ACCOUNT_REPOSITORY) private readonly accounts: WhatsappAccountRepository,
    private readonly templateSync: TemplateSyncService,
    private readonly upgrade: WhatsappUpgradeService,
    private readonly pilotApi: PilotApiService,
  ) {}

  async start(tenantId: string): Promise<OnboardingStart> {
    const status = await this.upgrade.status(tenantId);
    if (!status.enabled) {
      throw new ForbiddenException(
        'Official WhatsApp is a paid upgrade. Complete payment before connecting.',
      );
    }
    return {
      appId: this.config.get('META_APP_ID', { infer: true }) ?? '',
      redirectUri: this.config.get('META_REDIRECT_URI', { infer: true }) ?? null,
      scopes: ['whatsapp_business_management', 'business_management'],
    };
  }

  /** Dashboard-safe connection summary. Secrets and access tokens never leave
   * the server; the UI only receives the state needed to guide an admin. */
  async connectionStatus(tenantId: string): Promise<WhatsappConnectionStatus> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const account = await tx.whatsappAccount.findFirst({
        where: { tenantId },
        select: {
          wabaId: true,
          displayPhoneNumber: true,
          verificationStatus: true,
          connectionStage: true,
        },
      });
      const templates = await tx.whatsappTemplate.findMany({
        where: { tenantId },
        select: { status: true },
      });
      const counts = { approved: 0, pending: 0, rejected: 0, paused: 0 };
      for (const template of templates) {
        if (template.status === 'APPROVED') counts.approved += 1;
        if (template.status === 'SUBMITTED') counts.pending += 1;
        if (template.status === 'REJECTED') counts.rejected += 1;
        if (template.status === 'PAUSED') counts.paused += 1;
      }
      return {
        connected: account?.verificationStatus === 'VERIFIED',
        provider: 'META_CLOUD',
        verificationStatus: account?.verificationStatus ?? 'NOT_STARTED',
        connectionStage: account?.connectionStage ?? 'OFFICIAL_CONNECT_STARTED',
        displayPhoneNumber: account?.displayPhoneNumber ?? null,
        wabaId: account?.wabaId ?? null,
        templates: counts,
      };
    });
  }

  async complete(tenantId: string, code: string): Promise<OnboardingResult> {
    const status = await this.upgrade.status(tenantId);
    if (!status.enabled) {
      throw new ForbiddenException(
        'Official WhatsApp is a paid upgrade. Complete payment before connecting.',
      );
    }
    const token = await this.oauth.exchangeCode(code);
    const info = await this.oauth.getWabaInfo(token.accessToken);
    const accessTokenEnc = this.crypto.encrypt(token.accessToken);

    // 1. Account lands NUMBER_VERIFIED (successful code exchange + WABA read).
    //    Separate UoW scopes — seedDefaultTemplates owns its transaction and
    //    nested interactive transactions are not supported (D-019).
    await this.uow.withTenant(tenantId, async (tx) => {
      await tx.whatsappAccount.upsert({
        where: { tenantId },
        create: {
          tenantId,
          wabaId: info.wabaId,
          phoneNumberId: info.phoneNumberId,
          displayPhoneNumber: info.displayPhoneNumber,
          verificationStatus: 'VERIFIED',
          connectionStage: 'NUMBER_VERIFIED',
          accessTokenEnc,
        },
        update: {
          wabaId: info.wabaId,
          phoneNumberId: info.phoneNumberId,
          displayPhoneNumber: info.displayPhoneNumber,
          verificationStatus: 'VERIFIED',
          connectionStage: 'NUMBER_VERIFIED',
          accessTokenEnc,
        },
      });
    });

    // 2. Seed the starter template pack (own transaction).
    const { seeded } = await this.templateSync.seedDefaultTemplates(tenantId);

    // 3. Advance past template readiness (TEMPLATES_PENDING / READY_TO_GO_LIVE).
    //    The advance logic lives in TemplateSyncService (B1) so webhook and
    //    manual syncs advance the stage identically after onboarding.
    const stage = await this.uow.withTenant(tenantId, async (tx) =>
      this.templateSync.advanceConnectionStage(tx, tenantId),
    );

    await this.uow.withPlatform(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO platform.wa_routes ("phoneNumberId", "tenantId", "wabaId")
        VALUES (${info.phoneNumberId}, ${tenantId}::uuid, ${info.wabaId})
        ON CONFLICT ("phoneNumberId") DO UPDATE
        SET "tenantId" = EXCLUDED."tenantId", "wabaId" = EXCLUDED."wabaId"`;
    });

    return { tenantId, ...info, templatesSeeded: seeded, connectionStage: stage };
  }

  /** Admin go-live gate: LIVE only from READY_TO_GO_LIVE with ≥1 approved template. */
  async goLive(tenantId: string): Promise<{ connectionStage: ConnectionStage }> {
    const result = await this.uow.withTenant(tenantId, async (tx) => {
      const account = await tx.whatsappAccount.findFirst({
        where: { tenantId },
        select: { connectionStage: true, verificationStatus: true },
      });
      if (!account) throw new NotFoundException('No WhatsApp account — complete onboarding first');
      if (account.connectionStage !== 'READY_TO_GO_LIVE') {
        throw new ConflictException(`Cannot go live from stage ${account.connectionStage} — READY_TO_GO_LIVE required`);
      }
      if (account.verificationStatus !== 'VERIFIED') {
        throw new ConflictException('Number is not verified with Meta yet');
      }
      const approved = await tx.whatsappTemplate.count({
        where: { tenantId, status: 'APPROVED' },
      });
      if (approved === 0) {
        throw new ConflictException('At least one APPROVED template is required to go live');
      }
      await tx.whatsappAccount.updateMany({ where: { tenantId }, data: { connectionStage: 'LIVE' } });
      return { connectionStage: 'LIVE' as const };
    });

    // Once the official connection is live, the free pilot bridge must stop
    // being used so the two paths never serve clients simultaneously.
    try {
      await this.pilotApi.disconnect(tenantId);
    } catch (error) {
      // Non-fatal: the official connection is already live; pilot disconnect
      // will be retried or can be cleaned up manually.
      const message = error instanceof Error ? error.message : String(error);
      if (this.config.get('NODE_ENV', { infer: true }) !== 'test') {
        console.warn(`Failed to disconnect pilot after official go-live: ${message}`);
      }
    }

    return result;
  }

  /** Disconnect: stops official sends by clearing the stored token and marking DISCONNECTED. */
  async disconnect(tenantId: string): Promise<{ connectionStage: ConnectionStage }> {
    // Stops official sends (token cleared) and removes the wa_routes row so
    // inbound webhooks for this number no longer resolve to the tenant (B3).
    const phoneNumberId = await this.uow.withTenant(tenantId, async (tx) => {
      const account = await tx.whatsappAccount.findFirst({
        where: { tenantId },
        select: { phoneNumberId: true },
      });
      if (!account) throw new NotFoundException('No WhatsApp account to disconnect');
      await tx.whatsappAccount.updateMany({
        where: { tenantId },
        data: { connectionStage: 'DISCONNECTED', accessTokenEnc: null },
      });
      return account.phoneNumberId;
    });

    await this.uow.withPlatform(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM platform.wa_routes WHERE "phoneNumberId" = ${phoneNumberId}`;
    });

    return { connectionStage: 'DISCONNECTED' as const };
  }

  /** `/v1/whatsapp/health` payload: stage + webhook wiring + go-live checklist. */
  async health(tenantId: string): Promise<WhatsappConnectionHealth> {
    const status = await this.connectionStatus(tenantId);
    const webhookVerifyTokenPresent = Boolean(this.config.get('META_WEBHOOK_VERIFY_TOKEN', { infer: true }));
    // Webhook "configured" = the API can both receive (verify token) and the
    // Meta app id exists for subscription checks; a full Graph API probe is
    // Phase 6b territory — this is the wiring signal the dashboard needs.
    const webhookConfigured = webhookVerifyTokenPresent && Boolean(this.config.get('META_APP_ID', { infer: true }));
    return {
      connectionStage: status.connectionStage,
      verificationStatus: status.verificationStatus,
      displayPhoneNumber: status.displayPhoneNumber,
      webhookConfigured,
      webhookVerifyTokenPresent,
      goLiveChecklist: {
        accountConnected: status.wabaId !== null,
        numberVerified: status.verificationStatus === 'VERIFIED',
        hasApprovedTemplates: status.templates.approved > 0,
        readyForGoLive:
          status.connectionStage === 'READY_TO_GO_LIVE' &&
          status.verificationStatus === 'VERIFIED' &&
          status.templates.approved > 0,
      },
      templates: status.templates,
    };
  }
}
