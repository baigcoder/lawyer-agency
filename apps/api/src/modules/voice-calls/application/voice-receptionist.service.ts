import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { toInputJson } from '../../../common/persistence/json';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { AppointmentsService } from '../../appointments/application/appointments.service';
import { SlotFinderService, type OpenSlotOffer } from '../../appointments/application/slot-finder.service';
import { EscalationDetectorService } from '../../ai/application/escalation-detector.service';
import { EscalationAssignmentService } from '../../ai/application/escalation-assignment.service';
import { AiClientFactory } from '../../ai/application/ai-client-factory';
import { MODEL_ROUTER, type ModelRouter } from '../../ai/application/ports';
import { RETRIEVER, type Retriever } from '../../rag/application/retriever.port';
import { matchPakistanLawyerKnowledge } from '../../rag/application/pakistan-lawyer-knowledge';
import { selectRelevantChunks } from '../../ai/application/retrieved-chunks';
import { rewriteMissingAnswerReply } from '../../ai/application/missing-answer-reply';
import { prepareSpokenTtsText } from '../../voice/application/spoken-text';
import { buildAiAssumptionsBlock, type AiSettings } from '../../firm-profile/application/ai-settings.dto';

const turnSchema = z.object({
  speak: z.string(),
  tool: z
    .enum(['none', 'capture_intake', 'list_slots', 'book_appointment', 'create_escalation', 'get_firm_faq'])
    .default('none'),
  intakeFacts: z.record(z.string(), z.string()).optional(),
  matterType: z.string().optional(),
  faqQuery: z.string().optional(),
  slotIndex: z.number().int().min(1).max(3).optional(),
  endCall: z.boolean().optional(),
});

export interface ReceptionistSession {
  tenantId: string;
  voiceCallId: string;
  conversationId: string;
  clientId: string;
  fromWaPhone: string;
  firmName: string;
  settings: AiSettings;
  offeredSlots: OpenSlotOffer | null;
  transcript: Array<{ role: 'assistant' | 'user'; text: string }>;
  appointmentId?: string;
  escalationId?: string;
  disposition: 'BOOKED' | 'ESCALATED' | 'INFO' | 'ABANDONED';
  shouldHangUp?: boolean;
}

@Injectable()
export class VoiceReceptionistService {
  private readonly logger = new Logger(VoiceReceptionistService.name);

  constructor(
    private readonly uow: UnitOfWork,
    private readonly outbox: OutboxWriter,
    private readonly appointments: AppointmentsService,
    private readonly slots: SlotFinderService,
    private readonly escalations: EscalationDetectorService,
    private readonly assignment: EscalationAssignmentService,
    private readonly clientFactory: AiClientFactory,
    @Inject(MODEL_ROUTER) private readonly modelRouter: ModelRouter,
    @Inject(RETRIEVER) private readonly retriever: Retriever,
  ) {}

  greeting(session: ReceptionistSession): string {
    return receptionistGreeting(session.firmName);
  }

  async processUtterance(session: ReceptionistSession, userText: string): Promise<string> {
    const text = userText.trim();
    session.transcript.push({ role: 'user', text });
    const hard = this.escalations.scanKeywords(text);
    if (hard) {
      await this.createEscalation(session, hard.triggerType, hard.reason);
      const speak =
        'I am connecting you with a lawyer on this. A lawyer will take it from here. Please stay safe.';
      session.transcript.push({ role: 'assistant', text: speak });
      session.disposition = 'ESCALATED';
      session.shouldHangUp = true;
      return speak;
    }

    let turn: z.infer<typeof turnSchema>;
    try {
      turn = await this.planTurn(session, text);
    } catch (error) {
      this.logger.warn({ err: error instanceof Error ? error.message : 'unknown' }, 'receptionist LLM failed');
      turn = heuristicTurn(text, session.offeredSlots);
    }

    const spoken: string[] = [turn.speak];
    if (turn.tool === 'capture_intake') {
      await this.captureIntake(session, turn.intakeFacts ?? { notes: text }, turn.matterType);
    } else if (turn.tool === 'list_slots') {
      const offer = await this.slots.listOpenSlots(session.tenantId, { limit: 3 });
      session.offeredSlots = offer;
      spoken.push(formatSlots(offer));
    } else if (turn.tool === 'book_appointment') {
      const booked = await this.bookSlot(session, turn.slotIndex ?? 1);
      if (booked) spoken.push(booked);
    } else if (turn.tool === 'create_escalation') {
      await this.createEscalation(session, 'MANUAL', turn.speak);
      session.disposition = 'ESCALATED';
      session.shouldHangUp = true;
    } else if (turn.tool === 'get_firm_faq') {
      spoken.push(await this.answerFaq(session, turn.faqQuery ?? text));
    }

    if (turn.endCall) session.shouldHangUp = true;

    const reply = spoken.filter(Boolean).join(' ').trim();
    const cleaned = prepareSpokenTtsText(rewriteMissingAnswerReply(reply, 'EN'));
    session.transcript.push({ role: 'assistant', text: cleaned || reply });
    return cleaned || reply;
  }

