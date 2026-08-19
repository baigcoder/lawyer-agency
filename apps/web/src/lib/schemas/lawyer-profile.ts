import { z } from 'zod';

export const caseHighlightSchema = z.object({
  id: z.string().uuid(),
  caseId: z.string().uuid(),
  caseReference: z.string(),
  matterType: z.string(),
  publicTitle: z.string(),
  publicOutcome: z.string(),
  consentRecordedAt: z.string(),
  visibleToAi: z.boolean(),
});

export const closedCaseOptionSchema = z.object({
  id: z.string().uuid(),
  reference: z.string(),
  matterType: z.string(),
  closedAt: z.string().nullable(),
});

export const lawyerProfileSchema = z.object({
  lawyerId: z.string(),
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  practiceAreas: z.array(z.string()),
  whatsappNumber: z.string().nullable(),
  bio: z.string(),
  bioUr: z.string(),
  yearsExperience: z.number().nullable(),
  barCouncil: z.string(),
  barEnrollmentNumber: z.string(),
  education: z.array(z.string()),
  achievements: z.array(z.string()),
  languages: z.array(z.string()),
  profileCompletedAt: z.string().nullable(),
  caseHighlights: z.array(caseHighlightSchema),
});

export const lawyerProfileInputSchema = z.object({
  bio: z.string().max(2000).optional(),
  bioUr: z.string().max(2000).optional(),
  yearsExperience: z.number().int().min(0).max(70).nullable().optional(),
  barCouncil: z.string().max(120).optional(),
  barEnrollmentNumber: z.string().max(60).optional(),
  education: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  achievements: z.array(z.string().trim().min(1).max(300)).max(30).optional(),
  languages: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  practiceAreas: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
});

export const createCaseHighlightInputSchema = z.object({
  caseId: z.string().uuid(),
  publicTitle: z.string().trim().min(3).max(200),
  publicOutcome: z.string().trim().min(3).max(500),
  consentConfirmed: z.literal(true),
  visibleToAi: z.boolean().default(true),
});

export type LawyerProfile = z.infer<typeof lawyerProfileSchema>;
export type LawyerProfileInput = z.infer<typeof lawyerProfileInputSchema>;
export type CaseHighlight = z.infer<typeof caseHighlightSchema>;
export type ClosedCaseOption = z.infer<typeof closedCaseOptionSchema>;
