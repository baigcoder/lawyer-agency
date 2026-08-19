import { describe, expect, it, vi } from 'vitest';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { VoiceReplyService } from '../../voice/application/voice-reply.service';
import { SendService } from '../../whatsapp/application/send.service';
import { MasterRouterService } from './agents/master-router.service';
import { IntakeAgent } from './agents/intake.agent';
import { FaqAgent } from './agents/faq.agent';
import { CaseUpdateAgent } from './agents/case-update.agent';
import { GreetingAgent } from './agents/greeting.agent';
import { EscalationDetectorService } from './escalation-detector.service';
import { AiContextBuilder } from './ai-context.builder';
import { EscalationAssignmentService } from './escalation-assignment.service';
import type { AgentResult } from '../domain/types';
import { defaultAiSettings } from '../../firm-profile/application/ai-settings.dto';

function makeService(overrides: {
  escalation?: ReturnType<EscalationDetectorService['detect']> | null;
  intent?: 'INTAKE' | 'FAQ' | 'CASE_UPDATE' | 'HUMAN_HANDOFF' | 'GREETING' | 'OFF_TOPIC';
  agentResult?: AgentResult;
  assigneeUserId?: string | null;
  conversationState?: 'AI_ACTIVE' | 'HUMAN_REQUIRED' | 'HUMAN_ACTIVE' | 'CLOSED';
  openEscalation?: { id: string } | null;
  aiSettings?: Partial<ReturnType<typeof defaultAiSettings>>;
  clientText?: string;
  pendingAppointment?: {
    lawyerId: string;
    lawyerName: string;
    slots: Array<{ startsAt: string; endsAt: string }>;
  };
} = {}) {
  const conversation = {
    id: 'conv-1',
    tenantId: 't1',
    clientId: 'client-1',
    state: overrides.conversationState ?? 'AI_ACTIVE',
    caseId: null,
    assignedToId: null,
    lastClientMessageAt: new Date('2026-08-01T00:00:00Z'),
    client: { waPhone: '923001234567' },
    case: null,
  };
  const message = {
    id: 'msg-1',
    tenantId: 't1',
    conversationId: 'conv-1',
    direction: 'INBOUND' as const,
    contentType: 'TEXT',
    body: overrides.clientText ?? 'I need help',
    payload: {},
    createdAt: new Date('2026-08-01T00:00:00Z'),
  };

  const tx = {
    conversation: {
      findUnique: vi.fn(async () => conversation),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        ...conversation,
        ...args.data,
      })),
    },
    message: {
      findFirst: vi.fn(async () => message),
      update: vi.fn(async () => message),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'draft-1', ...args.data })),
    },
    tenant: { findUnique: vi.fn(async () => ({ aiProviderAllowlist: [] })) },
    intakeSession: {
      upsert: vi.fn(async () => ({ id: 'intake-1' })),
      findUnique: vi.fn(async () =>
        overrides.pendingAppointment
          ? { extractedFields: { pendingAppointment: overrides.pendingAppointment } }
          : null,
      ),
    },
    documentRequest: { findMany: vi.fn(async () => []) },
    document: { findMany: vi.fn(async () => []) },
    payment: { findMany: vi.fn(async () => []) },
    case: { update: vi.fn(async () => ({})) },
    escalation: {
      create: vi.fn(async () => ({ id: 'esc-1' })),
      findFirst: vi.fn(async () => overrides.openEscalation ?? null),
      update: vi.fn(async () => ({ id: 'esc-1' })),
    },
  };

  const uow = {
    withTenant: vi.fn(async (_tenantId: string, fn: (inner: unknown) => Promise<unknown>) => fn(tx)),
  } as unknown as UnitOfWork;

  const send = { send: vi.fn(async () => ({ wamid: 'wamid.out' })) } as unknown as SendService;
  const outbox = { append: vi.fn(async () => {}) } as unknown as OutboxWriter;

  const router = {
    route: vi.fn(async () => ({
      intent: overrides.intent ?? 'INTAKE',
      reasoning: 'test',
      confidence: 0.9,
      language: 'EN' as const,
    })),
  } as unknown as MasterRouterService;

  const intake = {
    run: vi.fn(async () =>
      (overrides.agentResult ?? {
        responseText: 'Thanks, a few questions.',
        languageDetected: 'EN',
        citations: [],
        intakeFields: { practiceArea: 'Family Law' },
      }) as AgentResult),
  } as unknown as IntakeAgent;

  const faq = { run: vi.fn(async () => overrides.agentResult as AgentResult) } as unknown as FaqAgent;
  const caseUpdate = { run: vi.fn(async () => overrides.agentResult as AgentResult) } as unknown as CaseUpdateAgent;
  const greeting = {
    run: vi.fn(async () =>
      (overrides.agentResult ?? {
        responseText: 'Hello from Test Firm — how may I help?',
        languageDetected: 'EN',
        citations: [],
      }) as AgentResult),
  } as unknown as GreetingAgent;
  const escalationDetector = {
    detect: vi.fn(async () => overrides.escalation ?? null),
  } as unknown as EscalationDetectorService;

  const contextBuilder = {
    build: vi.fn(async () => ({
      firm: {
        firmName: 'Test Firm',
        displayName: 'Test Firm',
        city: 'Lahore',
        officeAddress: '',
        website: '',
        practiceAreas: ['Family Law'],
        clientLanguages: ['EN'],
        officeHours: '9-5',
        consultationFeePkr: 0,
      },
      aiSettings: { ...defaultAiSettings(), ...overrides.aiSettings },
      isFirstClientTurn: true,
      conversationHistory: '',
      lastAiReply: '',
      intakeFields: {},
      clientId: 'client-1',
      caseId: undefined,
      retrievedChunks: [],
      retrievedContext: '',
    })),
  } as unknown as AiContextBuilder;

  const escalationAssignment = {
    resolveAssigneeUserId: vi.fn(async () => overrides.assigneeUserId ?? 'lawyer-user-1'),
  } as unknown as EscalationAssignmentService;

  const retriever = {
    search: vi.fn(async () => []),
  };

  const voiceReply = { sendAiReply: vi.fn(async () => {}) } as unknown as VoiceReplyService;
  const paymentInstructions = {
    isDetailsRequest: vi.fn((text: string) => /jazzcash|payment details|easypaisa/i.test(text)),
    handleClientRequest: vi.fn(async () => false),
  };

  const slotA = {
    startsAt: new Date('2026-08-20T06:00:00.000Z'),
    endsAt: new Date('2026-08-20T06:30:00.000Z'),
  };
  const slotB = {
    startsAt: new Date('2026-08-21T10:00:00.000Z'),
    endsAt: new Date('2026-08-21T10:30:00.000Z'),
  };
  const slotC = {
    startsAt: new Date('2026-08-22T04:00:00.000Z'),
    endsAt: new Date('2026-08-22T04:30:00.000Z'),
  };
  const slots = {
    listOpenSlots: vi.fn(async () => ({
      lawyerId: 'lawyer-1',
      lawyerName: 'Adv. Ali',
      slots: [slotA, slotB, slotC],
    })),
  };
  const appointments = {
    book: vi.fn(async () => ({ id: 'apt-1' })),
  };
  const documentRequests = {
    create: vi.fn(async () => ({ id: 'dr-1' })),
  };
  const cases = {
    create: vi.fn(async () => ({ id: 'case-1' })),
  };

  return {
    service: new AiOrchestratorService(
      uow,
      send,
      voiceReply,
      outbox,
      router,
      intake,
      faq,
      caseUpdate,
      greeting,
      escalationDetector,
      contextBuilder,
      escalationAssignment,
      retriever as never,
      paymentInstructions as never,
      slots as never,
      appointments as never,
      documentRequests as never,
      cases as never,
      { summarize: vi.fn(async () => null) } as never,
    ),
    send,
    voiceReply,
    outbox,
    tx,
    escalationAssignment,
    greeting,
    intake,
    paymentInstructions,
    router,
    slots,
    appointments,
    documentRequests,
    cases,
  };
}