  private async planTurn(session: ReceptionistSession, userText: string): Promise<z.infer<typeof turnSchema>> {
    const choice = this.modelRouter.choose('intake', session.tenantId, []);
    const client = this.clientFactory.get(choice.provider);
    const result = await client.call<z.infer<typeof turnSchema>>({
      tenantId: session.tenantId,
      agent: 'voice-receptionist',
      model: choice.model,
      outputSchema: turnSchema,
      messages: [
        {
          role: 'system',
          content: [
            `You are ${session.firmName}'s assistant on a live WhatsApp call — not the lawyer.`,
            buildAiAssumptionsBlock(session.settings),
            'Never give legal advice or predict outcomes.',
            'First utterance already disclosed you are not a lawyer.',
            'Pick one tool. Use list_slots when they want a meeting. Use book_appointment only after slots were offered and they pick 1/2/3.',
            'Use capture_intake for what happened / when / urgency.',
            'Use get_firm_faq for process questions. Use create_escalation when a lawyer must take over.',
            'Keep speak to 1-3 short spoken sentences.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            userText,
            offeredSlotCount: session.offeredSlots?.slots.length ?? 0,
            alreadyBooked: Boolean(session.appointmentId),
          }),
        },
      ],
    });
    return result.output;
  }

  private async captureIntake(
    session: ReceptionistSession,
    facts: Record<string, string>,
    matterType?: string,
  ): Promise<void> {
    await this.uow.withTenant(session.tenantId, async (tx) => {
      const existing = await tx.intakeSession.findUnique({
        where: { tenantId_conversationId: { tenantId: session.tenantId, conversationId: session.conversationId } },
      });
      const merged = {
        ...(existing ? asStringRecord(existing.extractedFields) : {}),
        ...facts,
        ...(matterType ? { matterType } : {}),
        source: 'voice_call',
      };
      if (existing) {
        await tx.intakeSession.update({
          where: { id: existing.id },
          data: { extractedFields: toInputJson(merged), currentStep: 'voice' },
        });
      } else {
        await tx.intakeSession.create({
          data: {
            tenantId: session.tenantId,
            conversationId: session.conversationId,
            extractedFields: toInputJson(merged),
            currentStep: 'voice',
          },
        });
      }
    });
    session.disposition = session.disposition === 'ABANDONED' ? 'INFO' : session.disposition;
  }

  private async bookSlot(session: ReceptionistSession, slotIndex: number): Promise<string | null> {
    const slot = session.offeredSlots?.slots[slotIndex - 1];
    const lawyerId = session.offeredSlots?.lawyerId;
    if (!slot || !lawyerId) {
      return 'I do not have an open slot to book yet. Would you like me to check availability?';
    }
    const booked = await this.appointments.book(session.tenantId, {
      clientId: session.clientId,
      lawyerId,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      notes: 'Booked on WhatsApp voice call',
    });
    session.appointmentId = booked.id;
    session.disposition = 'BOOKED';
    session.shouldHangUp = true;
    return `Booked with ${booked.lawyerName} at ${slot.startsAt.toISOString()}. A WhatsApp confirmation is on its way.`;
  }

  private async createEscalation(
    session: ReceptionistSession,
    triggerType: 'SELF_HARM' | 'DOMESTIC_VIOLENCE' | 'ACTIVE_ARREST' | 'IMMINENT_DEADLINE' | 'MANUAL',
    reason: string,
  ): Promise<void> {
    const created = await this.uow.withTenant(session.tenantId, async (tx) => {
      const assigneeUserId = await this.assignment.resolveAssigneeUserId(tx, {
        tenantId: session.tenantId,
        caseId: null,
      });
      const row = await tx.escalation.create({
        data: {
          tenantId: session.tenantId,
          conversationId: session.conversationId,
          triggerType,
          detectedExcerpt: reason.slice(0, 280),
          handoffReason: reason,
          handoffBrief: toInputJson({
            reason,
            facts: session.transcript.filter((t) => t.role === 'user').map((t) => t.text).slice(-6),
            documents: [],
            openItems: ['Return the WhatsApp voice call'],
            nextAction: 'Lawyer to call or message the client',
            situation: reason,
          }),
          slaDeadline: new Date(Date.now() + Math.max(session.settings.aiHandoffSlaMinutes, 15) * 60_000),
        },
      });
      await tx.conversation.update({
        where: { id: session.conversationId },
        data: { state: 'HUMAN_REQUIRED', assignedToId: assigneeUserId },
      });
      await this.outbox.append(tx, session.tenantId, DOMAIN_EVENTS.AiEscalationTriggered, {
        conversationId: session.conversationId,
        escalationId: row.id,
        triggerType,
      });
      return row;
    });
    session.escalationId = created.id;
  }

  private async answerFaq(session: ReceptionistSession, query: string): Promise<string> {
    const chunks = await this.retriever.search({
      tenantId: session.tenantId,
      query,
      language: 'en',
      topK: 3,
      clientId: session.clientId,
    });
    const selected = selectRelevantChunks([...chunks, ...matchPakistanLawyerKnowledge(query)]);
    if (selected.length === 0) {
      return rewriteMissingAnswerReply('I could not find that answer on file.', 'EN');
    }
    session.disposition = session.disposition === 'ABANDONED' ? 'INFO' : session.disposition;
    const grounded = selected
      .map((chunk) => chunk.content.replace(/\s+/g, ' ').trim())
      .join(' ')
      .slice(0, 500);
    return rewriteMissingAnswerReply(grounded, 'EN');
  }
}

