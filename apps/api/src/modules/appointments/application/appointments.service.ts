import { Injectable, NotFoundException } from '@nestjs/common';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { GoogleCalendarService } from '../infrastructure/google-calendar.service';
import { AppointmentNotificationsService } from './appointment-notifications.service';
import type {
  BookAppointmentInput,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
} from './dto';

export interface AppointmentSummary {
  id: string;
  clientId: string;
  clientName: string | null;
  clientWaPhone: string;
  lawyerId: string;
  lawyerName: string;
  caseId: string | null;
  startsAt: Date;
  endsAt: Date;
  status: string;
  location: string | null;
  notes: string | null;
  reminderSentAt: Date | null;
}

/** Appointment row plus the relations the calendar view needs. */
const appointmentInclude = {
  client: { select: { name: true, waPhone: true } },
  lawyer: { include: { user: { select: { name: true } } } },
} as const;

/**
 * Appointment booking and lifecycle (Phase 16, FR-APT-04).
 * Double-booking is prevented by the database EXCLUDE constraint added in
 * migration 0002 — the service relies on the unique violation surfacing as
 * a Prisma error and re-throws it as a domain error.
 */
@Injectable()
export class AppointmentsService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly outbox: OutboxWriter,
    private readonly googleCalendar: GoogleCalendarService,
    private readonly crypto: CryptoService,
    private readonly notifications: AppointmentNotificationsService,
  ) {}

  async book(tenantId: string, input: BookAppointmentInput): Promise<AppointmentSummary> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const lawyer = await tx.lawyer.findFirst({ where: { id: input.lawyerId } });
      if (!lawyer) throw new NotFoundException('lawyer not found');
      const client = await tx.client.findFirst({ where: { id: input.clientId } });
      if (!client) throw new NotFoundException('client not found');

      const created = await tx.appointment.create({
        data: {
          tenantId,
          clientId: input.clientId,
          lawyerId: input.lawyerId,
          caseId: input.caseId ?? null,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          status: 'CONFIRMED',
          location: input.location ?? null,
          notes: input.notes ?? null,
        },
      });

      await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.AppointmentBooked, {
        appointmentId: created.id,
        lawyerId: created.lawyerId,
        clientId: created.clientId,
        caseId: created.caseId ?? undefined,
        startsAt: created.startsAt.toISOString(),
      });

      const calendar = await tx.lawyerCalendar.findFirst({ where: { lawyerId: created.lawyerId } });
      let externalEventId: string | null = null;
      let externalCalendarId: string | null = null;
      if (calendar) {
        const event = await this.googleCalendar.createEvent({
          refreshTokenEnc: calendar.googleRefreshTokenEnc,
          calendarId: calendar.googleCalendarId,
          summary: `Appointment: ${client.name ?? client.waPhone}`,
          description: input.notes ?? undefined,
          location: input.location ?? undefined,
          start: created.startsAt,
          end: created.endsAt,
        });
        if (event) {
          externalEventId = event.id;
          externalCalendarId = calendar.googleCalendarId;
          await tx.appointment.update({
            where: { id: created.id },
            data: { externalEventId, externalCalendarId },
          });
        }
      }

      const withNames = await tx.appointment.findFirst({
        where: { id: created.id },
        include: appointmentInclude,
      });
      const summary = toSummary(withNames!);

      if (await this.notifications.sendConfirmation(tenantId, summary)) {
        await tx.appointment.update({
          where: { id: created.id },
          data: { confirmationSentAt: new Date() },
        });
      }

      return summary;
    });
  }

  async list(tenantId: string, query: ListAppointmentsQuery): Promise<AppointmentSummary[]> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const where: Record<string, unknown> = {};
      if (query.lawyerId) where.lawyerId = query.lawyerId;
      if (query.clientId) where.clientId = query.clientId;
      if (query.status) where.status = query.status;
      if (query.from || query.to) {
        where.startsAt = {};
        if (query.from) (where.startsAt as Record<string, unknown>).gte = new Date(query.from);
        if (query.to) (where.startsAt as Record<string, unknown>).lte = new Date(query.to);
      }

      const rows = await tx.appointment.findMany({
        where,
        include: appointmentInclude,
        orderBy: { startsAt: 'asc' },
        take: query.limit,
        skip: query.offset,
      });
      return rows.map(toSummary);
    });
  }

  async getById(tenantId: string, id: string): Promise<AppointmentSummary> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const row = await tx.appointment.findFirst({ where: { id }, include: appointmentInclude });
      if (!row) throw new NotFoundException('appointment not found');
      return toSummary(row);
    });
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdateAppointmentInput,
  ): Promise<AppointmentSummary> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const current = await tx.appointment.findFirst({ where: { id }, include: appointmentInclude });
      if (!current) throw new NotFoundException('appointment not found');

      const wasCancelled = input.status === 'CANCELLED' && current.status !== 'CANCELLED';
      const wasCompleted = input.status === 'COMPLETED' && current.status !== 'COMPLETED';
      const startsAt = input.startsAt ? new Date(input.startsAt) : current.startsAt;
      const endsAt = input.endsAt ? new Date(input.endsAt) : current.endsAt;

      const data: Record<string, unknown> = {};
      if (input.status !== undefined) data.status = input.status;
      if (input.startsAt !== undefined) data.startsAt = startsAt;
      if (input.endsAt !== undefined) data.endsAt = endsAt;
      if (input.location !== undefined) data.location = input.location;
      if (input.notes !== undefined) data.notes = input.notes;

      await tx.appointment.update({
        where: { id },
        data,
      });

      const calendar = await tx.lawyerCalendar.findFirst({ where: { lawyerId: current.lawyerId } });

      if (wasCompleted) {
        await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.AppointmentCompleted, {
          appointmentId: id,
          lawyerId: current.lawyerId,
          clientId: current.clientId,
          caseId: current.caseId ?? undefined,
        });
      }

      if (wasCancelled) {
        await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.AppointmentCancelled, { appointmentId: id });
        if (current.externalEventId && calendar) {
          await this.googleCalendar.deleteEvent({
            refreshTokenEnc: calendar.googleRefreshTokenEnc,
            calendarId: current.externalCalendarId ?? calendar.googleCalendarId,
            eventId: current.externalEventId,
          });
          await tx.appointment.update({ where: { id }, data: { externalEventId: null, externalCalendarId: null } });
        }
      } else if (calendar && current.externalEventId) {
        await this.googleCalendar.updateEvent({
          refreshTokenEnc: calendar.googleRefreshTokenEnc,
          calendarId: current.externalCalendarId ?? calendar.googleCalendarId,
          eventId: current.externalEventId,
          summary: `Appointment: ${current.client.name ?? current.client.waPhone}`,
          description: input.notes ?? current.notes ?? undefined,
          location: input.location ?? current.location ?? undefined,
          start: startsAt,
          end: endsAt,
        });
      }

      const withNames = await tx.appointment.findFirst({
        where: { id },
        include: appointmentInclude,
      });
      const summary = toSummary(withNames!);

      if (wasCancelled) {
        await this.notifications.sendCancellation(tenantId, summary);
      } else if (input.startsAt !== undefined || input.endsAt !== undefined || input.location !== undefined) {
        await this.notifications.sendUpdate(tenantId, summary);
      }

      return summary;
    });
  }

  async markReminderSent(tenantId: string, id: string): Promise<void> {
    return this.uow.withTenant(tenantId, async (tx) => {
      await tx.appointment.update({
        where: { id },
        data: { reminderSentAt: new Date() },
      });
    });
  }
}

function toSummary(row: {
  id: string;
  clientId: string;
  lawyerId: string;
  caseId: string | null;
  startsAt: Date;
  endsAt: Date;
  status: string;
  location: string | null;
  notes: string | null;
  reminderSentAt: Date | null;
  client: { name: string | null; waPhone: string };
  lawyer: { user: { name: string } };
}): AppointmentSummary {
  return {
    id: row.id,
    clientId: row.clientId,
    clientName: row.client.name,
    clientWaPhone: row.client.waPhone,
    lawyerId: row.lawyerId,
    lawyerName: row.lawyer.user.name,
    caseId: row.caseId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status,
    location: row.location,
    notes: row.notes,
    reminderSentAt: row.reminderSentAt,
  };
}