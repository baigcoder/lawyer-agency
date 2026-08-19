import { Injectable } from '@nestjs/common';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import type { DomainEventHandler, DomainEventJob } from '../../../common/events/domain-event-handler.port';
import { PaymentDetailsService } from '../../firm-profile/application/payment-details.service';
import { PaymentsService } from './payments.service';
import { PaymentInstructionService } from './payment-instruction.service';
import { preferredInstructionMethod } from './payment-details-request';

/**
 * Sends WhatsApp payment instructions after a payment request, consultation
 * booking, or completed meeting (D-110 / D-119). Respects D-003 24h window.
 */
@Injectable()
export class PaymentFeeMessageHandler implements DomainEventHandler {
  readonly eventType = DOMAIN_EVENTS.PaymentRequested;

  constructor(
    private readonly paymentDetails: PaymentDetailsService,
    private readonly payments: PaymentsService,
    private readonly instructions: PaymentInstructionService,
  ) {}

  async handle(job: DomainEventJob): Promise<void> {
    const payload = job.payload as {
      paymentId: string;
      clientId: string;
      amountCents: number;
      currency: string;
      description?: string;
    };

    await this.instructions.sendFeeMessage(
      job.tenantId,
      payload.clientId,
      payload.amountCents,
      payload.currency,
      payload.description,
    );
  }

  async handleAppointmentBooked(job: DomainEventJob): Promise<void> {
    const payload = job.payload as {
      clientId: string;
      appointmentId: string;
      caseId?: string;
    };
    await this.requestFeeIfNeeded(job.tenantId, {
      clientId: payload.clientId,
      appointmentId: payload.appointmentId,
      ...(payload.caseId ? { caseId: payload.caseId } : {}),
      description: 'Consultation appointment',
    });
  }

  async handleAppointmentCompleted(job: DomainEventJob): Promise<void> {
    const payload = job.payload as {
      clientId: string;
      appointmentId: string;
      caseId?: string;
    };
    await this.requestFeeIfNeeded(job.tenantId, {
      clientId: payload.clientId,
      appointmentId: payload.appointmentId,
      ...(payload.caseId ? { caseId: payload.caseId } : {}),
      description: 'Completed meeting / work',
    });
  }

  private async requestFeeIfNeeded(
    tenantId: string,
    input: { clientId: string; appointmentId: string; caseId?: string; description: string },
  ): Promise<void> {
    const existing = await this.payments.findForAppointment(tenantId, input.appointmentId);
    if (existing) {
      if (existing.status === 'PENDING' || existing.status === 'REQUESTED') {
        await this.instructions.sendFeeMessage(
          tenantId,
          input.clientId,
          existing.amountCents,
          existing.currency,
          input.description,
        );
      }
      return;
    }

    const feePkr = await this.instructions.loadConsultationFee(tenantId);
    if (feePkr <= 0) return;

    const details = await this.paymentDetails.getDecrypted(tenantId);
    const method = preferredInstructionMethod(details);
    await this.payments.requestPayment(tenantId, {
      clientId: input.clientId,
      ...(input.caseId ? { caseId: input.caseId } : {}),
      appointmentId: input.appointmentId,
      amountCents: feePkr * 100,
      currency: 'PKR',
      method,
      description: input.description,
      returnUrl: 'https://wakeel.local/dashboard/payments',
    });
  }
}

export { preferredInstructionMethod };

export function createPaymentFeeHandlers(handler: PaymentFeeMessageHandler): DomainEventHandler[] {
  return [
    handler,
    {
      eventType: DOMAIN_EVENTS.AppointmentBooked,
      handle: (job) => handler.handleAppointmentBooked(job),
    },
    {
      eventType: DOMAIN_EVENTS.AppointmentCompleted,
      handle: (job) => handler.handleAppointmentCompleted(job),
    },
  ];
}
