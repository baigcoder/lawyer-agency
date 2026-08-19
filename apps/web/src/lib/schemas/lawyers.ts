import { z } from 'zod';

/** Mirrors the backend Lawyers read shape (apps/api Lawyers module). */
export const availabilitySlotSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotDurationMinutes: z.number().int().min(5).max(480),
});

export const lawyerSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  name: z.string(),
  email: z.string(),
  practiceAreas: z.array(z.string()),
  whatsappNumber: z.string().nullable(),
  availability: z.array(availabilitySlotSchema),
});

export const lawyerListSchema = z.array(lawyerSchema);
export type LawyerDto = z.infer<typeof lawyerSchema>;
export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>;

export const setAvailabilitySchema = z.object({
  slots: z.array(availabilitySlotSchema).max(50),
});
