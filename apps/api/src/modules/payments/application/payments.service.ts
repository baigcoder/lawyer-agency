import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PaymentMethod, PaymentStatus } from '../../../generated/prisma/client';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import { toInputJson } from '../../../common/persistence/json';
import type { RailWebhookPayload } from './ports';
import { RailFactory } from './rail.factory';

export interface CreatePaymentInput {
  caseId?: string | undefined;
  clientId: string;
  amountCents: number;
  currency: string;
  method: PaymentMethod;
  description?: string | undefined;
  returnUrl: string;
  requestedBy?: string | undefined;
  appointmentId?: string | undefined;
}

export interface RecordManualPaymentInput {
  caseId?: string | undefined;
  clientId: string;
  amountCents: number;
  currency: string;
  method: PaymentMethod;
  description?: string | undefined;
  paidAt: Date;
  recordedBy: string;
}

export interface PaymentResult {
  paymentId: string;
  status: PaymentStatus;
  redirectUrl?: string | undefined;
  appointmentId?: string | undefined;
}

/**
 * Payment application service (Phase 13, D-008). Coordinates payment request,
 * manual recording, and rail-webhook reconciliation. Keeps integer money,
 provider idempotency, and outbox events.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly uow: UnitOfWork,
    private readonly outbox: OutboxWriter,
    private readonly rails: RailFactory,
  ) {}

  async requestPayment(tenantId: string, input: CreatePaymentInput): Promise<PaymentResult> {
    const isManual = this.isImmediateManualMethod(input.method);
    const isInstruction = this.isInstructionMethod(input.method);
    const rail = isManual || isInstruction ? undefined : this.railForMethod(input.method);

    return this.uow.withTenant(tenantId, async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tenantId,
          caseId: input.caseId ?? null,
          clientId: input.clientId,
          amountCents: input.amountCents,
          currency: input.currency,
          method: input.method,
          status: isManual ? 'RECORDED_MANUAL' : isInstruction ? 'PENDING' : 'PENDING',
          description: input.description ?? null,
          metadata: toInputJson({
            ...(input.appointmentId ? { appointmentId: input.appointmentId } : {}),
          }),
        },
      });

      await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.PaymentRequested, {
        paymentId: payment.id,
        caseId: input.caseId,
        clientId: input.clientId,
        amountCents: input.amountCents,
        currency: input.currency,
        method: input.method,
        description: input.description?.slice(0, 200),
      });

      if (isManual || isInstruction) {
        return { paymentId: payment.id, status: payment.status };
      }

      const railResult = await rail!.initiate({
        paymentId: payment.id,
        tenantId,
        caseId: input.caseId,
        clientId: input.clientId,
        amountCents: input.amountCents,
        currency: input.currency,
        description: input.description,
        returnUrl: input.returnUrl,
      });

      if (railResult.providerTxnId) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { providerTxnId: railResult.providerTxnId },
        });
      }

      if (railResult.completed) {
        const updated = await this.applySuccess(tx, tenantId, payment.id, {
          providerTxnId: railResult.providerTxnId ?? 'unknown',
          status: 'SUCCESS',
          paidAt: new Date().toISOString(),
        });
        return { paymentId: payment.id, status: updated.status };
      }

      return { paymentId: payment.id, status: payment.status, redirectUrl: railResult.redirectUrl };
    });
  }

  async recordManualPayment(tenantId: string, input: RecordManualPaymentInput): Promise<PaymentResult> {
    if (!this.isManualMethod(input.method)) {
      throw new Error(`Method ${input.method} is not a manual method`);
    }
    return this.uow.withTenant(tenantId, async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tenantId,
          caseId: input.caseId ?? null,
          clientId: input.clientId,
          amountCents: input.amountCents,
          currency: input.currency,
          method: input.method,
          status: 'RECORDED_MANUAL',
          description: input.description ?? null,
          paidAt: input.paidAt,
          recordedBy: input.recordedBy,
        },
      });

      await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.PaymentSucceeded, {
        paymentId: payment.id,
        paidAt: input.paidAt.toISOString(),
        amountCents: payment.amountCents,
        clientId: payment.clientId,
        caseId: payment.caseId ?? undefined,
      });

      return { paymentId: payment.id, status: payment.status };
    });
  }

  async processWebhook(
    tenantId: string,
    method: PaymentMethod,
    payload: unknown,
  ): Promise<{ paymentId?: string; updated: boolean }> {
    // Reconciliation is never legal-gated — settling an in-flight payment is
    // not a new initiation (D-096); the gate only blocks initiation.
    const rail = this.rails.webhookRailFor();
    if (!rail) return { updated: false };
    const parsed = rail.parseWebhook(payload);
    if (!parsed) return { updated: false };

    return this.uow.withTenant(tenantId, async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { providerTxnId: parsed.providerTxnId },
      });
      if (!payment) return { updated: false };

      if (parsed.status === 'SUCCESS') {
        await this.applySuccess(tx, tenantId, payment.id, parsed);
      } else if (parsed.status === 'FAILURE') {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', updatedAt: new Date() },
        });
        await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.PaymentFailed, {
          paymentId: payment.id,
          reason: 'provider failure',
        });
      }
      // PENDING is a no-op; the payment row already reflects the initiated state.
      return { paymentId: payment.id, updated: true };
    });
  }

  async refund(tenantId: string, paymentId: string, userId: string): Promise<PaymentResult> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const payment = await tx.payment.findFirst({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException('payment not found');
      if (payment.status !== 'SUCCEEDED' && payment.status !== 'RECORDED_MANUAL') {
        throw new Error('Only succeeded or manually recorded payments can be refunded');
      }

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'REFUNDED', updatedAt: new Date() },
      });

      await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.PaymentRefunded, {
        paymentId: payment.id,
        refundedAmountCents: payment.amountCents,
      });

      void userId;
      return { paymentId: updated.id, status: updated.status };
    });
  }

  async confirmReceived(tenantId: string, paymentId: string, userId: string): Promise<PaymentResult> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const payment = await tx.payment.findFirst({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException('payment not found');
      if (payment.status !== 'PENDING' && payment.status !== 'REQUESTED') {
        throw new Error('Only pending payment requests can be marked received');
      }

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'RECORDED_MANUAL',
          paidAt: new Date(),
          recordedBy: userId,
          updatedAt: new Date(),
        },
      });

      await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.PaymentSucceeded, {
        paymentId: updated.id,
        paidAt: updated.paidAt?.toISOString() ?? new Date().toISOString(),
        amountCents: updated.amountCents,
        clientId: updated.clientId,
        caseId: updated.caseId ?? undefined,
      });

      const appointmentId = asRecord(updated.metadata)['appointmentId'];
      return {
        paymentId: updated.id,
        status: updated.status,
        ...(typeof appointmentId === 'string' ? { appointmentId } : {}),
      };
    });
  }

  async findOpenForClient(tenantId: string, clientId: string) {
    return this.uow.withTenant(tenantId, async (tx) => {
      return tx.payment.findFirst({
        where: { clientId, status: { in: ['PENDING', 'REQUESTED'] } },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  async attachProof(
    tenantId: string,
    paymentId: string,
    proof: { documentId: string; messageId: string; conversationId?: string },
  ) {
    return this.uow.withTenant(tenantId, async (tx) => {
      const payment = await tx.payment.findFirst({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException('payment not found');
      if (payment.status !== 'PENDING' && payment.status !== 'REQUESTED') {
        throw new Error('Only pending payment requests can receive a screenshot proof');
      }

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          metadata: toInputJson({
            ...asRecord(payment.metadata),
            proofDocumentId: proof.documentId,
            proofMessageId: proof.messageId,
          }),
          updatedAt: new Date(),
        },
      });

      await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.PaymentProofReceived, {
        paymentId: updated.id,
        clientId: updated.clientId,
        documentId: proof.documentId,
        messageId: proof.messageId,
        ...(proof.conversationId ? { conversationId: proof.conversationId } : {}),
      });

      return updated;
    });
  }

  async findForAppointment(tenantId: string, appointmentId: string) {
    return this.uow.withTenant(tenantId, async (tx) => {
      const rows = await tx.payment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return rows.find((row) => asRecord(row.metadata)['appointmentId'] === appointmentId);
    });
  }

  async list(tenantId: string, filters: { caseId?: string; clientId?: string; status?: PaymentStatus }) {
    return this.uow.withTenant(tenantId, async (tx) => {
      return tx.payment.findMany({
        where: {
          ...(filters.caseId ? { caseId: filters.caseId } : {}),
          ...(filters.clientId ? { clientId: filters.clientId } : {}),
          ...(filters.status ? { status: filters.status } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          recordedByUser: { select: { id: true, name: true } },
          case: { select: { reference: true, matterType: true } },
          client: { select: { id: true, name: true, waPhone: true } },
        },
      });
    });
  }

  async getById(tenantId: string, paymentId: string) {
    return this.uow.withTenant(tenantId, async (tx) => {
      return tx.payment.findFirst({
        where: { id: paymentId },
        include: {
          recordedByUser: { select: { id: true, name: true } },
          case: { select: { reference: true, matterType: true } },
          client: { select: { id: true, name: true, waPhone: true } },
        },
      });
    });
  }

  private railForMethod(method: PaymentMethod) {
    return this.rails.railForMethod(method);
  }

  private isInstructionMethod(method: PaymentMethod): boolean {
    return ['JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'].includes(method);
  }

  private isImmediateManualMethod(method: PaymentMethod): boolean {
    return ['CASH', 'OTHER_MANUAL'].includes(method);
  }

  private isManualMethod(method: PaymentMethod): boolean {
    return ['BANK_TRANSFER', 'CASH', 'OTHER_MANUAL'].includes(method);
  }

  private async applySuccess(
    tx: Parameters<Parameters<UnitOfWork['withTenant']>[1]>[0],
    tenantId: string,
    paymentId: string,
    parsed: RailWebhookPayload,
  ) {
    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: { status: 'SUCCEEDED', paidAt: parsed.paidAt ? new Date(parsed.paidAt) : new Date() },
    });
    await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.PaymentSucceeded, {
      paymentId: updated.id,
      providerTxnId: parsed.providerTxnId,
      paidAt: updated.paidAt?.toISOString() ?? new Date().toISOString(),
      amountCents: updated.amountCents,
      clientId: updated.clientId,
      caseId: updated.caseId ?? undefined,
    });
    return updated;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
}
