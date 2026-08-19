import { z } from 'zod';

export const bookAppointmentSchema = z.object({
  clientId: z.uuid(),
  lawyerId: z.uuid(),
  caseId: z.uuid().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  location: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
}).refine(
  (data) => new Date(data.endsAt) > new Date(data.startsAt),
  { message: 'endsAt must be after startsAt', path: ['endsAt'] },
);
export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;

export const updateAppointmentSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  location: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
}).refine(
  (data) => !data.startsAt || !data.endsAt || new Date(data.endsAt) > new Date(data.startsAt),
  { message: 'endsAt must be after startsAt', path: ['endsAt'] },
);
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

export const listAppointmentsSchema = z.object({
  lawyerId: z.uuid().optional(),
  clientId: z.uuid().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsSchema>;