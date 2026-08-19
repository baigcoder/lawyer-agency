import { Inject, Injectable } from '@nestjs/common';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { DbTx } from '../../../common/persistence/db-tx';
import {
  META_CLOUD_API,
  WHATSAPP_ACCOUNT_REPOSITORY,
  WHATSAPP_TEMPLATE_REPOSITORY,
  type ConnectionStage,
  type MetaCloudApi,
  type WhatsappAccountRepository,
  type WhatsappTemplateRepository,
} from './ports';
import { TenantCredentialsMissingError } from '../domain/errors';

export interface TemplateStatusUpdate {
  metaTemplateId: string;
  status: string;
  rejectionReason?: string | null;
}

/** Terminal/resting stages a template event must never move (D-092). */
const SETTLED_STAGES: readonly ConnectionStage[] = ['LIVE', 'PAUSED', 'REJECTED', 'DISCONNECTED'];

/**
 * Template lifecycle management (Phase 6b):
 *  - Seed a default utility template pack for a new tenant (DRAFT until submitted).
 *  - Sync approved template statuses from Meta's Cloud API into the tenant store.
 *  - Apply status updates that arrive via webhooks.
 *  - Advance the account's connectionStage as template readiness changes (B1).
 *
 * No marketing templates — only UTILITY, AUTHENTICATION, SERVICE per D-005.
 */
@Injectable()
export class TemplateSyncService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly crypto: CryptoService,
    @Inject(WHATSAPP_ACCOUNT_REPOSITORY) private readonly accounts: WhatsappAccountRepository,
    @Inject(WHATSAPP_TEMPLATE_REPOSITORY) private readonly templates: WhatsappTemplateRepository,
    @Inject(META_CLOUD_API) private readonly meta: MetaCloudApi,
  ) {}

  /** Pull templates from Meta and upsert them for the tenant. */
  async syncFromMeta(tenantId: string): Promise<{ synced: number }> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const account = await this.accounts.findByTenant(tx, tenantId);
      if (!account || !account.accessTokenEnc) throw new TenantCredentialsMissingError(tenantId);
      const accessToken = this.crypto.decrypt(account.accessTokenEnc);

      const metaTemplates = await this.meta.listTemplates({ accessToken, wabaId: account.wabaId });
      for (const t of metaTemplates) {
        await this.templates.upsert(tx, tenantId, {
          name: t.name,
          language: t.language,
          category: t.category,
          status: t.status,
          components: t.components,
          metaTemplateId: t.metaTemplateId,
          rejectionReason: t.rejectionReason ?? null,
        });
      }
      // Approval states may have changed — bring the connection stage along.
      await this.advanceConnectionStage(tx, tenantId);
      return { synced: metaTemplates.length };
    });
  }

  /** Apply a template status update received from Meta webhooks. */
  async applyTemplateStatusUpdate(tenantId: string, update: TemplateStatusUpdate): Promise<boolean> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const applied = await this.templates.updateStatusByMetaId(
        tx,
        tenantId,
        update.metaTemplateId,
        update.status,
        update.rejectionReason,
      );
      // The first APPROVED template is what unlocks READY_TO_GO_LIVE (B1);
      // without this the account is stuck at TEMPLATES_PENDING forever.
      if (applied) await this.advanceConnectionStage(tx, tenantId);
      return applied;
    });
  }

  /**
   * Connection-stage advance by template readiness (D-092 state machine).
   * Forward-only across the pre-live stages; LIVE/PAUSED/REJECTED/DISCONNECTED
   * accounts are never touched by template events. Call sites own the tx.
   */
  async advanceConnectionStage(tx: DbTx, tenantId: string): Promise<ConnectionStage> {
    const approved = await this.templates.countApproved(tx, tenantId);
    const target: ConnectionStage = approved > 0 ? 'READY_TO_GO_LIVE' : 'TEMPLATES_PENDING';
    const account = await this.accounts.findByTenant(tx, tenantId);
    if (!account) return 'OFFICIAL_CONNECT_STARTED';
    if (SETTLED_STAGES.includes(account.connectionStage)) return account.connectionStage;
    await this.accounts.updateConnectionStage(tx, tenantId, target);
    return target;
  }

  /** Seed the starter template pack for a tenant (e.g. after onboarding). */
  async seedDefaultTemplates(tenantId: string): Promise<{ seeded: number }> {
    const pack = buildDefaultTemplatePack();
    return this.uow.withTenant(tenantId, async (tx) => {
      let seeded = 0;
      for (const t of pack) {
        const existing = await this.templates.findByNameAndLanguage(tx, tenantId, t.name, t.language);
        if (!existing) {
          await this.templates.upsert(tx, tenantId, t);
          seeded++;
        }
      }
      return { seeded };
    });
  }
}

function buildDefaultTemplatePack() {
  // DRAFT starter pack — firm must submit these to Meta for approval.
  // Urdu versions mirror English; kept minimal intentionally.
  const templates: Array<{
    name: string;
    language: string;
    category: string;
    status: string;
    components: Record<string, unknown>[];
  }> = [
    {
      name: 'wakeel_welcome',
      language: 'en',
      category: 'UTILITY',
      status: 'DRAFT',
      components: [
        { type: 'BODY', text: 'Assalam-o-Alaikum {{1}},\nWelcome to {{2}}. A legal assistant will review your message shortly.' },
      ],
    },
    {
      name: 'wakeel_welcome',
      language: 'ur',
      category: 'UTILITY',
      status: 'DRAFT',
      components: [
        { type: 'BODY', text: 'السلام علیکم {{1}}،\n{{2}} میں خوش آمدید۔ ایک قانونی معاون جلد آپ کا پیغام دیکھے گا۔' },
      ],
    },
    {
      name: 'wakeel_session_closed',
      language: 'en',
      category: 'UTILITY',
      status: 'DRAFT',
      components: [
        { type: 'BODY', text: 'This conversation has been closed. Reply if you need further assistance.' },
      ],
    },
    {
      name: 'wakeel_session_closed',
      language: 'ur',
      category: 'UTILITY',
      status: 'DRAFT',
      components: [
        { type: 'BODY', text: 'یہ گفتگو بند کر دی گئی ہے۔ مزید مدد کے لیے جواب دیں۔' },
      ],
    },
    {
      name: 'wakeel_human_handoff',
      language: 'en',
      category: 'UTILITY',
      status: 'DRAFT',
      components: [
        { type: 'BODY', text: 'A lawyer from our team will contact you soon. Urgent matters: please call {{1}}.' },
      ],
    },
    {
      name: 'wakeel_human_handoff',
      language: 'ur',
      category: 'UTILITY',
      status: 'DRAFT',
      components: [
        { type: 'BODY', text: 'ہماری ٹیم کا وکیل جلد آپ سے رابطہ کرے گا۔ فوری معاملات کے لیے براہ کرم {{1}} پر کال کریں۔' },
      ],
    },
    {
      name: 'wakeel_appointment_reminder',
      language: 'en',
      category: 'UTILITY',
      status: 'DRAFT',
      components: [
        { type: 'BODY', text: 'Reminder: you have an appointment with {{1}} on {{2}} at {{3}}.' },
      ],
    },
    {
      name: 'wakeel_appointment_reminder',
      language: 'ur',
      category: 'UTILITY',
      status: 'DRAFT',
      components: [
        { type: 'BODY', text: 'یاد دہانی: {{2}} کو {{3}} بجے {{1}} کے ساتھ آپ کی ملاقات ہے۔' },
      ],
    },
  ];
  return templates;
}
