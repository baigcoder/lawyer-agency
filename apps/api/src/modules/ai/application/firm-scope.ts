import type { AgentIntent } from '../domain/types';
import type { AiSettings } from '../../firm-profile/application/ai-settings.dto';

/**
 * Detects casual / flirty / small-talk that is not a firm or legal question.
 * Simple greetings ("hi", "salam") are allowed; "hi love" is not.
 */
export function isCasualOffTopic(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower) return false;
  if (isPlainGreeting(lower)) return false;
  if (looksLikeLegalMatter(lower)) return false;
  return CASUAL_PATTERNS.some((pattern) => pattern.test(lower));
}

export function applyFirmScopeIntent(
  intent: AgentIntent,
  clientText: string,
  settings: AiSettings,
): AgentIntent {
  if (!settings.aiFirmScopeOnly) return intent;
  if (isCasualOffTopic(clientText)) return 'OFF_TOPIC';
  return intent;
}

function isPlainGreeting(lower: string): boolean {
  return /^(hi|hii+|hello|hey|salam|salaam|assalamu? ?alaikum|as-?salam|aoa|ok|okay|thanks|thank you|shukriya|jeee+|haan+|yes|no)[\s!.?]*$/i.test(
    lower,
  );
}

function looksLikeLegalMatter(lower: string): boolean {
  return /\b(lawyer|vakil|wakeel|case|court|divorce|bail|fir|cnic|property|inheritance|khula|nikah|contract|notice|hearing|appointment|document|fee|consultation|police|arrest)\b/.test(
    lower,
  );
}

const CASUAL_PATTERNS: RegExp[] = [
  /^(hi|hey|hello|yo)\s+(love|baby|babe|jaan|janu|jannu|cutie|handsome|beautiful|sweetie)\b/,
  /\b(i love you|love you|miss you|date me|marry me|wanna hang|let'?s (?:chat|talk|flirt)|what'?s up baby)\b/,
  /\b(bored|tell me a joke|sing (?:a |me a )?song|you'?re (?:hot|cute)|send (?:a )?selfie)\b/,
  /\b(pyar|mohabbat|jaaneman|meri jaan|love u)\b/,
];
