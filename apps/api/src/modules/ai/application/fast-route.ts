import type { AgentIntent } from '../domain/types';
import { isCasualOffTopic } from './firm-scope';
import { isShortGreeting } from './dynamic-reply-rules';
import { isDocumentAsk } from './document-collection';

export interface FastRouteDecision {
  intent: AgentIntent;
  reasoning: string;
  confidence: number;
}

/**
 * Deterministic intent for common WhatsApp turns so the orchestrator can skip
 * the router LLM. Returns null when the message still needs model classification.
 */
export function fastRoute(params: {
  clientText: string;
  hasOpenCase: boolean;
  hasIntakeFields: boolean;
}): FastRouteDecision | null {
  const text = params.clientText.trim();
  if (!text) return { intent: 'GREETING', reasoning: 'empty message', confidence: 0.99 };
  if (isUnusableVoiceTranscript(text)) {
    return { intent: 'GREETING', reasoning: 'voice note without a transcript', confidence: 0.99 };
  }

  if (isCasualOffTopic(text)) {
    return { intent: 'OFF_TOPIC', reasoning: 'casual/flirty small talk', confidence: 0.95 };
  }
  if (isShortGreeting(text)) {
    return { intent: 'GREETING', reasoning: 'short greeting', confidence: 0.98 };
  }
  if (isExplicitHandoff(text)) {
    return { intent: 'HUMAN_HANDOFF', reasoning: 'client asked for a lawyer', confidence: 0.93 };
  }
  if (isAppointmentAsk(text)) {
    return { intent: 'APPOINTMENT', reasoning: 'appointment request', confidence: 0.9 };
  }
  if (isDocumentAsk(text)) {
    return { intent: 'DOCUMENT_REQUEST', reasoning: 'client will send documents', confidence: 0.9 };
  }
  if (isGeneralFaq(text)) {
    return { intent: 'FAQ', reasoning: 'general process/fee/hours question', confidence: 0.88 };
  }
  if (params.hasOpenCase && !isNewMatter(text)) {
    return { intent: 'CASE_UPDATE', reasoning: 'open case, continuing facts', confidence: 0.86 };
  }
  if (isNewMatter(text)) {
    return { intent: 'INTAKE', reasoning: 'new legal matter', confidence: 0.9 };
  }
  if (params.hasIntakeFields && text.length < 280 && !isGeneralFaq(text)) {
    return { intent: 'INTAKE', reasoning: 'continuing intake answers', confidence: 0.87 };
  }
  return null;
}

export function isUnusableVoiceTranscript(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return (
    normalized.startsWith('(voice note') ||
    normalized === '(voice note — transcription unavailable)' ||
    normalized === '(voice note — no transcript)'
  );
}

export function needsRetrieval(intent: AgentIntent): boolean {
  return intent === 'FAQ' || intent === 'INTAKE' || intent === 'CASE_UPDATE' || intent === 'APPOINTMENT' || intent === 'DOCUMENT_REQUEST';
}

function isExplicitHandoff(text: string): boolean {
  return /\b(talk to (a |the )?lawyer|speak (to|with) (a |the )?lawyer|real lawyer|human please|vakil se baat|wakeel se baat|وکیل سے بات|lawyer se baat|assign (me )?a lawyer)\b/i.test(
    text,
  );
}

export function isAppointmentAsk(text: string): boolean {
  return /\b(appointment|booking|book (a |me )?(slot|meeting|appointment)?|available (time|slot)|mulaqat|ملاقات|consult(ation)? (time|today|tomorrow)|schedule (a )?(meeting|appointment)|slot chahiye|time chahiye)\b/i.test(
    text,
  );
}

function isGeneralFaq(text: string): boolean {
  if (isNewMatter(text)) return false;
  return /\b(fee|fees|charges|kitni fee|consultation fee|office hours|timings?|address|location|kahan ho|documents? (needed|required)|how long does|process (for|of)|procedure|kitna time)\b/i.test(
    text,
  );
}

function isNewMatter(text: string): boolean {
  return /\b(my (husband|wife|case|property|brother|sister|son|daughter)|i (was|am|have been) (arrested|fired|served)|divorce|khula|fir|bail|inheritance|i need help)\b/i.test(
    text,
  );
}
