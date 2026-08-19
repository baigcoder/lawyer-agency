/**
 * Domain vocabulary for the AI pipeline (Phase 7). No framework/vendor imports.
 */

export type AgentIntent =
  | 'INTAKE'
  | 'FAQ'
  | 'CASE_UPDATE'
  | 'APPOINTMENT'
  | 'DOCUMENT_REQUEST'
  | 'HUMAN_HANDOFF'
  | 'GREETING'
  | 'OFF_TOPIC';

export type Language = 'EN' | 'UR' | 'UNKNOWN';

export interface Citation {
  chunkId: string;
  title: string;
  kbId?: string | undefined;
  documentId?: string | undefined;
}

export interface AgentResult {
  responseText: string;
  languageDetected: Language;
  citations: Citation[];
  needsLawyer?: boolean | undefined;
  handoffReason?: string | undefined;
  escalation?: EscalationSignal | undefined;
  intakeFields?: Record<string, unknown> | undefined;
  caseSummary?: string | undefined;
}

export interface EscalationSignal {
  triggerType: 'SELF_HARM' | 'DOMESTIC_VIOLENCE' | 'ACTIVE_ARREST' | 'IMMINENT_DEADLINE' | 'MANUAL';
  reason: string;
  excerpt: string;
}

export interface RouterDecision {
  intent: AgentIntent;
  reasoning: string;
  confidence: number;
}