function asStringRecord(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') out[key] = item;
  }
  return out;
}

function formatSlots(offer: OpenSlotOffer | null): string {
  if (!offer || offer.slots.length === 0) {
    return 'I do not see an open slot this week. A lawyer can propose a time on WhatsApp.';
  }
  const lines = offer.slots.map((slot, index) => `${index + 1}) ${slot.startsAt.toISOString()}`);
  return `Open slots with ${offer.lawyerName}: ${lines.join('; ')}. Say 1, 2, or 3.`;
}

export function receptionistGreeting(firmName: string): string {
  const name = firmName.trim() || 'the firm';
  return `Assalamualaikum. I'm the assistant for ${name}, not the lawyer. I'll answer you. How can I help?`;
}

export function heuristicTurn(
  text: string,
  offered: OpenSlotOffer | null,
): z.infer<typeof turnSchema> {
  const lower = text.toLowerCase();
  if (offered && offered.slots.length > 0 && /\b([123]|first|second|third)\b/.test(lower)) {
    const slotIndex = lower.includes('3') || lower.includes('third') ? 3 : lower.includes('2') || lower.includes('second') ? 2 : 1;
    return { speak: 'I will book that slot.', tool: 'book_appointment', slotIndex };
  }
  if (/\b(appoint|slot|meeting|consult|book|available)\b/.test(lower)) {
    return { speak: 'Let me check the diary.', tool: 'list_slots' };
  }
  if (/\b(fee|process|how long|documents?|cnic)\b/.test(lower)) {
    return { speak: 'I will check the firm knowledge base.', tool: 'get_firm_faq', faqQuery: text };
  }
  if (/\b(lawyer|human|agent|person)\b/.test(lower)) {
    return { speak: 'I will have a lawyer take this.', tool: 'create_escalation' };
  }
  return {
    speak: 'Please tell me briefly what happened and whether this is urgent.',
    tool: 'capture_intake',
    intakeFacts: { notes: text },
  };
}
