import { Inject, Injectable, Logger } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { toInputJson } from '../../../common/persistence/json';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { SendService } from '../../whatsapp/application/send.service';
import { VoiceReplyService } from '../../voice/application/voice-reply.service';
import { RETRIEVER, type Retriever } from '../../rag/application/retriever.port';
import { matchPakistanLawyerKnowledge } from '../../rag/application/pakistan-lawyer-knowledge';
import { PakistanKbSeedService } from '../../rag/application/pakistan-kb-seed.service';
import { detectLanguage, languageForUnusableVoiceNote, languageFromTranscript, MasterRouterService } from './agents/master-router.service';
import { IntakeAgent } from './agents/intake.agent';
import { FaqAgent } from './agents/faq.agent';
import { CaseUpdateAgent } from './agents/case-update.agent';
import { GreetingAgent } from './agents/greeting.agent';
import { EscalationDetectorService } from './escalation-detector.service';
import { AiContextBuilder } from './ai-context.builder';
import { EscalationAssignmentService } from './escalation-assignment.service';
import {
  renderFirstTurnDisclosure,
  renderHandoffMessage,
  renderOffTopicRedirect,
  formatRetrievedContext,
} from './ai-prompt-variables';
import { applyReplyLanguagePolicy } from './reply-language';
import { applyFirmScopeIntent, isCasualOffTopic } from './firm-scope';
import { isShortGreeting } from './dynamic-reply-rules';
import { rewriteMissingAnswerReply } from './missing-answer-reply';
import { shouldSendAiReply } from './ai-send-policy';
import { fastRoute, isAppointmentAsk, isUnusableVoiceTranscript } from './fast-route';
import { mergeIntakeFields } from './intake-fields';
import { selectRelevantChunks } from './retrieved-chunks';
import { PaymentInstructionService } from '../../payments/application/payment-instruction.service';
import { SlotFinderService } from '../../appointments/application/slot-finder.service';
import { AppointmentsService } from '../../appointments/application/appointments.service';
import { DocumentRequestsService } from '../../documents/application/document-requests.service';
import { CasesService } from '../../cases/application/cases.service';
import { HandoffBriefAgent } from './agents/handoff-brief.agent';
import {
  buildHandoffBrief,
  type HandoffBrief,
} from './handoff-brief';
import {
  formatBookFailed,
  formatNoSlots,
  formatReoffer,
  formatSlotOffer,
  isBookingConflict,
  parsePendingAppointment,
  parseSlotChoice,
  serializePendingAppointment,
} from './appointment-booking';
import {
  documentRequestDescription,
  formatDocumentAsk,
  formatDocumentCreateFailed,
  isDocumentAsk,
} from './document-collection';
import type { AgentIntent, AgentResult, Citation, Language } from '../domain/types';
import type { AiRunContext } from './ai-context.types';
import type { Prisma } from '../../../generated/prisma/client';

type OrchestratorSend =
  | { kind: 'none' }
  | {
      kind: 'reply';
      conversationId: string;
      toWaPhone: string;
      responseText: string;
      language: Language;
      inboundContentType: string;
    }
  | {
      kind: 'handoff';
      conversationId: string;
      toWaPhone: string;
      handoffText: string;
      language: Language;
      inboundContentType: string;
      escalationId: string;
      caseId: string | null;
      conversationHistory: string;
      handoffBrief: HandoffBrief;
      tenantAllowlist: string[];
    };

export interface ProcessInboundMessage {
  tenantId: string;
  conversationId: string;
  messageId: string;
  correlationId?: string | null | undefined;
}

interface InboundTurn {
  clientText: string;
  clientId: string;
  caseId: string | null;
  assignedToId: string | null;
  waPhone: string;
  messageId: string;
  createdAt: Date;
  payload: unknown;
  extractedFields: Record<string, unknown>;
}

function asFieldRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

function isHardHandoff(triggerType: string, intent: AgentIntent): boolean {
  return intent === 'HUMAN_HANDOFF' || triggerType !== 'MANUAL';
}

