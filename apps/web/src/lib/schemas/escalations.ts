import { z } from 'zod';

export const escalationTriggerSchema = z.enum([
  'SELF_HARM',
  'DOMESTIC_VIOLENCE',
  'ACTIVE_ARREST',
  'IMMINENT_DEADLINE',
  'MANUAL',
]);

export const escalationStatusSchema = z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']);

export const handoffBriefSchema = z.object({
  reason: z.string(),
  matterType: z.string().nullable(),
  facts: z.record(z.string(), z.string()),
  documents: z.object({
    requests: z.array(z.object({ description: z.string(), status: z.string() })),
    files: z.array(z.object({ filename: z.string(), docType: z.string() })),
  }),
  openItems: z.array(z.string()),
  nextAction: z.string(),
  situation: z.string().nullable().optional(),
});

export const escalationSummarySchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  triggerType: escalationTriggerSchema,
  status: escalationStatusSchema,
  detectedExcerpt: z.string().nullable(),
  handoffReason: z.string().nullable(),
  handoffBrief: handoffBriefSchema,
  slaDeadline: z.coerce.date(),
  acknowledgedAt: z.coerce.date().nullable(),
  resolvedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  client: z.object({
    id: z.uuid(),
    name: z.string().nullable(),
    waPhone: z.string(),
  }),
  assignedTo: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  acknowledgerName: z.string().nullable(),
  slaBreached: z.boolean(),
});

export const escalationListSchema = z.array(escalationSummarySchema);

export type EscalationSummary = z.infer<typeof escalationSummarySchema>;
export type EscalationTrigger = z.infer<typeof escalationTriggerSchema>;
export type EscalationStatus = z.infer<typeof escalationStatusSchema>;
export type HandoffBrief = z.infer<typeof handoffBriefSchema>;

export const triggerLabels: Record<EscalationTrigger, string> = {
  SELF_HARM: 'Self-harm risk',
  DOMESTIC_VIOLENCE: 'Domestic violence',
  ACTIVE_ARREST: 'Active arrest',
  IMMINENT_DEADLINE: 'Imminent deadline',
  MANUAL: 'Manual escalation',
};
