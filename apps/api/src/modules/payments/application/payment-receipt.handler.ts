import { Injectable, Logger } from '@nestjs/common';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import type { DomainEventHandler, DomainEventJob } from '../../../common/events/domain-event-handler.port';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { DocumentsService } from '../../documents/application/documents.service';
import { SendService } from '../../whatsapp/application/send.service';
import { WindowClosedError } from '../../../common/messaging/window-policy';
import { buildPaymentReceiptPdf } from './payment-receipt.pdf';

/**
 * After owner verification (`payment.succeeded`), generate a PDF receipt and
 * send it to the client on WhatsApp (D-120). Screenshots never leave T3.
 */
@Injectable()
export class PaymentReceiptHandler implements DomainEventHandler {
  readonly eventType = DOMAIN_EVENTS.PaymentSucceeded;
  private readonly logger = new Logger(PaymentReceiptHandler.name);

  constructor(
    private readonly uow: UnitOfWork,
    private readonly documents: DocumentsService,
    private readonly send: SendService,
  ) {}

  async handle(job: DomainEventJob): Promise<void> {
    const { paymentId } = job.payload as { paymentId: string };
    const context = await this.loadContext(job.tenantId, paymentId);
    if (!context) {
      this.logger.warn({ tenantId: job.tenantId, paymentId }, 'payment not found for receipt');
      return;
    }

    const pdf = await buildPaymentReceiptPdf({
      firmName: context.firmName,
      clientName: context.clientName,
      amountPkr: (context.amountCents / 100).toLocaleString('en-PK'),
      method: humanizeMethod(context.method),
      paidAt: formatPaidAt(context.paidAt),
      workLabel: context.workLabel,
      appointmentLabel: context.appointmentLabel,
      reference: context.caseReference,
    });

    const filename = `receipt-${(context.caseReference ?? paymentId.slice(0, 8)).replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
    const document = await this.documents.upload({
      tenantId: job.tenantId,
      clientId: context.clientId,
      caseId: context.caseId,
      filename,
      description: `Payment receipt for ${context.workLabel}`,
      docType: 'RECEIPT',
      buffer: pdf,
      mimeType: 'application/pdf',
    });

    const caption = [
      `Payment confirmed: PKR ${(context.amountCents / 100).toLocaleString('en-PK')} for ${context.workLabel}.`,
      context.appointmentLabel ? `Appointment: ${context.appointmentLabel}.` : null,
      'Your receipt is attached.',
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n');

    try {
      await this.send.send(job.tenantId, {
        kind: 'document',
        conversationId: context.conversationId,
        toWaPhone: context.waPhone,
        senderType: 'SYSTEM',
        caption,
        fileName: filename,
        mimeType: 'application/pdf',
        documentBuffer: pdf,
        documentPath: document.storagePath,
      });
    } catch (error) {
      if (error instanceof WindowClosedError) {
        this.logger.warn(
          { tenantId: job.tenantId, conversationId: context.conversationId },
          '24h window closed — receipt PDF not sent',
        );
        return;
      }
      throw error;
    }
  }

  private async loadContext(tenantId: string, paymentId: string) {
    return this.uow.withTenant(tenantId, async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId },
        include: {
          client: { select: { id: true, name: true, waPhone: true } },
          case: { select: { reference: true, matterType: true } },
        },
      });
      if (!payment) return null;

      const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true, settings: true } });
      const settings = asRecord(tenant?.settings);
      const displayName =
        typeof settings['displayName'] === 'string' && settings['displayName'].trim()
          ? settings['displayName'].trim()
          : tenant?.name ?? 'Firm';

      const meta = asRecord(payment.metadata);
      const appointmentId = typeof meta['appointmentId'] === 'string' ? meta['appointmentId'] : null;
      let appointmentLabel: string | undefined;
      if (appointmentId) {
        const appointment = await tx.appointment.findFirst({
          where: { id: appointmentId },
          include: { lawyer: { include: { user: { select: { name: true } } } } },
        });
        if (appointment) {
          appointmentLabel = `${appointment.lawyer.user.name} on ${formatPaidAt(appointment.startsAt)}`;
        }
      }

      const conversation = await tx.conversation.findFirst({
        where: { clientId: payment.clientId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });
      if (!conversation) return null;

      const workLabel =
        payment.description?.trim() ||
        (payment.case
          ? `Case ${payment.case.reference}${payment.case.matterType ? ` (${payment.case.matterType})` : ''}`
          : 'legal services');

      return {
        clientId: payment.clientId,
        caseId: payment.caseId ?? undefined,
        waPhone: payment.client.waPhone,
        clientName: payment.client.name?.trim() || payment.client.waPhone,
        firmName: displayName,
        amountCents: payment.amountCents,
        method: payment.method,
        paidAt: payment.paidAt ?? new Date(),
        workLabel,
        appointmentLabel,
        caseReference: payment.case?.reference,
        conversationId: conversation.id,
      };
    });
  }
}

export function createPaymentReceiptHandlers(handler: PaymentReceiptHandler): DomainEventHandler[] {
  return [handler];
}

function humanizeMethod(method: string): string {
  return method
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatPaidAt(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
}
