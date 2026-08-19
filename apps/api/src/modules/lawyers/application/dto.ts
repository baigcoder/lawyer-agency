import { z } from 'zod';

export const createLawyerSchema = z.object({
  userId: z.uuid(),
  practiceAreas: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  whatsappNumber: z.string().max(30).nullable().optional(),
});
export type CreateLawyerInput = z.infer<typeof createLawyerSchema>;

export const updateLawyerSchema = z.object({
  practiceAreas: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  whatsappNumber: z.string().max(30).nullable().optional(),
});
export type UpdateLawyerInput = z.infer<typeof updateLawyerSchema>;

export const availabilitySlotSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotDurationMinutes: z.number().int().min(5).max(480).default(30),
});
export type AvailabilitySlotInput = z.infer<typeof availabilitySlotSchema>;

export const setAvailabilitySchema = z.object({
  slots: z.array(availabilitySlotSchema).max(50),
});
export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>;

export const lawyerProfileSchema = z.object({
  bio: z.string().max(2000).optional().default(''),
  bioUr: z.string().max(2000).optional().default(''),
  yearsExperience: z.number().int().min(0).max(70).nullable().optional(),
  barCouncil: z.string().max(120).optional().default(''),
  barEnrollmentNumber: z.string().max(60).optional().default(''),
  education: z.array(z.string().trim().min(1).max(200)).max(20).optional().default([]),
  achievements: z.array(z.string().trim().min(1).max(300)).max(30).optional().default([]),
  languages: z.array(z.string().trim().min(1).max(40)).max(10).optional().default([]),
  practiceAreas: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
});
export type LawyerProfileInput = z.infer<typeof lawyerProfileSchema>;

export const createCaseHighlightSchema = z.object({
  caseId: z.uuid(),
  publicTitle: z.string().trim().min(3).max(200),
  publicOutcome: z.string().trim().min(3).max(500),
  consentConfirmed: z.boolean().refine((v) => v === true, {
    message: 'You must confirm client consent or anonymization before publishing a case highlight',
  }),
  visibleToAi: z.boolean().default(true),
});
export type CreateCaseHighlightInput = z.infer<typeof createCaseHighlightSchema>;

export const updateCaseHighlightSchema = z.object({
  publicTitle: z.string().trim().min(3).max(200).optional(),
  publicOutcome: z.string().trim().min(3).max(500).optional(),
  visibleToAi: z.boolean().optional(),
});
export type UpdateCaseHighlightInput = z.infer<typeof updateCaseHighlightSchema>;