describe('AiOrchestratorService', () => {
  it('runs intake agent and sends a reply', async () => {
    const { service, voiceReply } = makeService();
    await service.process({ tenantId: 't1', conversationId: 'conv-1', messageId: 'msg-1' });
    expect(voiceReply.sendAiReply).toHaveBeenCalledWith(
      expect.objectContaining({
        responseText: expect.stringContaining('Thanks, a few questions.'),
      }),
    );
  });

  it('sends handoff message and assigns lawyer when escalation detected', async () => {
    const { service, send, outbox, tx, escalationAssignment } = makeService({
      escalation: { triggerType: 'DOMESTIC_VIOLENCE', reason: 'abuse', excerpt: 'he hit me' },
      assigneeUserId: 'lawyer-1',
    });
    await service.process({ tenantId: 't1', conversationId: 'conv-1', messageId: 'msg-1' });
    expect(tx.escalation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          handoffReason: 'abuse',
          handoffBrief: expect.objectContaining({ reason: 'abuse', nextAction: expect.any(String) }),
        }),
      }),
    );
    expect(escalationAssignment.resolveAssigneeUserId).toHaveBeenCalled();
    expect(tx.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: 'HUMAN_REQUIRED', assignedToId: 'lawyer-1' }),
      }),
    );
    expect(send.send).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ kind: 'text', body: expect.stringContaining('Test Firm') }),
    );
    expect(outbox.append).toHaveBeenCalledWith(expect.anything(), 't1', 'ai.escalation.triggered', expect.any(Object));
  });

  it('creates a real lawyer handoff when an agent requests professional review', async () => {
    const { service, send, tx } = makeService({
      agentResult: {
        responseText: 'This requires professional review.',
        languageDetected: 'EN',
        citations: [],
        needsLawyer: true,
        handoffReason: 'Case-specific tax position',
      },
      aiSettings: { aiHandoffSlaMinutes: 5 },
    });

    await service.process({ tenantId: 't1', conversationId: 'conv-1', messageId: 'msg-1' });

    expect(tx.escalation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ triggerType: 'MANUAL' }),
      }),
    );
    expect(tx.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'HUMAN_REQUIRED' }) }),
    );
    expect(send.send).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ body: expect.stringContaining('within 5 minutes') }),
    );
  });

  it('routes short greetings to the greeting agent even when the router says INTAKE', async () => {
    const { service, greeting, intake, router } = makeService({ intent: 'INTAKE', clientText: 'Hy' });
    await service.process({ tenantId: 't1', conversationId: 'conv-1', messageId: 'msg-1' });
    expect(greeting.run).toHaveBeenCalled();
    expect(intake.run).not.toHaveBeenCalled();
    expect(router.route).not.toHaveBeenCalled();
  });

  it('uses the greeting agent for plain greetings', async () => {
    const { service, voiceReply } = makeService({ intent: 'GREETING', clientText: 'Hello' });
    await service.process({ tenantId: 't1', conversationId: 'conv-1', messageId: 'msg-1' });
    expect(voiceReply.sendAiReply).toHaveBeenCalledWith(
      expect.objectContaining({ responseText: expect.stringContaining('Test Firm') }),
    );
  });

  it('emits ai.intake.completed for INTAKE results', async () => {
    const { service, outbox } = makeService({ intent: 'INTAKE' });
    await service.process({ tenantId: 't1', conversationId: 'conv-1', messageId: 'msg-1' });
    expect(outbox.append).toHaveBeenCalledWith(expect.anything(), 't1', 'ai.intake.completed', expect.any(Object));
  });

  it('redirects off-topic chat instead of a casual reply', async () => {
    const { service, voiceReply } = makeService({ intent: 'OFF_TOPIC', clientText: 'hi love' });
    await service.process({ tenantId: 't1', conversationId: 'conv-1', messageId: 'msg-1' });
    expect(voiceReply.sendAiReply).toHaveBeenCalledWith(
      expect.objectContaining({ responseText: expect.stringContaining('not casual chat') }),
    );
  });

  it('resumes a HUMAN_REQUIRED conversation when there is no open escalation', async () => {
    const { service, voiceReply, tx } = makeService({ conversationState: 'HUMAN_REQUIRED' });
    await service.process({ tenantId: 't1', conversationId: 'conv-1', messageId: 'msg-1' });
    expect(tx.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { state: 'AI_ACTIVE' } }),
    );
    expect(voiceReply.sendAiReply).toHaveBeenCalled();
  });

  it('does not send when HUMAN_REQUIRED has an open escalation', async () => {
    const { service, voiceReply } = makeService({
      conversationState: 'HUMAN_REQUIRED',
      openEscalation: { id: 'esc-open' },
    });
    await service.process({ tenantId: 't1', conversationId: 'conv-1', messageId: 'msg-1' });
    expect(voiceReply.sendAiReply).not.toHaveBeenCalled();
  });

  it('sends stored payment details and skips the LLM when the client asks for JazzCash', async () => {
    const { service, voiceReply, intake, paymentInstructions } = makeService({
      clientText: 'please send JazzCash number',
    });
    paymentInstructions.handleClientRequest.mockResolvedValue(true);
    await service.process({ tenantId: 't1', conversationId: 'conv-1', messageId: 'msg-1' });
    expect(paymentInstructions.handleClientRequest).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ clientId: 'client-1' }),
    );
    expect(intake.run).not.toHaveBeenCalled();
    expect(voiceReply.sendAiReply).not.toHaveBeenCalled();
  });

  it('offers numbered slots and skips the intake LLM when the client asks for an appointment', async () => {
    const { service, voiceReply, intake, slots, send, tx } = makeService({
      clientText: 'I need an appointment',
    });
    await service.process({ tenantId: 't1', conversationId: 'conv-1', messageId: 'msg-1' });
    expect(slots.listOpenSlots).toHaveBeenCalled();
    expect(intake.run).not.toHaveBeenCalled();
    expect(voiceReply.sendAiReply).not.toHaveBeenCalled();
    expect(send.send).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ body: expect.stringMatching(/Reply 1, 2, or 3/) }),
    );
    expect(tx.intakeSession.upsert).toHaveBeenCalled();
  });

  it('books the chosen slot after a numbered reply and does not send a second AI bubble', async () => {
    const pending = {
      lawyerId: 'lawyer-1',
      lawyerName: 'Adv. Ali',
      slots: [
        { startsAt: '2026-08-20T06:00:00.000Z', endsAt: '2026-08-20T06:30:00.000Z' },
        { startsAt: '2026-08-21T10:00:00.000Z', endsAt: '2026-08-21T10:30:00.000Z' },
        { startsAt: '2026-08-22T04:00:00.000Z', endsAt: '2026-08-22T04:30:00.000Z' },
      ],
    };
    const { service, appointments, intake, voiceReply, send } = makeService({
      clientText: '2',
      pendingAppointment: pending,
    });
    await service.process({ tenantId: 't1', conversationId: 'conv-1', messageId: 'msg-1' });
    expect(appointments.book).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        lawyerId: 'lawyer-1',
        startsAt: '2026-08-21T10:00:00.000Z',
        endsAt: '2026-08-21T10:30:00.000Z',
      }),
    );
    expect(intake.run).not.toHaveBeenCalled();
    expect(voiceReply.sendAiReply).not.toHaveBeenCalled();
    expect(send.send).not.toHaveBeenCalled();
  });

  it('creates a case and document request when the client offers to send documents', async () => {
    const { service, cases, documentRequests, intake, send } = makeService({
      clientText: 'I will send documents',
    });
    await service.process({ tenantId: 't1', conversationId: 'conv-1', messageId: 'msg-1' });
    expect(cases.create).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ clientId: 'client-1', matterType: 'Consultation' }),
    );
    expect(documentRequests.create).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ caseId: 'case-1', clientId: 'client-1' }),
    );
    expect(intake.run).not.toHaveBeenCalled();
    expect(send.send).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ body: expect.stringContaining('Please send') }),
    );
  });
});
