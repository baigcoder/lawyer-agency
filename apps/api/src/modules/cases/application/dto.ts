import { z } from 'zod';
import { CASE_STATUSES, CASE_URGENCIES } from '../domain/case';

/** Boundary DTOs — validated by ZodValidationPipe before touching the service. */

export const createCaseSchema = z.object({
  clientId: z.uuid(),
  matterType: z.string().trim().min(2).max(100),
  urgency: z.enum(CASE_URGENCIES).default('NORMAL'),
  summary: z.string().max(5000).nullable().default(null),
  intakeData: z.record(z.string(), z.unknown()).default({}),
});
export type CreateCaseInput = z.infer<typeof createCaseSchema>;

export const assignLawyerSchema = z.object({
  lawyerId: z.uuid(),
  role: z.enum(['primary', 'assisting']).default('primary'),
});
export type AssignLawyerInput = z.infer<typeof assignLawyerSchema>;

export const transitionStatusSchema = z.object({
  to: z.enum(CASE_STATUSES),
});
export type TransitionStatusInput = z.infer<typeof transitionStatusSchema>;
