import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { PaymentsService } from '../../payments/application/payments.service';
import type { TenantFeatureCode, TenantFeatureStatus } from '../../../generated/prisma/client';

export interface UpgradeStatus {
  enabled: boolean;
  priceCents: number;
  currency: string;
}

export interface UpgradeInitiateResult {
  paymentId: string;
  redirectUrl: string | undefined;
  status: string;
}

/**
 * Official WhatsApp Business API upgrade gate. The pilot bridge is free and
 * auto-allowlists inbound numbers; the official Meta Cloud connection is a
 * paid capability unlocked by an ACTIVE platform.tenant_features row with
 * code = 'OFFICIAL_WHATSAPP'. Payment is handled by the existing PaymentsService
 * so all rails (JazzCash/Easypaisa/card) are available.
 */
@Injectable()
export class WhatsappUpgradeService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly uow: UnitOfWork,
    private readonly payments: PaymentsService,
  ) {}

  private get priceCents(): number {
    return this.config.get('OFFICIAL_WHATSAPP_PRICE_CENTS', { infer: true });
  }

  private get currency(): string {
    return this.config.get('OFFICIAL_WHATSAPP_CURRENCY', { infer: true });
  }

  async status(tenantId: string): Promise<UpgradeStatus> {
    const feature = await this.uow.withPlatform(async (tx) =>
      tx.tenantFeature.findUnique({
        where: { tenantId_code: { tenantId, code: 'OFFICIAL_WHATSAPP' } },
      }),
    );
    const active = feature?.status === 'ACTIVE' && (!feature.expiresAt || feature.expiresAt > new Date());
    return { enabled: active, priceCents: this.priceCents, currency: this.currency };
  }

  /**
   * Idempotently enable official WhatsApp for a tenant. Safe to call when
   * already enabled (returns current status).
   */
  async enable(tenantId: string): Promise<{ enabled: boolean }> {
    await this.uow.withPlatform(async (tx) => {
      await tx.tenantFeature.upsert({
        where: { tenantId_code: { tenantId, code: 'OFFICIAL_WHATSAPP' } },
        create: {
          tenantId,
          code: 'OFFICIAL_WHATSAPP' as TenantFeatureCode,
          status: 'ACTIVE' as TenantFeatureStatus,
        },
        update: { status: 'ACTIVE' as TenantFeatureStatus, expiresAt: null },
      });
    });
    return { enabled: true };
  }

  /**
   * Create a payment request for the official WhatsApp unlock fee. The caller
   * is redirected to the payment rail; on success the PaymentSucceeded domain
   * event (or the explicit complete() call) flips the feature ACTIVE.
   */
  async initiate(tenantId: string, userId: string, returnUrl: string): Promise<UpgradeInitiateResult> {
    const current = await this.status(tenantId);
    if (current.enabled) {
      throw new ConflictException('Official WhatsApp is already enabled for this firm');
    }

    // Payments require a real client row (FK). Firm-level upgrades don't have
    // a natural client, so create a placeholder "Firm account" client once.
    const clientId = await this.uow.withTenant(tenantId, async (tx) => {
      const existing = await tx.client.findFirst({
        where: { tenantId, waPhone: '00000000000' },
        select: { id: true },
      });
      if (existing) return existing.id;
      const created = await tx.client.create({
        data: {
          tenantId,
          waPhone: '00000000000',
          name: 'Firm account',
        },
        select: { id: true },
      });
      return created.id;
    });

    const result = await this.payments.requestPayment(tenantId, {
      clientId,
      amountCents: this.priceCents,
      currency: this.currency,
      method: 'CARD_LOCAL',
      description: 'Official WhatsApp Business API upgrade',
      returnUrl,
      requestedBy: userId,
    });

    return {
      paymentId: result.paymentId,
      redirectUrl: result.redirectUrl,
      status: result.status,
    };
  }

  /**
   * Complete the upgrade after a payment has settled. Call this from the
   * payment return page or a domain-event handler.
   */
  async complete(tenantId: string, paymentId: string): Promise<{ enabled: boolean }> {
    const payment = await this.uow.withTenant(tenantId, async (tx) =>
      tx.payment.findFirst({ where: { id: paymentId, tenantId } }),
    );
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'SUCCEEDED' && payment.status !== 'RECORDED_MANUAL') {
      throw new ConflictException(`Payment status is ${payment.status} — wait for it to succeed`);
    }
    return this.enable(tenantId);
  }
}
