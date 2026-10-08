/**
 * Last check on a model reply before it reaches the client. The prompts say
 * all of this already; measured on the live models they still slip:
 *
 * - a made-up duration ("khula 3-6 mahine lagta hai") — a timeline the firm
 *   never gave, read by the client as a promise;
 * - the firm's sales line in a bail answer ("same-day bail response") — heard
 *   as "you will get bail today";
 * - a masculine verb from the female assistant ("samajh gaya", "سمجھ گیا").
 *
 * Each fix only removes or re-inflects; it never writes new content.
 */
export interface ReplyGuardInput {
  /** What the client said this turn, plus anything the model was allowed to quote. */
  clientText: string;
  sources: string;
  differentiators: string[];
  voiceGender: 'male' | 'female';
}

const DURATION =
  /(\d+(?:\s*(?:-|–|to|se|سے)\s*\d+)?)\s*(?:mahine|mahina|months?|saal|years?|din|days?|hafte|hafta|weeks?|ghante|hours?|مہینے|مہینہ|سال|دن|ہفتے|گھنٹے)/gi;

const OUTCOME_QUESTION = /bail|zamanat|guarantee|gaurantee|ضمانت|گارنٹی|kitne din|kab tak|how long|outcome|result|faisla|فیصلہ/i;

export function guardReply(text: string, input: ReplyGuardInput): string {
  const known = `${input.clientText}\n${input.sources}`;
  const outcomeQuestion = OUTCOME_QUESTION.test(input.clientText);
  const bad = (clause: string) =>
    inventsDuration(clause, known) || (outcomeQuestion && mentionsDifferentiator(clause, input.differentiators));
  const lines = text.split('\n').map((line) =>
    splitSentences(line)
      .map((s) => (bad(s) ? dropClauses(s, bad) : s))
      .filter(Boolean)
      .join(' '),
  );
  const guarded = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  // Never send an empty bubble: dropping every sentence means the guard was
  // wrong about this reply, not that the client should get nothing.
  return inflect(guarded || text, input.voiceGender);
}

function splitSentences(line: string): string[] {
  return line.split(/(?<=[.!?۔؟])\s+/).filter((s) => s.trim());
}

/**
 * Cut only the offending clause: "no guarantee, but we give same-day bail
 * response" keeps "no guarantee". The joining "lekin/but" goes with it.
 */
function dropClauses(sentence: string, bad: (clause: string) => boolean): string {
  const end = sentence.match(/[.!?۔؟]$/)?.[0] ?? '';
  const body = end ? sentence.slice(0, -1) : sentence;
  const kept = body
    .split(/\s*[,،]\s*(?:(?:lekin|magar|but|however|لیکن|مگر)\s+)?|\s+(?:lekin|magar|but|however|لیکن|مگر)\s+/i)
    .filter((c) => c.trim() && !bad(c));
  if (kept.length === 0) return '';
  const joined = kept.join(', ').trim();
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)}${end || '.'}`;
}

function inventsDuration(sentence: string, known: string): boolean {
  for (const m of sentence.matchAll(DURATION)) {
    const numbers = m[1]?.match(/\d+/g) ?? [];
    if (numbers.some((n) => !new RegExp(`(^|\\D)${n}(\\D|$)`).test(known))) return true;
  }
  return false;
}

function mentionsDifferentiator(sentence: string, differentiators: string[]): boolean {
  const s = normalize(sentence);
  return differentiators.some((d) => {
    const needle = normalize(d);
    return needle.length >= 6 && s.includes(needle);
  });
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[‐-―-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** First-person verb forms only — "masla samajh aa gaya" agrees with masla and stays. */
const FEMININE: Array<[RegExp, string]> = [
  [/\bsamajh gaya\b/gi, ''],
  [/\b(sakta|raha|gaya|chahta|karta|deta|leta|rakhta) hoon\b/gi, ''],
  [/\b(dunga|karunga|bataunga|bhejunga|rakhunga|lunga|barhaunga)\b/gi, ''],
  [/سمجھ گیا/g, 'سمجھ گئی'],
  [/(سکتا|رہا|چاہتا|کرتا|دیتا|لیتا|رکھتا|بڑھاتا) ہوں/g, ''],
  [/گیا ہوں/g, 'گئی ہوں'],
  [/(دوں|کروں|بتاؤں|بھیجوں|رکھوں|لوں) گا/g, ''],
];

function inflect(text: string, voiceGender: 'male' | 'female'): string {
  if (voiceGender !== 'female') return text;
  let out = text;
  for (const [pattern, replacement] of FEMININE) {
    out = out.replace(pattern, (match: string) => replacement || feminine(match));
  }
  return out;
}

function feminine(word: string): string {
  return word
    .replace(/a( hoon)$/i, 'i$1')
    .replace(/gaya$/i, 'gayi')
    .replace(/nga$/i, 'ngi')
    .replace(/ا ہوں$/, 'ی ہوں')
    .replace(/ گا$/, ' گی');
}
