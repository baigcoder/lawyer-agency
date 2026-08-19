import { z } from 'zod';
import type { Prisma } from '../../../generated/prisma/client';
import type { EscalationSignal } from '../domain/types';
import { parsePendingAppointment } from './appointment-booking';

const FACT_KEYS = new Set([
  'practiceArea',
  'city',
  'clientName',
  'name',
  'opposingParty',
  'deadline',
  'incidentDate',
  'matterSummary',
  'qualified',
  'urgency',
  'location',
  'familyRelation',
  'court',
  'policeStation',
  'firNumber',
]);

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

export type HandoffBrief = z.infer<typeof handoffBriefSchema>;

export function parseHandoffBrief(value: unknown): HandoffBrief {
  const parsed = handoffBriefSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return {
    reason: '',
    matterType: null,
    facts: {},
    documents: { requests: [], files: [] },
    openItems: [],
    nextAction: '',
    situation: null,
  };
}

export function nextActionForTrigger(triggerType: EscalationSignal['triggerType']): string {
  switch (triggerType) {
    case 'SELF_HARM':
      return 'Call the client now and follow the firm safety protocol.';
    case 'DOMESTIC_VIOLENCE':
      return 'Call the client now; do not ask them to return to an unsafe place.';
    case 'ACTIVE_ARREST':
      return 'Contact the client immediately about arrest or bail status.';
    case 'IMMINENT_DEADLINE':
      return 'Review the deadline and reply to the client today.';
    default:
      return 'Review this brief and reply on WhatsApp.';
  }
}

/**
 * Deterministic T2 lawyer brief from intake, document metadata, and payments.
 * Never reads document bytes or extractedText (D-005).
 */
export async function buildHandoffBrief(
  tx: Prisma.TransactionClient,
  params: {
    clientId: string;
    caseId: string | null;
    matterType?: string | undefined;
    intakeFields: Record<string, unknown>;
    escalation: EscalationSignal;
  },
): Promise<HandoffBrief> {
  const requestWhere = params.caseId
    ? { clientId: params.clientId, caseId: params.caseId }
    : { clientId: params.clientId };
  const [requests, files, payments] = await Promise.all([
    tx.documentRequest.findMany({
      where: requestWhere,
      select: { description: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    tx.document.findMany({
      where: { clientId: params.clientId, deletedAt: null },
      select: { filename: true, docType: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    tx.payment.findMany({
      where: {
        clientId: params.clientId,
        status: { in: ['REQUESTED', 'PENDING'] },
      },
      select: { status: true, amountCents: true, currency: true },
      take: 5,
    }),
  ]);

  const facts = pickFacts(params.intakeFields);
  const pending = parsePendingAppointment(params.intakeFields);
  const openItems: string[] = [];
  for (const row of requests) {
    if (row.status === 'PENDING') openItems.push(`Pending document: ${row.description}`);
  }
  if (pending) {
    openItems.push(`Appointment offer pending (${pending.slots.length} slots)`);
  }
  for (const pay of payments) {
    const amount = `${pay.currency} ${(pay.amountCents / 100).toFixed(0)}`;
    openItems.push(`Unpaid fee (${pay.status}, ${amount})`);
  }

  const matterType =
    params.matterType?.trim() ||
    (typeof params.intakeFields['practiceArea'] === 'string' ? params.intakeFields['practiceArea'].trim() : '') ||
    null;

  return {
    reason: params.escalation.reason,
    matterType,
    facts,
    documents: {
      requests: requests.map((row) => ({ description: row.description, status: row.status })),
      files: files.map((row) => ({ filename: row.filename, docType: row.docType })),
    },
    openItems,
    nextAction: nextActionForTrigger(params.escalation.triggerType),
    situation: null,
  };
}

function pickFacts(fields: Record<string, unknown>): Record<string, string> {
  const facts: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!FACT_KEYS.has(key)) continue;
    if (typeof value === 'string' && value.trim()) facts[key] = value.trim();
    else if (typeof value === 'number' || typeof value === 'boolean') facts[key] = String(value);
  }
  return facts;
}