/**
 * Main AI orchestrator (Phase 7). Triggered by the `message.inbound.received`
 * domain event, it:
 *  1. Loads conversation + latest message
 *  2. Runs escalation detection
 *  3. Routes to the right agent
 *  4. Persists language/intake/citations/summary
 *  5. Sends a reply after the tenant transaction commits (nested withTenant
 *     during send deadlocks the pool and silently drops WhatsApp replies)
 *  6. Creates an escalation record when triggered
 *
 * Never gives legal advice; every LLM call is logged.
 */
@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);

  constructor(
    private readonly uow: UnitOfWork,
    private readonly send: SendService,
    private readonly voiceReply: VoiceReplyService,
    private readonly outbox: OutboxWriter,
    private readonly router: MasterRouterService,
    private readonly intake: IntakeAgent,
    private readonly faq: FaqAgent,
    private readonly caseUpdate: CaseUpdateAgent,
    private readonly greeting: GreetingAgent,
    private readonly escalationDetector: EscalationDetectorService,
    private readonly contextBuilder: AiContextBuilder,
    private readonly escalationAssignment: EscalationAssignmentService,
    @Inject(RETRIEVER) private readonly retriever: Retriever,
    private readonly pakistanKb: PakistanKbSeedService,
    private readonly paymentInstructions: PaymentInstructionService,
    private readonly slots: SlotFinderService,
    private readonly appointments: AppointmentsService,
    private readonly documentRequests: DocumentRequestsService,
    private readonly cases: CasesService,
    private readonly handoffBriefAgent: HandoffBriefAgent,
  ) {}

  async process(params: ProcessInboundMessage): Promise<void> {
    if (await this.tryPaymentDetailsIntercept(params)) return;
    if (await this.tryAppointmentIntercept(params)) return;
    if (await this.tryDocumentRequestIntercept(params)) return;

    const outcome = await this.uow.withTenant(params.tenantId, async (tx): Promise<OrchestratorSend> => {
      const conversation = await tx.conversation.findUnique({
        where: { id: params.conversationId },
        include: { case: true, client: true },
      });
      if (!conversation) return { kind: 'none' };

      const message = await tx.message.findFirst({
        where: { id: params.messageId },
      });
      if (!message || message.direction !== 'INBOUND') return { kind: 'none' };

      const clientText = message.body ?? '';
      const inboundPayload = asFieldRecord(message.payload);
      const sttLanguage =
        typeof inboundPayload['transcriptLanguage'] === 'string' ? inboundPayload['transcriptLanguage'] : null;
      const tenant = await tx.tenant.findUnique({ where: { id: params.tenantId }, select: { aiProviderAllowlist: true } });
      const allowlist = tenant?.aiProviderAllowlist ?? [];
      const likelyNeedsRag = !isShortGreeting(clientText) && !isCasualOffTopic(clientText);
      if (likelyNeedsRag) {
        this.pakistanKb.ensureForTenantInBackground(params.tenantId);
      }
      const retrievalPromise = likelyNeedsRag
        ? this.retriever.search({
            tenantId: params.tenantId,
            query: clientText,
            language: languageFromTranscript(clientText, ['EN', 'UR', 'ROMAN_URDU'], sttLanguage),
            topK: 6,
            clientId: conversation.clientId,
            caseId: conversation.caseId ?? undefined,
          })
        : Promise.resolve([]);

      const context = await this.contextBuilder.build({
        tenantId: params.tenantId,
        conversationId: params.conversationId,
        tx,
        retrievedChunks: [],
      });
      const retrievedChunks = selectRelevantChunks([
        ...(await retrievalPromise),
        ...(likelyNeedsRag ? matchPakistanLawyerKnowledge(clientText) : []),
      ]);
      context.retrievedChunks = retrievedChunks;
      context.retrievedContext = formatRetrievedContext(retrievedChunks);

      const heuristic = fastRoute({
        clientText,
        hasOpenCase: Boolean(conversation.caseId),
        hasIntakeFields: Object.keys(context.intakeFields).length > 0,
      });
      const skipRouter = Boolean(heuristic && heuristic.confidence >= 0.85);

      const [escalation, route] = await Promise.all([
        this.escalationDetector.detect({
          tenantId: params.tenantId,
          tenantAllowlist: allowlist,
          clientText,
          correlationId: params.correlationId,
        }),
        skipRouter && heuristic
          ? Promise.resolve({
              intent: heuristic.intent,
              reasoning: heuristic.reasoning,
              confidence: heuristic.confidence,
              language: languageFromTranscript(clientText, context.firm.clientLanguages, sttLanguage),
            })
          : this.router
              .route({
                tenantId: params.tenantId,
                tenantAllowlist: allowlist,
                clientText,
                conversationState: conversation.state,
                hasOpenCase: !!conversation.caseId,
                clientLanguages: context.firm.clientLanguages,
                conversationHistory: context.conversationHistory,
                correlationId: params.correlationId,
              })
              .catch((error: unknown) => {
                this.logger.warn(
                  { err: error instanceof Error ? error.message : 'router' },
                  'router LLM failed — using heuristic',
                );
                const fallback = heuristic ?? {
                  intent: 'GREETING' as const,
                  reasoning: 'router unavailable',
                  confidence: 0.5,
                };
                return {
                  intent: fallback.intent,
                  reasoning: fallback.reasoning,
                  confidence: fallback.confidence,
                  language: languageFromTranscript(clientText, context.firm.clientLanguages, sttLanguage),
                };
              }),
      ]);

      const detected = isUnusableVoiceTranscript(clientText)
        ? languageForUnusableVoiceNote(context.firm.clientLanguages)
        : languageFromTranscript(clientText, context.firm.clientLanguages, sttLanguage);
      const language = applyReplyLanguagePolicy(detected, context.aiSettings);
      let intent: AgentIntent = escalation
        ? 'HUMAN_HANDOFF'
        : applyFirmScopeIntent(route.intent, clientText, context.aiSettings);

      if (!escalation && isShortGreeting(clientText) && intent === 'INTAKE') {
        intent = 'GREETING';
      }
      if (!escalation && conversation.caseId && intent === 'INTAKE') {
        intent = 'CASE_UPDATE';
      }

      const agentResult = escalation
        ? {
            responseText: renderHandoffMessage(context, language),
            languageDetected: language,
            citations: [] as Citation[],
            escalation,
          }
        : await this.runAgent(intent, {
            tenantId: params.tenantId,
            tenantAllowlist: allowlist,
            clientText,
            language,
            context,
            conversation,
            correlationId: params.correlationId,
            escalation,
          }).catch((error: unknown): AgentResult => {
            this.logger.warn(
              { err: error instanceof Error ? error.message : 'agent' },
              'agent LLM failed — using spoken fallback',
            );
            return {
              responseText:
                language === 'UR'
                  ? 'میں نے آپ کی بات سن لی۔ براہ کرم بتائیں آپ کو کس قانونی معاملے میں مدد چاہیے؟'
                  : 'I heard you. What legal matter can we help with?',
              languageDetected: language,
              citations: [],
            };
          });
      const effectiveEscalation =
        escalation ??
        (intent === 'HUMAN_HANDOFF' || agentResult.needsLawyer
          ? {
              triggerType: 'MANUAL' as const,
              reason: agentResult.handoffReason || route.reasoning || 'Lawyer review requested',
              excerpt: clientText.slice(0, 200),
            }
          : null);
      const responseText = renderFirstTurnDisclosure(
        context,
        language,
        rewriteMissingAnswerReply(agentResult.responseText, language),
        message.contentType === 'AUDIO' ? 'voice' : 'text',
      );

      await tx.message.update({
        where: { id_createdAt: { id: message.id, createdAt: message.createdAt } },
        data: {
          languageDetected: language,
          payload: toInputJson({
            ...((message.payload as Record<string, unknown>) ?? {}),
            aiIntent: intent,
            aiReasoning: route.reasoning,
            aiConfidence: route.confidence,
            aiNeedsLawyer: Boolean(effectiveEscalation),
            aiHandoffReason: effectiveEscalation?.reason,
            caseSummary: agentResult.caseSummary,
            intakeFields: agentResult.intakeFields,
          }),
          citations: agentResult.citations as never,
        },
      });

      if (intent === 'INTAKE') {
        const intakeFields = mergeIntakeFields(context.intakeFields, agentResult.intakeFields);
        if (Object.keys(intakeFields).length > 0) {
          const intakeSessionId = await this.upsertIntakeSession(tx, params.tenantId, params.conversationId, intakeFields);
          await this.outbox.append(tx, params.tenantId, DOMAIN_EVENTS.AiIntakeCompleted, {
            conversationId: params.conversationId,
            intakeSessionId,
            practiceArea: (intakeFields['practiceArea'] as string) ?? undefined,
          });
        }
      }

      const openEscalation = await tx.escalation.findFirst({
        where: { conversationId: params.conversationId, status: 'OPEN' },
        select: { id: true },
      });

      if (effectiveEscalation && !openEscalation) {
        const practiceArea =
          (agentResult.intakeFields?.['practiceArea'] as string | undefined) ??
          (context.intakeFields['practiceArea'] as string | undefined);

        const assigneeUserId = await this.escalationAssignment.resolveAssigneeUserId(tx, {
          tenantId: params.tenantId,
          caseId: conversation.caseId,
          practiceArea,
        });

        const handoffBrief = await buildHandoffBrief(tx, {
          clientId: conversation.clientId,
          caseId: conversation.caseId,
          ...(conversation.case?.matterType
            ? { matterType: conversation.case.matterType }
            : practiceArea
              ? { matterType: practiceArea }
              : {}),
          intakeFields: mergeIntakeFields(context.intakeFields, agentResult.intakeFields),
          escalation: {
            triggerType: effectiveEscalation.triggerType,
            reason: effectiveEscalation.reason,
            excerpt: effectiveEscalation.excerpt,
          },
        });

        const created = await tx.escalation.create({
          data: {
            tenantId: params.tenantId,
            conversationId: params.conversationId,
            triggerType: effectiveEscalation.triggerType,
            detectedExcerpt: effectiveEscalation.excerpt,
            handoffReason: effectiveEscalation.reason,
            handoffBrief: toInputJson({
              reason: handoffBrief.reason,
              matterType: handoffBrief.matterType,
              facts: handoffBrief.facts,
              documents: handoffBrief.documents,
              openItems: handoffBrief.openItems,
              nextAction: handoffBrief.nextAction,
              situation: handoffBrief.situation,
            }),
            slaDeadline: new Date(
              Date.now() + (context.aiSettings.aiHandoffSlaMinutes || 15) * 60 * 1000,
            ),
          },
        });
        if (assigneeUserId) {
          await tx.conversation.update({
            where: { id: params.conversationId },
            data: { assignedToId: assigneeUserId },
          });
        }
        if (conversation.caseId) {
          await tx.case.update({
            where: { id: conversation.caseId },
            data: { summary: handoffBrief.nextAction },
          });
        }
        await this.outbox.append(tx, params.tenantId, DOMAIN_EVENTS.AiEscalationTriggered, {
          conversationId: params.conversationId,
          escalationId: created.id,
          triggerType: effectiveEscalation.triggerType,
        });

        if (isHardHandoff(effectiveEscalation.triggerType, intent)) {
          await tx.conversation.update({
            where: { id: params.conversationId },
            data: {
              state: 'HUMAN_REQUIRED',
              ...(assigneeUserId ? { assignedToId: assigneeUserId } : {}),
            },
          });
          return {
            kind: 'handoff',
            conversationId: params.conversationId,
            toWaPhone: conversation.client.waPhone,
            handoffText: renderFirstTurnDisclosure(
              context,
              language,
              renderHandoffMessage(context, language),
              message.contentType === 'AUDIO' ? 'voice' : 'text',
            ),
            language,
            inboundContentType: message.contentType,
            escalationId: created.id,
            caseId: conversation.caseId,
            conversationHistory: context.conversationHistory,
            handoffBrief,
            tenantAllowlist: allowlist,
          };
        }
      }

      if (
        !shouldSendAiReply({
          conversationState: conversation.state,
          hasOpenEscalation: Boolean(openEscalation),
          responseText,
        })
      ) {
        return { kind: 'none' };
      }

      if (context.aiSettings.aiAutoReplyRequiresApproval) {
        await tx.message.create({
          data: {
            tenantId: params.tenantId,
            conversationId: params.conversationId,
            direction: 'OUTBOUND',
            senderType: 'AI',
            contentType: 'TEXT',
            body: responseText,
            deliveryStatus: 'QUEUED',
            payload: toInputJson({ pendingApproval: true }),
          },
        });
        return { kind: 'none' };
      }

      if (conversation.state === 'HUMAN_REQUIRED') {
        await tx.conversation.update({
          where: { id: params.conversationId },
          data: { state: 'AI_ACTIVE' },
        });
      }

      return {
        kind: 'reply',
        conversationId: params.conversationId,
        toWaPhone: conversation.client.waPhone,
        responseText,
        language,
        inboundContentType: message.contentType,
      };
    });

    if (outcome.kind === 'reply') {
      await this.voiceReply.sendAiReply({
        tenantId: params.tenantId,
        conversationId: outcome.conversationId,
        toWaPhone: outcome.toWaPhone,
        responseText: outcome.responseText,
        language: outcome.language,
        inboundContentType: outcome.inboundContentType,
      });
      return;
    }

    if (outcome.kind === 'handoff') {
      await this.voiceReply.sendAiReply({
        tenantId: params.tenantId,
        conversationId: outcome.conversationId,
        toWaPhone: outcome.toWaPhone,
        responseText: outcome.handoffText,
        language: outcome.language,
        inboundContentType: outcome.inboundContentType,
      });
      await this.enrichHandoffSituation(params.tenantId, params.correlationId, outcome);
    }
  }

  private async enrichHandoffSituation(
    tenantId: string,
    correlationId: string | null | undefined,
    outcome: Extract<OrchestratorSend, { kind: 'handoff' }>,
  ): Promise<void> {
    try {
      const situation = await this.handoffBriefAgent.summarize({
        tenantId,
        tenantAllowlist: outcome.tenantAllowlist,
        conversationHistory: outcome.conversationHistory,
        brief: outcome.handoffBrief,
        correlationId,
      });
      if (!situation) return;

      const nextBrief = { ...outcome.handoffBrief, situation };
      await this.uow.withTenant(tenantId, async (tx) => {
        await tx.escalation.update({
          where: { id: outcome.escalationId },
          data: {
            handoffBrief: toInputJson({
              reason: nextBrief.reason,
              matterType: nextBrief.matterType,
              facts: nextBrief.facts,
              documents: nextBrief.documents,
              openItems: nextBrief.openItems,
              nextAction: nextBrief.nextAction,
              situation: nextBrief.situation,
            }),
          },
        });
        if (outcome.caseId) {
          await tx.case.update({
            where: { id: outcome.caseId },
            data: { summary: situation },
          });
        }
      });
    } catch (error) {
      this.logger.warn(
        { tenantId, conversationId: outcome.conversationId, error },
        'handoff brief situation update failed',
      );
    }
  }

  /**
   * Send stored JazzCash/Easypaisa/bank numbers outside the AI transaction so
   * nested `withTenant` + WhatsApp send cannot deadlock the pool.
   */
  private async tryPaymentDetailsIntercept(params: ProcessInboundMessage): Promise<boolean> {
    const loaded = await this.uow.withTenant(params.tenantId, async (tx) => {
      const conversation = await tx.conversation.findUnique({
        where: { id: params.conversationId },
        select: { clientId: true, caseId: true },
      });
      if (!conversation) return null;
      const message = await tx.message.findFirst({ where: { id: params.messageId } });
      if (!message || message.direction !== 'INBOUND') return null;
      return {
        clientText: message.body ?? '',
        clientId: conversation.clientId,
        caseId: conversation.caseId,
        messageId: message.id,
        createdAt: message.createdAt,
        payload: message.payload,
      };
    });
    if (!loaded || !this.paymentInstructions.isDetailsRequest(loaded.clientText)) return false;

    const sent = await this.paymentInstructions.handleClientRequest(params.tenantId, {
      clientId: loaded.clientId,
      ...(loaded.caseId ? { caseId: loaded.caseId } : {}),
    });
    if (!sent) return false;

    await this.uow.withTenant(params.tenantId, async (tx) => {
      await tx.message.update({
        where: { id_createdAt: { id: loaded.messageId, createdAt: loaded.createdAt } },
        data: {
          payload: toInputJson({
            ...((loaded.payload as Record<string, unknown>) ?? {}),
            aiIntent: 'PAYMENT_DETAILS',
          }),
        },
      });
    });
    return true;
  }

  /**
   * Offer or book a real lawyer slot outside the AI transaction so nested
   * `withTenant` + WhatsApp send cannot deadlock (same rule as payments).
   */
  private async tryAppointmentIntercept(params: ProcessInboundMessage): Promise<boolean> {
    const loaded = await this.loadInboundTurn(params);
    if (!loaded) return false;

    const language = detectLanguage(loaded.clientText, ['EN', 'UR', 'ROMAN_URDU']);
    const pending = parsePendingAppointment(loaded.extractedFields);
    const choice = parseSlotChoice(loaded.clientText, pending);

    if (choice && pending) {
      try {
        await this.appointments.book(params.tenantId, {
          clientId: loaded.clientId,
          lawyerId: pending.lawyerId,
          startsAt: choice.startsAt,
          endsAt: choice.endsAt,
          ...(loaded.caseId ? { caseId: loaded.caseId } : {}),
        });
      } catch (error) {
        if (isBookingConflict(error)) {
          await this.offerAppointmentSlots(params, loaded, language, true, pending.lawyerId);
          return true;
        }
        this.logger.warn(
          { tenantId: params.tenantId, conversationId: params.conversationId, error },
          'whatsapp appointment book failed',
        );
        await this.tagInboundIntent(params, loaded, 'APPOINTMENT');
        await this.send.send(params.tenantId, {
          conversationId: params.conversationId,
          toWaPhone: loaded.waPhone,
          senderType: 'AI',
          kind: 'text',
          body: formatBookFailed(language),
        });
        return true;
      }

      const cleared = { ...loaded.extractedFields };
      delete cleared['pendingAppointment'];
      await this.persistExtractedFields(params, loaded, cleared, 'APPOINTMENT');
      return true;
    }

    if (!isAppointmentAsk(loaded.clientText)) return false;
    await this.offerAppointmentSlots(params, loaded, language, false, pending?.lawyerId);
    return true;
  }

  private async offerAppointmentSlots(
    params: ProcessInboundMessage,
    loaded: InboundTurn,
    language: Language,
    conflict: boolean,
    lawyerId?: string | undefined,
  ): Promise<void> {
    const practiceArea =
      typeof loaded.extractedFields['practiceArea'] === 'string'
        ? loaded.extractedFields['practiceArea']
        : undefined;
    const offer = await this.slots.listOpenSlots(params.tenantId, {
      ...(lawyerId ? { lawyerId } : {}),
      ...(loaded.assignedToId ? { assignedUserId: loaded.assignedToId } : {}),
      ...(loaded.caseId ? { caseId: loaded.caseId } : {}),
      ...(practiceArea ? { practiceArea } : {}),
    });

    if (!offer || offer.slots.length === 0) {
      const fields = { ...loaded.extractedFields };
      delete fields['pendingAppointment'];
      await this.persistExtractedFields(params, loaded, fields, 'APPOINTMENT');
      await this.send.send(params.tenantId, {
        conversationId: params.conversationId,
        toWaPhone: loaded.waPhone,
        senderType: 'AI',
        kind: 'text',
        body: formatNoSlots(language),
      });
      return;
    }

    const pending = serializePendingAppointment(offer.lawyerId, offer.lawyerName, offer.slots);
    await this.persistExtractedFields(
      params,
      loaded,
      { ...loaded.extractedFields, pendingAppointment: pending },
      'APPOINTMENT',
    );
    const body = conflict
      ? formatReoffer(language, offer.lawyerName, offer.slots)
      : formatSlotOffer(language, offer.lawyerName, offer.slots);
    await this.send.send(params.tenantId, {
      conversationId: params.conversationId,
      toWaPhone: loaded.waPhone,
      senderType: 'AI',
      kind: 'text',
      body,
    });
  }

  /**
   * Create a PENDING document request (and a case if the conversation has none)
   * after the inbound load transaction, then ask the client to send the file.
   */
  private async tryDocumentRequestIntercept(params: ProcessInboundMessage): Promise<boolean> {
    const loaded = await this.loadInboundTurn(params);
    if (!loaded || !isDocumentAsk(loaded.clientText)) return false;

    const language = detectLanguage(loaded.clientText, ['EN', 'UR', 'ROMAN_URDU']);
    const description = documentRequestDescription(loaded.clientText, language);

    let caseId = loaded.caseId;
    try {
      if (!caseId) {
        const practiceArea =
          typeof loaded.extractedFields['practiceArea'] === 'string' &&
          loaded.extractedFields['practiceArea'].trim().length >= 2
            ? loaded.extractedFields['practiceArea'].trim()
            : 'Consultation';
        const created = await this.cases.create(params.tenantId, {
          clientId: loaded.clientId,
          matterType: practiceArea,
          urgency: 'NORMAL',
          summary: null,
          intakeData: {},
        });
        caseId = created.id;
        await this.uow.withTenant(params.tenantId, async (tx) => {
          await tx.conversation.update({
            where: { id: params.conversationId },
            data: { caseId },
          });
        });
      }

      const createdRequest = await this.documentRequests.create(params.tenantId, {
        caseId,
        clientId: loaded.clientId,
        description,
      });
      await this.persistExtractedFields(
        params,
        loaded,
        {
          ...loaded.extractedFields,
          pendingDocumentRequest: { requestId: createdRequest.id, description },
        },
        'DOCUMENT_REQUEST',
      );
    } catch (error) {
      this.logger.warn(
        { tenantId: params.tenantId, conversationId: params.conversationId, error },
        'whatsapp document request create failed',
      );
      await this.tagInboundIntent(params, loaded, 'DOCUMENT_REQUEST');
      await this.send.send(params.tenantId, {
        conversationId: params.conversationId,
        toWaPhone: loaded.waPhone,
        senderType: 'AI',
        kind: 'text',
        body: formatDocumentCreateFailed(language),
      });
      return true;
    }

    await this.send.send(params.tenantId, {
      conversationId: params.conversationId,
      toWaPhone: loaded.waPhone,
      senderType: 'AI',
      kind: 'text',
      body: formatDocumentAsk(language, description),
    });
    return true;
  }

  private async loadInboundTurn(params: ProcessInboundMessage): Promise<InboundTurn | null> {
    return this.uow.withTenant(params.tenantId, async (tx) => {
      const conversation = await tx.conversation.findUnique({
        where: { id: params.conversationId },
        include: { client: { select: { waPhone: true } } },
      });
      if (!conversation) return null;
      const message = await tx.message.findFirst({ where: { id: params.messageId } });
      if (!message || message.direction !== 'INBOUND') return null;
      const intake = await tx.intakeSession.findUnique({
        where: { tenantId_conversationId: { tenantId: params.tenantId, conversationId: params.conversationId } },
      });
      return {
        clientText: message.body ?? '',
        clientId: conversation.clientId,
        caseId: conversation.caseId,
        assignedToId: conversation.assignedToId,
        waPhone: conversation.client.waPhone,
        messageId: message.id,
        createdAt: message.createdAt,
        payload: message.payload,
        extractedFields: asFieldRecord(intake?.extractedFields),
      };
    });
  }

  private async persistExtractedFields(
    params: ProcessInboundMessage,
    loaded: InboundTurn,
    fields: Record<string, unknown>,
    intent: AgentIntent,
  ): Promise<void> {
    await this.uow.withTenant(params.tenantId, async (tx) => {
      await this.upsertIntakeSession(tx, params.tenantId, params.conversationId, fields);
      await tx.message.update({
        where: { id_createdAt: { id: loaded.messageId, createdAt: loaded.createdAt } },
        data: {
          payload: toInputJson({
            ...((loaded.payload as Record<string, unknown>) ?? {}),
            aiIntent: intent,
          }),
        },
      });
    });
  }

  private async tagInboundIntent(
    params: ProcessInboundMessage,
    loaded: InboundTurn,
    intent: AgentIntent,
  ): Promise<void> {
    await this.uow.withTenant(params.tenantId, async (tx) => {
      await tx.message.update({
        where: { id_createdAt: { id: loaded.messageId, createdAt: loaded.createdAt } },
        data: {
          payload: toInputJson({
            ...((loaded.payload as Record<string, unknown>) ?? {}),
            aiIntent: intent,
          }),
        },
      });
    });
  }

  private async runAgent(
    intent: AgentIntent,
    ctx: {
      tenantId: string;
      tenantAllowlist: string[];
      clientText: string;
      language: Language;
      context: AiRunContext;
      conversation: { clientId: string; caseId?: string | null; case?: { reference: string; matterType: string } | null };
      correlationId?: string | null | undefined;
      escalation: Awaited<ReturnType<EscalationDetectorService['detect']>>;
    },
  ): Promise<AgentResult> {
    const base = {
      tenantId: ctx.tenantId,
      tenantAllowlist: ctx.tenantAllowlist,
      clientText: ctx.clientText,
      language: ctx.language,
      context: ctx.context,
      correlationId: ctx.correlationId,
      escalation: ctx.escalation,
    };

    switch (intent) {
      case 'FAQ':
        return this.faq.run(base);
      case 'CASE_UPDATE':
        return this.caseUpdate.run({
          ...base,
          caseReference: ctx.conversation.case?.reference ?? 'UNKNOWN',
          caseMatterType: ctx.conversation.case?.matterType ?? 'general',
        });
      case 'HUMAN_HANDOFF':
        return {
          responseText: renderHandoffMessage(ctx.context, ctx.language),
          languageDetected: ctx.language,
          citations: [] as Citation[],
          escalation: ctx.escalation ?? undefined,
        };
      case 'GREETING':
        return this.greeting.run({
          tenantId: ctx.tenantId,
          tenantAllowlist: ctx.tenantAllowlist,
          clientText: ctx.clientText,
          language: ctx.language,
          context: ctx.context,
          correlationId: ctx.correlationId,
        });
      case 'OFF_TOPIC':
        return {
          responseText: renderOffTopicRedirect(ctx.context, ctx.language),
          languageDetected: ctx.language,
          citations: [] as Citation[],
        };
      case 'APPOINTMENT':
        return this.intake.run({ ...base, taskFocus: 'appointment' });
      case 'DOCUMENT_REQUEST':
        return this.intake.run({ ...base, taskFocus: 'documents' });
      case 'INTAKE':
      default:
        return this.intake.run(base);
    }
  }

  private async upsertIntakeSession(
    tx: Prisma.TransactionClient,
    tenantId: string,
    conversationId: string,
    fields: Record<string, unknown>,
  ): Promise<string> {
    const jsonFields = toInputJson(fields);
    const result = await tx.intakeSession.upsert({
      where: { tenantId_conversationId: { tenantId, conversationId } },
      create: {
        tenantId,
        conversationId,
        extractedFields: jsonFields,
      },
      update: {
        extractedFields: jsonFields,
      },
    });
    return result.id;
  }
}
