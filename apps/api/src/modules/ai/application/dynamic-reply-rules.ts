/**
 * Shared LLM instructions so agents reply to the client's actual message —
 * not a static firm brochure or assumed practice area.
 */
export function buildDynamicReplyRules(params: {
  isFirstClientTurn: boolean;
  aiGreetingHint: string;
}): string {
  const hint = params.aiGreetingHint.trim();
  const hintLine = hint
    ? `Owner identity hint (adapt naturally — NEVER copy verbatim): ${hint}`
    : 'No custom intro hint — use {{displayName}} and firm profile from context only.';

  return [
    'DYNAMIC REPLY RULES (mandatory):',
    '- Respond to what the client JUST said — do not ignore or override their message.',
    '- Use the firm name "{{displayName}}" from settings (the name the owner configured).',
    '- Do NOT assume a practice area (e.g. family law) unless the client mentioned it.',
    '- Do NOT paste a pre-written introduction or list every service unprompted.',
    '- Write like a real WhatsApp chat: short bubbles, plain language, no brochure, no numbered essay unless they asked for a list.',
    '- Acknowledge what they just said in the first sentence before asking anything.',
    '- Ask at most ONE question. Never repeat a question already answered in Prior conversation or Known intake fields.',
    '- If they wrote Roman Urdu (kya, mujhe, madad), reply in Roman Urdu — not English and not Nastaliq unless they used it.',
    '- Match length to their message: hi/hy/salam → 1–2 short sentences; detailed question → thorough but concise.',
    params.isFirstClientTurn
      ? '- First reply in this thread: a separate AI disclosure is added automatically; do not introduce yourself again. Address their message.'
      : '- Continuing thread: skip re-introduction; do not repeat questions already answered.',
    hintLine,
  ].join('\n');
}

export function isShortGreeting(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  const lower = trimmed.toLowerCase();
  const legalHints = [
    'help',
    'need',
    'case',
    'law',
    'legal',
    'divorce',
    'court',
    'matter',
    'appointment',
    'madad',
    'chahiye',
    'masla',
    'problem',
  ];
  if (legalHints.some((hint) => lower.includes(hint))) return false;
  if (trimmed.length > 35) return false;
  const patterns = [
    /^hi+!*$/,
    /^hy+!*$/,
    /^hii+!*$/,
    /^hello+!*$/,
    /^hey+!*$/,
    /^salam+!*$/,
    /^salaam!*$/,
    /^assalamu?\s*alaikum!*$/,
    /^assalamualaikum!*$/,
    /^asalam!*$/,
    /^aoa!*$/,
    /^good\s+(morning|evening|afternoon)!*$/,
    /^thanks?!*$/,
    /^thank\s+you!*$/,
    /^shukriya!*$/,
    /^السلام\s*علیکم$/,
    /^سلام$/,
  ];
  return patterns.some((p) => p.test(lower));
}
