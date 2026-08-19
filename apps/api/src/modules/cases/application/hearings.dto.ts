import { z } from 'zod';

export const createHearingSchema = z.object({
  courtName: z.string().trim().min(1).max(200),
  judge: z.string().max(200).optional(),
  hearingAt: z.string().datetime(),
  location: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateHearingInput = z.infer<typeof createHearingSchema>;

export const updateHearingSchema = createHearingSchema.partial();
export type UpdateHearingInput = z.infer<typeof updateHearingSchema>;

export interface HearingDto {
  id: string;
  caseId: string;
  courtName: string;
  judge: string | null;
  hearingAt: Date;
  location: string | null;
  notes: string | null;
  reminderSentAt: Date | null;
  createdAt: Date;
}
