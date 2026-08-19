import { Module } from '@nestjs/common';
import { WhatsappPortsModule } from '../whatsapp/whatsapp-ports.module';
import { AppointmentsService } from './application/appointments.service';
import { AppointmentNotificationsService } from './application/appointment-notifications.service';
import { CalendarConnectionService } from './application/calendar-connection.service';
import { SlotFinderService } from './application/slot-finder.service';
import { GoogleCalendarService } from './infrastructure/google-calendar.service';
import { AppointmentsController } from './interface/appointments.controller';

/**
 * Appointments — booking, lifecycle, Google Calendar sync, and WhatsApp
 * confirmations (Phase 3). Double-booking is prevented by the database EXCLUDE
 * constraint (migration 0002, FR-APT-04).
 * Owns: appointments, lawyer_calendars. Publishes: appointment.booked, appointment.cancelled.
 * Consumes: Lawyers, Clients, Cases (via Prisma relations); WhatsApp send path.
 */
@Module({
  imports: [WhatsappPortsModule],
  controllers: [AppointmentsController],
  providers: [
    AppointmentsService,
    AppointmentNotificationsService,
    CalendarConnectionService,
    SlotFinderService,
    GoogleCalendarService,
  ],
  exports: [AppointmentsService, SlotFinderService],
})
export class AppointmentsModule {}
