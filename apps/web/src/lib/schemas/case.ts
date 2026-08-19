import { z } from 'zod';

/** Mirrors the backend Cases read shape (apps/api Cases module). */
export const caseSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  clientId: z.uuid(),
  reference: z.string(),
  matterType: z.string(),
  status: z.enum(['LEAD', 'CONSULTATION', 'ENGAGED', 'IN_COURT', 'CLOSED', 'ARCHIVED']),
  urgency: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']),
  summary: z.string().nullable(),
  intakeData: z.record(z.string(), z.unknown()),
  openedAt: z.coerce.date(),
  closedAt: z.coerce.date().nullable(),
});
export type CaseDto = z.infer<typeof caseSchema>;

export const caseListSchema = z.array(caseSchema);

export const hearingSchema = z.object({
  id: z.uuid(),
  caseId: z.uuid(),
  courtName: z.string(),
  judge: z.string().nullable(),
  hearingAt: z.coerce.date(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  reminderSentAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export const hearingListSchema = z.array(hearingSchema);
export type HearingDto = z.infer<typeof hearingSchema>;
