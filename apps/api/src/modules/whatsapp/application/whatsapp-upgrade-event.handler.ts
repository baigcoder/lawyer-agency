import { Injectable } from '@nestjs/common';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import type { DomainEventHandler, DomainEventJob } from '../../../common/events/domain-event-handler.port';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { WhatsappUpgradeService } from './whatsapp-upgrade.service';

const UPGRADE_PAYMENT_DESCRIPTION = 'Official WhatsApp Business API upgrade';

/**
 * Auto-enables official WhatsApp when the upgrade payment succeeds.
 * The payment description identifies it as the official WhatsApp upgrade;
 * if the feature is already active, enable() is a no-op.
 */
@Injectable()
export class WhatsappUpgradeEventHandler implements DomainEventHandler {
  readonly eventType = DOMAIN_EVENTS.PaymentSucceeded;

  constructor(
    private readonly upgrade: WhatsappUpgradeService,
    private readonly uow: UnitOfWork,
  ) {}

  async handle(job: DomainEventJob): Promise<void> {
    const { paymentId } = job.payload as { paymentId: string };

    const status = await this.upgrade.status(job.tenantId);
    if (status.enabled) return;

    const payment = await this.uow.withTenant(job.tenantId, async (tx) =>
      tx.payment.findFirst({ where: { id: paymentId, tenantId: job.tenantId } }),
    );
    if (!payment || payment.description !== UPGRADE_PAYMENT_DESCRIPTION) return;

    await this.upgrade.enable(job.tenantId);
  }
}
