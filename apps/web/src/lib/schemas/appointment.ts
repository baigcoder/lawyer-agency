import { z } from 'zod';

/** Mirrors the backend Appointments module (apps/api/src/modules/appointments). */
export const appointmentStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'NO_SHOW',
]);

export const appointmentSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  clientName: z.string().nullable(),
  clientWaPhone: z.string(),
  lawyerId: z.string().uuid(),
  lawyerName: z.string(),
  caseId: z.string().uuid().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  status: appointmentStatusSchema,
  location: z.string().nullable(),
  notes: z.string().nullable(),
  reminderSentAt: z.coerce.date().nullable(),
});

export const appointmentListSchema = z.array(appointmentSchema);

export const lawyerSummarySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  practiceAreas: z.array(z.string()),
  whatsappNumber: z.string().nullable(),
});

export const lawyerListSchema = z.array(lawyerSummarySchema);

export const bookAppointmentSchema = z.object({
  clientId: z.string().uuid(),
  lawyerId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  location: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});
export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;

export const calendarStatusSchema = z.object({
  configured: z.boolean(),
  connected: z.boolean(),
  calendarId: z.string().nullable(),
  connectedAt: z.coerce.date().nullable(),
});
export type CalendarStatus = z.infer<typeof calendarStatusSchema>;

export type AppointmentDto = z.infer<typeof appointmentSchema>;
