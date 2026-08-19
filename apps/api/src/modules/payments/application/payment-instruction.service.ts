import { Injectable, Logger } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { PaymentDetailsService } from '../../firm-profile/application/payment-details.service';
import { SendService } from '../../whatsapp/application/send.service';
import { WindowClosedError } from '../../../common/messaging/window-policy';
import { PaymentsService } from './payments.service';
import { preferredInstructionMethod } from './payment-details-request';
import { isPaymentDetailsRequest } from './payment-details-request';

export interface OpenPaymentSummary {
  id: string;
  amountCents: number;
  currency: string;
  description: string | null;
  status: string;
}

/**
 * Sends owner-configured JazzCash / Easypaisa / bank instructions and links
 * inbound screenshots to a pending payment (D-119 / D-120). Never puts
 * account numbers into LLM prompts.
 */
@Injectable()
export class PaymentInstructionService {
  private readonly logger = new Logger(PaymentInstructionService.name);

  constructor(
    private readonly uow: UnitOfWork,
    private readonly paymentDetails: PaymentDetailsService,
    private readonly send: SendService,
    private readonly payments: PaymentsService,
  ) {}

  isDetailsRequest(text: string): boolean {
    return isPaymentDetailsRequest(text);
  }

  async hasReceivingDetails(tenantId: string): Promise<boolean> {
    const details = await this.paymentDetails.getDecrypted(tenantId);
    return Boolean(
      details.jazzcashNumber ||
        details.easypaisaNumber ||
        details.bankName ||
        details.accountNumber ||
        details.iban,
    );
  }

  async findOpenForClient(tenantId: string, clientId: string): Promise<OpenPaymentSummary | null> {
    const row = await this.payments.findOpenForClient(tenantId, clientId);
    if (!row) return null;
    return {
      id: row.id,
      amountCents: row.amountCents,
      currency: row.currency,
      description: row.description,
      status: row.status,
    };
  }

  /**
   * Client asked for payment details. Reuses a pending payment, creates one
   * from the consultation fee, or sends account numbers without an amount.
   * Returns true when a SYSTEM WhatsApp message was sent or queued via outbox.
   */
  async handleClientRequest(
    tenantId: string,
    input: { clientId: string; caseId?: string | undefined },
  ): Promise<boolean> {
    if (!(await this.hasReceivingDetails(tenantId))) {
      this.logger.debug({ tenantId }, 'payment details requested but none configured');
      return false;
    }

    const existing = await this.payments.findOpenForClient(tenantId, input.clientId);
    if (existing) {
      await this.sendFeeMessage(
        tenantId,
        input.clientId,
        existing.amountCents,
        existing.currency,
        existing.description ?? undefined,
      );
      return true;
    }

    const feePkr = await this.loadConsultationFee(tenantId);
    if (feePkr > 0) {
      const details = await this.paymentDetails.getDecrypted(tenantId);
      await this.payments.requestPayment(tenantId, {
        clientId: input.clientId,
        ...(input.caseId ? { caseId: input.caseId } : {}),
        amountCents: feePkr * 100,
        currency: 'PKR',
        method: preferredInstructionMethod(details),
        description: 'Consultation fee',
        returnUrl: 'https://wakeel.local/dashboard/payments',
      });
      return true;
    }

    await this.sendFeeMessage(tenantId, input.clientId, 0, 'PKR', 'Amount to be confirmed by the firm');
    return true;
  }

  async attachProofIfPending(
    tenantId: string,
    input: { clientId: string; documentId: string; messageId: string; conversationId: string },
  ): Promise<boolean> {
    const open = await this.payments.findOpenForClient(tenantId, input.clientId);
    if (!open) return false;

    await this.payments.attachProof(tenantId, open.id, {
      documentId: input.documentId,
      messageId: input.messageId,
      conversationId: input.conversationId,
    });
    await this.sendProofAck(tenantId, input.clientId);
    return true;
  }

  async sendFeeMessage(
    tenantId: string,
    clientId: string,
    amountCents: number,
    currency: string,
    workLabel?: string,
  ): Promise<void> {
    const details = await this.paymentDetails.getDecrypted(tenantId);
    const hasDetails =
      details.jazzcashNumber ||
      details.easypaisaNumber ||
      details.bankName ||
      details.accountNumber ||
      details.iban;

    if (!hasDetails) {
      this.logger.debug({ tenantId }, 'no payment receiving details configured — skipping fee message');
      return;
    }

    const ctx = await this.loadConversation(tenantId, clientId);
    if (!ctx) return;

    const lines: string[] = [];
    if (amountCents > 0) {
      lines.push(`Payment requested: ${currency} ${(amountCents / 100).toFixed(0)}`);
    } else {
      lines.push('Payment details from the firm:');
    }
    if (workLabel) lines.push(`For: ${workLabel}`);
    lines.push('');
    lines.push('Please pay using one of the following:');
    if (details.jazzcashNumber) lines.push(`JazzCash: ${details.jazzcashNumber}`);
    if (details.easypaisaNumber) lines.push(`Easypaisa: ${details.easypaisaNumber}`);
    if (details.bankName || details.accountNumber) {
      lines.push('');
      lines.push('Bank transfer:');
      if (details.bankName) lines.push(`Bank: ${details.bankName}`);
      if (details.accountTitle) lines.push(`Account title: ${details.accountTitle}`);
      if (details.accountNumber) lines.push(`Account #: ${details.accountNumber}`);
      if (details.iban) lines.push(`IBAN: ${details.iban}`);
    }
    lines.push('');
    lines.push('Share your payment screenshot here once done.');

    await this.sendSystemText(tenantId, ctx.id, ctx.waPhone, lines.join('\n'));
  }

  private async sendProofAck(tenantId: string, clientId: string): Promise<void> {
    const ctx = await this.loadConversation(tenantId, clientId);
    if (!ctx) return;
    const body = [
      'Thank you — we received your payment screenshot.',
      'After the firm confirms, you will get a receipt on WhatsApp.',
      '',
      'شکریہ — آپ کا پیمنٹ اسکرین شاٹ موصول ہو گیا۔',
      'فرم کی تصدیق کے بعد رسید یہاں بھیج دی جائے گی۔',
    ].join('\n');
    await this.sendSystemText(tenantId, ctx.id, ctx.waPhone, body);
  }

  private async sendSystemText(
    tenantId: string,
    conversationId: string,
    toWaPhone: string,
    body: string,
  ): Promise<void> {
    try {
      await this.send.send(tenantId, {
        kind: 'text',
        conversationId,
        toWaPhone,
        senderType: 'SYSTEM',
        body,
      });
    } catch (error) {
      if (error instanceof WindowClosedError) {
        this.logger.warn({ tenantId, conversationId }, '24h window closed — payment WhatsApp not sent');
        return;
      }
      throw error;
    }
  }

  private async loadConversation(
    tenantId: string,
    clientId: string,
  ): Promise<{ id: string; waPhone: string } | null> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { clientId },
        orderBy: { updatedAt: 'desc' },
        include: { client: true },
      });
      if (!conversation) return null;
      return { id: conversation.id, waPhone: conversation.client.waPhone };
    });
  }

  async loadConsultationFee(tenantId: string): Promise<number> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
      const settings = tenant?.settings;
      if (typeof settings === 'object' && settings !== null && !Array.isArray(settings)) {
        const fee = (settings as Record<string, unknown>)['consultationFeePkr'];
        return typeof fee === 'number' && fee > 0 ? fee : 0;
      }
      return 0;
    });
  }
}
