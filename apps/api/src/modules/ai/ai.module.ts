import { Module, type DynamicModule } from '@nestjs/common';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { RagModule } from '../rag/rag.module';
import { VoiceModule } from '../voice/voice.module';
import { PaymentsModule } from '../payments/payments.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { DocumentsModule } from '../documents/documents.module';
import { CasesModule } from '../cases/cases.module';
import { AiLlmModule } from './ai-llm.module';
import { MasterRouterService } from './application/agents/master-router.service';
import { IntakeAgent } from './application/agents/intake.agent';
import { FaqAgent } from './application/agents/faq.agent';
import { CaseUpdateAgent } from './application/agents/case-update.agent';
import { GreetingAgent } from './application/agents/greeting.agent';
import { HandoffBriefAgent } from './application/agents/handoff-brief.agent';
import { EscalationDetectorService } from './application/escalation-detector.service';
import { AiOrchestratorService } from './application/ai-orchestrator.service';
import { AiEventHandler } from './application/ai-event.handler';
import { PrismaPromptRepository } from './infrastructure/prompt.repository';
import { AiContextBuilder } from './application/ai-context.builder';
import { EscalationAssignmentService } from './application/escalation-assignment.service';
import { EscalationsService } from './application/escalations.service';
import { EscalationsController } from './interface/escalations.controller';
import { PROMPT_REPOSITORY } from './application/ports';

/**
 * AI — the agent pipeline: master router, intake, classification,
 * conversation, summarization, FAQ, appointment/document/payment/reminder
 * agents, human-handoff. Model routing per D-006; data tiering per D-005;
 * every call logged (FR-AI-10).
 * Owns: ai_logs, prompt_logs, escalations (+ platform.prompt_versions).
 * Publishes: ai.escalation.triggered, ai.intake.completed.
 * Consumes: Messages (via domain events), RAG, Cases, WhatsApp SendService.
 *
 * Phase 7: router + intake/FAQ/case-update agents + escalation detector +
 * model/budget guard + async domain-event processor (worker role only).
 */
@Module({})
export class AiModule {
  static register(role: 'api' | 'worker'): DynamicModule {
    return {
      module: AiModule,
      imports: [
        AiLlmModule,
        WhatsappModule.register(role),
        RagModule,
        VoiceModule.register(role),
        PaymentsModule.register(role),
        AppointmentsModule,
        DocumentsModule.register(role),
        CasesModule.register(role),
      ],
      controllers: role === 'api' ? [EscalationsController] : [],
      providers: [
        { provide: PROMPT_REPOSITORY, useClass: PrismaPromptRepository },
        AiContextBuilder,
        EscalationAssignmentService,
        EscalationsService,
        MasterRouterService,
        IntakeAgent,
        FaqAgent,
        CaseUpdateAgent,
        GreetingAgent,
        HandoffBriefAgent,
        EscalationDetectorService,
        AiOrchestratorService,
        AiEventHandler,
      ],
      exports: [AiOrchestratorService, AiEventHandler],
    };
  }
}
