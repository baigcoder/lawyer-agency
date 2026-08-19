import { describe, expect, it, vi } from 'vitest';
import { WhatsappUpgradeEventHandler } from './whatsapp-upgrade-event.handler';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import type { WhatsappUpgradeService } from './whatsapp-upgrade.service';
import type { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { DomainEventJob } from '../../../common/events/domain-event-handler.port';

const TENANT = '11111111-1111-1111-1111-111111111111';

function makeHandler(overrides: {
  enabled?: boolean;
  paymentDescription?: string | null;
} = {}) {
  const upgrade: WhatsappUpgradeService = {
    status: vi.fn(async () => ({ enabled: overrides.enabled ?? false, priceCents: 50000, currency: 'PKR' })),
    enable: vi.fn(async () => ({ enabled: true })),
  } as unknown as WhatsappUpgradeService;

  const uow = {
    withTenant: vi.fn(async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        payment: {
          findFirst: vi.fn(async () =>
            overrides.paymentDescription === undefined
              ? null
              : { description: overrides.paymentDescription },
          ),
        },
      }),
    ),
  } as unknown as UnitOfWork;

  return { handler: new WhatsappUpgradeEventHandler(upgrade, uow), upgrade, uow };
}

describe('WhatsappUpgradeEventHandler', () => {
  it('ignores PaymentSucceeded when official WhatsApp is already enabled', async () => {
    const { handler, upgrade } = makeHandler({ enabled: true, paymentDescription: 'Official WhatsApp Business API upgrade' });
    await handler.handle({
      tenantId: TENANT,
      type: DOMAIN_EVENTS.PaymentSucceeded,
      payload: { paymentId: 'pay-1' },
      occurredAt: new Date(),
    } as DomainEventJob);
    expect(upgrade.enable).not.toHaveBeenCalled();
  });

  it('enables official WhatsApp when the upgrade payment succeeds', async () => {
    const { handler, upgrade } = makeHandler({ enabled: false, paymentDescription: 'Official WhatsApp Business API upgrade' });
    await handler.handle({
      tenantId: TENANT,
      type: DOMAIN_EVENTS.PaymentSucceeded,
      payload: { paymentId: 'pay-1' },
      occurredAt: new Date(),
    } as DomainEventJob);
    expect(upgrade.enable).toHaveBeenCalledWith(TENANT);
  });

  it('ignores PaymentSucceeded for non-upgrade payments', async () => {
    const { handler, upgrade } = makeHandler({ enabled: false, paymentDescription: 'Consultation fee' });
    await handler.handle({
      tenantId: TENANT,
      type: DOMAIN_EVENTS.PaymentSucceeded,
      payload: { paymentId: 'pay-1' },
      occurredAt: new Date(),
    } as DomainEventJob);
    expect(upgrade.enable).not.toHaveBeenCalled();
  });
});
