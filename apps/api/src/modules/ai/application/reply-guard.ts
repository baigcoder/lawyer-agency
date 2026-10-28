/**
 * Last check on a model reply before it reaches the client. The prompts say
 * all of this already; measured on the live models they still slip:
 *
 * - a made-up duration ("khula 3-6 mahine lagta hai") — a timeline the firm
 *   never gave, read by the client as a promise;
 * - the firm's sales line in a bail answer ("same-day bail response") — heard
 *   as "you will get bail today";
 * - a masculine verb from the female assistant ("samajh gaya", "سمجھ گیا");
 * - a rupee amount nobody gave ("case fee PKR 50,000 hogi") — quoted back to
 *   the firm by the client as a promised price.
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

/** A money amount: "PKR 5,000", "Rs. 5000", "5000 rupay", "5 hazar", "50k", "۵۰۰۰ روپے". */
const MONEY =
  /(?:(?:\bpkr|\brs\.?|\brup(?:ees?|ay|ey|ya)|روپے)\s*([\d٠-٩۰-۹][\d٠-٩۰-۹,]*(?:\.\d+)?)\s*(k|hazaa?r|thousand|ہزار|lakh|لاکھ)?)|(?:([\d٠-٩۰-۹][\d٠-٩۰-۹,]*(?:\.\d+)?)\s*(k|hazaa?r|thousand|ہزار|lakh|لاکھ)?\s*(?:pkr\b|rs\b|rup(?:ees?|ay|ey|ya|e)\b|روپے))/gi;

const OUTCOME_QUESTION = /bail|zamanat|guarantee|gaurantee|ضمانت|گارنٹی|kitne din|kab tak|how long|outcome|result|faisla|فیصلہ/i;

export function guardReply(text: string, input: ReplyGuardInput): string {
  const known = `${input.clientText}\n${input.sources}`;
  const outcomeQuestion = OUTCOME_QUESTION.test(input.clientText);
  const knownAmounts = amountsIn(known);
  const bad = (clause: string) =>
    inventsDuration(clause, known) ||
    inventsAmount(clause, knownAmounts) ||
    (outcomeQuestion && mentionsDifferentiator(clause, input.differentiators));
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
    // A comma between digits is a thousands separator ("Rs 50,000"), not a clause break.
    .split(/\s*(?<!\d)[,،](?!\d)\s*(?:(?:lekin|magar|but|however|لیکن|مگر)\s+)?|\s+(?:lekin|magar|but|however|لیکن|مگر)\s+/i)
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

function inventsAmount(sentence: string, known: Set<number>): boolean {
  for (const amount of amountsIn(sentence)) {
    if (!known.has(amount)) return true;
  }
  return false;
}

/** Every money amount in `text`, as plain rupees (commas, Urdu digits, "hazar"/"k"/"lakh" resolved). */
export function amountsIn(text: string): Set<number> {
  const out = new Set<number>();
  for (const m of text.matchAll(MONEY)) {
    const digits = m[1] ?? m[3];
    const unit = (m[2] ?? m[4] ?? '').toLowerCase();
    if (!digits) continue;
    const value = Number(toAsciiDigits(digits).replace(/,/g, ''));
    if (!Number.isFinite(value)) continue;
    const multiplier = /lakh|لاکھ/.test(unit) ? 100_000 : unit ? 1_000 : 1;
    out.add(Math.round(value * multiplier));
  }
  return out;
}

function toAsciiDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
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
