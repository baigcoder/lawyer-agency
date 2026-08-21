import { Injectable, Logger, Inject } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { DbTx } from '../../../common/persistence/db-tx';
import { OUTBOUND_SENDER, type OutboundSender } from '../../whatsapp/application/ports';
import type { AppointmentSummary } from './appointments.service';

/**
 * Sends appointment-related WhatsApp messages to clients.
 *
 * Uses the existing Evolution outbound path directly so confirmations work
 * regardless of the 24h window when the tenant is on a Baileys-type
 * connection (Evolution bypasses the Meta window, D-106). Official Cloud API
 * routes still respect the window and the send will be rejected by the sender
 * if the window is closed.
 */
@Injectable()
export class AppointmentNotificationsService {
  private readonly logger = new Logger(AppointmentNotificationsService.name);

  constructor(
    private readonly uow: UnitOfWork,
    @Inject(OUTBOUND_SENDER) private readonly sender: OutboundSender,
  ) {}

  async sendConfirmation(tenantId: string, appointment: AppointmentSummary): Promise<boolean> {
    const text = buildAppointmentConfirmationText(appointment);
    return this.sendClientMessage(tenantId, appointment.clientId, appointment.clientWaPhone, text);
  }

  async sendCancellation(tenantId: string, appointment: AppointmentSummary): Promise<boolean> {
    const text = `Your appointment with ${appointment.lawyerName} on ${formatAppointmentDateTime(appointment.startsAt)} has been cancelled. Reply here to reschedule.`;
    return this.sendClientMessage(tenantId, appointment.clientId, appointment.clientWaPhone, text);
  }

  async sendUpdate(tenantId: string, appointment: AppointmentSummary): Promise<boolean> {
    const text = `Your appointment with ${appointment.lawyerName} has been updated to ${formatAppointmentDateTime(appointment.startsAt)}. Location: ${appointment.location ?? 'TBD'}. Reply here for help.`;
    return this.sendClientMessage(tenantId, appointment.clientId, appointment.clientWaPhone, text);
  }

  private async sendClientMessage(
    tenantId: string,
    clientId: string,
    toWaPhone: string,
    body: string,
  ): Promise<boolean> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { clientId },
        orderBy: { updatedAt: 'desc' },
      });
      if (!conversation) {
        this.logger.debug({ clientId }, 'No conversation for client; skipping appointment WhatsApp');
        return false;
      }

      const result = await this.sender.postMessage({
        tenantId,
        toWaPhone,
        body: { type: 'text', text: { body } },
        tx: tx as DbTx,
      });

      await tx.message.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          direction: 'OUTBOUND',
          senderType: 'SYSTEM',
          wamid: result.wamid,
          contentType: 'TEXT',
          body,
          deliveryStatus: 'SENT',
        },
      });
      await tx.conversation.update({ where: { id: conversation.id }, data: { lastOutboundAt: new Date() } });
      return true;
    });
  }
}

export function buildAppointmentConfirmationText(appointment: Pick<
  AppointmentSummary,
  'lawyerName' | 'startsAt' | 'location'
>): string {
  return `Appointment confirmed with ${appointment.lawyerName} on ${formatAppointmentDateTime(appointment.startsAt)}. Location: ${appointment.location ?? 'TBD'}. Reply here if you need to reschedule.`;
}

/** Client-facing times in Asia/Karachi so WhatsApp and calendar agree. */
export function formatAppointmentDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatAppointmentTimeOnly(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}
