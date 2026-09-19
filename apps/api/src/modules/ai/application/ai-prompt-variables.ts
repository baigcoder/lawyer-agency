import { renderTemplate } from '../infrastructure/prompt.repository';
import type { Language } from '../domain/types';
import type { AiRunContext } from './ai-context.types';
import { buildAiAssumptionsBlock } from '../../firm-profile/application/ai-settings.dto';
import { buildDynamicReplyRules } from './dynamic-reply-rules';
import { isRomanUrduReply, replyLanguageLabel } from './reply-script';

export function buildFirmPromptVariables(ctx: AiRunContext): Record<string, string> {
  const { firm, aiSettings, ownerProfile } = ctx;
  const fee =
    firm.consultationFeePkr > 0 ? `PKR ${firm.consultationFeePkr.toLocaleString('en-PK')}` : 'Contact the firm';
  const ownerVars = formatOwnerProfileVariables(ownerProfile);
  const firmEnrichment = formatFirmEnrichment(firm);
  const base = {
    displayName: firm.displayName,
    firmName: firm.firmName,
    city: firm.city || 'Pakistan',
    officeAddress: firm.officeAddress,
    website: firm.website,
    practiceAreas: firm.practiceAreas.join(', ') || 'Not specified',
    officeHours: firm.officeHours,
    consultationFee: fee,
    clientLanguages: firm.clientLanguages.join(', '),
    teamSize: String(firm.teamSize),
    firmAbout: firm.firmAbout || 'Not provided',
    foundingYear: firm.foundingYear ? String(firm.foundingYear) : 'Not provided',
    differentiators: (firm.differentiators ?? []).length
      ? (firm.differentiators ?? []).join('; ')
      : 'Not provided',
    firmEnrichment,
    aiTone: aiSettings.aiTone,
    aiCustomInstructions: aiSettings.aiCustomInstructions.trim() || 'None',
    aiAssumptions: buildAiAssumptionsBlock(aiSettings, {
      replyWillBeSpoken: ctx.replyWillBeSpoken,
    }),
    conversationHistory: ctx.conversationHistory || 'No prior messages in this thread.',
    lastAiReply: ctx.lastAiReply.trim() || 'None yet.',
    intakeFields: formatIntakeFields(ctx.intakeFields),
    retrievedContext: ctx.retrievedContext || 'No matching knowledge-base or document excerpts.',
    isFirstClientTurn: ctx.isFirstClientTurn ? 'yes' : 'no',
    ...ownerVars,
  };
  const greetingHint = aiSettings.aiGreetingIntro.trim()
    ? renderTemplate(aiSettings.aiGreetingIntro, base)
    : '';
  return {
    ...base,
    dynamicReplyRules: buildDynamicReplyRules({
      isFirstClientTurn: ctx.isFirstClientTurn,
      aiGreetingHint: greetingHint,
    }),
  };
}

function formatOwnerProfileVariables(owner: AiRunContext['ownerProfile']): Record<string, string> {
  if (!owner) {
    return {
      ownerName: 'Not provided',
      ownerBio: 'Not provided',
      ownerBioUr: 'Not provided',
      ownerExperience: 'Not provided',
      ownerBarCouncil: 'Not provided',
      ownerAchievements: 'Not provided',
      ownerEducation: 'Not provided',
      ownerLanguages: 'Not provided',
      ownerPracticeAreas: 'Not provided',
      featuredCases: 'None',
      ownerProfileBlock: 'Owner profile not yet configured.',
    };
  }

  const experience =
    owner.yearsExperience != null ? `${owner.yearsExperience} years` : 'Not specified';
  const featuredCases =
    owner.featuredCases.length > 0
      ? owner.featuredCases.map((c) => `- ${c.publicTitle}: ${c.publicOutcome}`).join('\n')
      : 'None';

  const ownerProfileBlock = [
    `Lead lawyer: ${owner.ownerName}`,
    owner.bio ? `Bio (EN): ${owner.bio}` : '',
    owner.bioUr ? `Bio (UR): ${owner.bioUr}` : '',
    `Experience: ${experience}`,
    owner.barCouncil ? `Bar council: ${owner.barCouncil}` : '',
    owner.education.length ? `Education: ${owner.education.join('; ')}` : '',
    owner.achievements.length ? `Achievements: ${owner.achievements.join('; ')}` : '',
    owner.languages.length ? `Languages: ${owner.languages.join(', ')}` : '',
    owner.practiceAreas.length ? `Practice areas: ${owner.practiceAreas.join(', ')}` : '',
    featuredCases !== 'None' ? `Featured cases (anonymized):\n${featuredCases}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    ownerName: owner.ownerName,
    ownerBio: owner.bio || owner.bioUr || 'Not provided',
    ownerBioUr: owner.bioUr || owner.bio || 'Not provided',
    ownerExperience: experience,
    ownerBarCouncil: owner.barCouncil || 'Not provided',
    ownerAchievements: owner.achievements.length ? owner.achievements.join('; ') : 'None listed',
    ownerEducation: owner.education.length ? owner.education.join('; ') : 'None listed',
    ownerLanguages: owner.languages.length ? owner.languages.join(', ') : 'Same as firm default',
    ownerPracticeAreas: owner.practiceAreas.length ? owner.practiceAreas.join(', ') : 'Not specified',
    featuredCases,
    ownerProfileBlock,
  };
}

function formatFirmEnrichment(firm: AiRunContext['firm']): string {
  const differentiators = firm.differentiators ?? [];
  const parts = [
    firm.firmAbout ? `About: ${firm.firmAbout}` : '',
    firm.foundingYear ? `Established: ${firm.foundingYear}` : '',
    differentiators.length ? `Differentiators: ${differentiators.join('; ')}` : '',
    `Team size: ${firm.teamSize ?? 1}`,
  ].filter(Boolean);
  return parts.length ? parts.join('\n') : 'No extended firm description configured.';
}

export function mergePromptVariables(
  ctx: AiRunContext,
  extra: Record<string, string>,
): Record<string, string> {
  const merged = { ...buildFirmPromptVariables(ctx), ...extra };
  // Every agent passes the raw Language code here, and every template reads it
  // as "Reply in {{language}}". Rendering it once, centrally, covers all four
  // agents and any tenant-customised prompt from the database.
  if (extra.language) {
    merged.language = replyLanguageLabel(extra.language, extra.clientText ?? '', ctx.replyWillBeSpoken);
  }
  return merged;
}

export function formatIntakeFields(fields: Record<string, unknown>): string {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return 'None collected yet.';
  return entries.map(([k, v]) => `- ${k}: ${String(v)}`).join('\n');
}

/**
 * The fixed replies below used to be Urdu script for every UR client, so a
 * client who wrote Roman Urdu — and had been getting Roman Urdu from the agent —
 * suddenly got a line in a script they had not used. The urgent handoff was one
 * of them, the message where being understood matters most.
 */
function isRomanUrdu(ctx: AiRunContext, language: Language): boolean {
  return language === 'UR' && Boolean(ctx.replyInRomanUrdu);
}

export function renderHandoffMessage(ctx: AiRunContext, language: Language): string {
  const vars = buildFirmPromptVariables(ctx);
  const roman = isRomanUrdu(ctx, language);
  const owner = spokenOwnerName(vars) ?? (language === 'UR' ? (roman ? 'malik' : 'مالک') : 'my owner');
  const minutes = ctx.aiSettings.aiHandoffSlaMinutes;
  const responseTime =
    minutes > 0
      ? language === 'UR'
        ? roman
          ? `office hours mein ${minutes} minute ke andar`
          : `دفتری اوقات میں ${minutes} منٹ کے اندر`
        : `within ${minutes} minute${minutes === 1 ? '' : 's'} during office hours`
      : '';
  const template = ctx.aiSettings.aiHandoffMessage.trim() || defaultHandoffTemplate(language, minutes > 0, roman);
  return renderTemplate(template, { ...vars, ownerName: owner, responseTime }).trim();
}

function defaultHandoffTemplate(language: Language, hasSla: boolean, roman: boolean): string {
  if (language === 'UR' && roman) {
    return hasSla
      ? 'Theek hai, yeh fori maamla hai. Main ne yeh {{ownerName}} ko bhej diya hai, woh {{responseTime}} aap ko jawab denge. Phone paas rakhein.'
      : 'Theek hai, yeh fori maamla hai. Main ne yeh {{ownerName}} ko bhej diya hai, woh aap ko jawab denge. Phone paas rakhein.';
  }
  if (language === 'UR') {
    return hasSla
      ? 'ٹھیک ہے، یہ فوری معاملہ ہے۔ میں نے یہ {{ownerName}} کو بھیج دیا ہے، وہ {{responseTime}} آپ کو جواب دیں گے۔ فون پاس رکھیں۔'
      : 'ٹھیک ہے، یہ فوری معاملہ ہے۔ میں نے یہ {{ownerName}} کو بھیج دیا ہے، وہ آپ کو جواب دیں گے۔ فون پاس رکھیں۔';
  }
  return hasSla
    ? "Got it, this is urgent. I've sent this to {{ownerName}}. They'll reply to you {{responseTime}}. Please keep your phone with you."
    : "Got it, this is urgent. I've sent this to {{ownerName}}. They'll reply to you. Please keep your phone with you.";
}

export function renderGreetingMessage(ctx: AiRunContext, language: Language): string {
  const vars = buildFirmPromptVariables(ctx);
  if (isRomanUrdu(ctx, language)) {
    return renderTemplate('Wa alaikum assalam, bataiye aap ko kya chahiye?', vars);
  }
  if (language === 'UR') {
    return renderTemplate('وعلیکم السلام، بتائیں آپ کو کیا چاہیے؟', vars);
  }
  return renderTemplate('Hello, how can I help you today?', vars);
}

export function renderFirstTurnDisclosure(
  ctx: AiRunContext,
  language: Language,
  responseText: string,
  channel: 'text' | 'voice' = 'text',
): string {
  if (!ctx.isFirstClientTurn) return responseText;
  const vars = buildFirmPromptVariables(ctx);
  const custom = ctx.aiSettings.aiConsentMessage.trim();
  const template =
    custom ||
    (channel === 'voice'
      ? defaultSpokenDisclosure(language, vars, ctx.aiSettings.aiVoiceGender)
      : defaultDisclosure(language, vars, {
          // Match the script the agent just replied in, so the client does not
          // receive Urdu script and Roman Urdu in the same message.
          romanUrdu: isRomanUrduReply(language, responseText),
          voiceGender: ctx.aiSettings.aiVoiceGender,
          voiceEnabled: ctx.aiSettings.aiVoiceEnabled,
        }));
  const disclosure = renderTemplate(template, vars).trim();
  const body = stripLeadingAiSelfIntros(responseText, disclosure);
  if (!disclosure) return body;
  if (!body) return disclosure;
  if (alreadyHasDisclosure(body, disclosure)) return body;
  return channel === 'voice' ? `${disclosure} ${body}` : `${disclosure}\n\n${body}`;
}

export function spokenOwnerName(vars: Record<string, string>): string | null {
  const owner = vars.ownerName?.trim() ?? '';
  if (!owner || /^not provided$/i.test(owner)) return null;
  return owner;
}

export function defaultSpokenDisclosure(
  language: Language,
  vars: Record<string, string>,
  voiceGender: 'male' | 'female' = 'female',
): string {
  const owner = spokenOwnerName(vars);
  const firm = vars.displayName?.trim() || 'the firm';
  if (language === 'UR') {
    // Always Urdu script: this line is read aloud, and an Urdu voice
    // mispronounces Latin letters. No Roman Urdu variant on the spoken path.
    // "کی اسسٹنٹ" for a female voice: the possessive agrees with the speaker.
    // A female voice saying "کا اسسٹنٹ ہوں" is heard as a man's line.
    const of = urduOf(voiceGender);
    return owner
      ? `میں ${owner} ${of} اسسٹنٹ ہوں، وکیل خود نہیں۔`
      : `میں ${firm} ${of} اسسٹنٹ ہوں، وکیل نہیں۔`;
  }
  return owner
    ? `I'm ${owner}'s assistant, not ${owner} the lawyer.`
    : `I'm the assistant for ${firm}, not a lawyer.`;
}

/** Urdu "of" agreeing with the speaker: a female assistant is "X کی اسسٹنٹ". */
export function urduOf(voiceGender: 'male' | 'female'): 'کا' | 'کی' {
  return voiceGender === 'male' ? 'کا' : 'کی';
}

export interface DisclosureOptions {
  /** True when the client writes Urdu in Latin letters — mirror that. */
  romanUrdu?: boolean;
  /** Female is the default configured voice, and Urdu verbs agree with it. */
  voiceGender?: 'male' | 'female';
  /** Only promise to answer voice notes when the firm actually speaks back. */
  voiceEnabled?: boolean;
}

export function defaultDisclosure(
  language: Language,
  vars: Record<string, string>,
  options: DisclosureOptions = {},
): string {
  const owner = spokenOwnerName(vars);
  const firm = vars.displayName?.trim() || 'the firm';
  const subject = owner ?? firm;

  if (language === 'UR' && options.romanUrdu) {
    // A Roman Urdu client got this line in Urdu script while the agent replied
    // in Roman Urdu — two scripts in one message.
    // Roman Urdu inflects for the speaker's gender just as Urdu script does.
    const willAnswer = options.voiceGender === 'male' ? 'dunga' : 'dungi';
    const of = options.voiceGender === 'male' ? 'ka' : 'ki';
    const handles = options.voiceEnabled
      ? `Aap ke messages aur voice notes ka jawab main ${willAnswer}.`
      : `Aap ke messages ka jawab main ${willAnswer}.`;
    return owner
      ? `Main ${owner} ${of} assistant hoon, khud wakeel nahi. ${handles} Bataiye aap ko kya chahiye?`
      : `Main ${firm} ${of} assistant hoon, wakeel nahi. ${handles} Bataiye aap ko kya chahiye?`;
  }

  if (language === 'UR') {
    // Urdu verbs agree with the speaker, and the configured voice is female by
    // default — "دوں گا" from a female assistant reads as a different person.
    const willAnswer = options.voiceGender === 'male' ? 'دوں گا' : 'دوں گی';
    const of = urduOf(options.voiceGender ?? 'female');
    const handles = options.voiceEnabled
      ? `آپ کے میسج اور وائس نوٹ کا جواب میں ${willAnswer}۔`
      : `آپ کے میسج کا جواب میں ${willAnswer}۔`;
    return owner
      ? `میں ${owner} ${of} اسسٹنٹ ہوں، وکیل خود نہیں۔ ${handles} بتائیں آپ کو کیا چاہیے؟`
      : `میں ${firm} ${of} اسسٹنٹ ہوں، وکیل نہیں۔ ${handles} بتائیں آپ کو کیا چاہیے؟`;
  }

  const handles = options.voiceEnabled
    ? "I'll answer your messages and voice notes."
    : "I'll answer your messages.";
  return owner
    ? `I'm ${subject}'s assistant, not ${owner} the lawyer. ${handles} Tell me how I can help.`
    : `I'm the assistant for ${subject}, not a lawyer. ${handles} Tell me how I can help.`;
}

export function renderOffTopicRedirect(ctx: AiRunContext, language: Language): string {
  const vars = buildFirmPromptVariables(ctx);
  // The verb agrees with the speaker. This was always "سکتا" (masculine),
  // while the default voice — and the rest of the thread — is female.
  const male = ctx.aiSettings.aiVoiceGender === 'male';
  if (isRomanUrdu(ctx, language)) {
    return renderTemplate(
      `Main sirf is firm ke qanooni intake, appointment, documents ya case ke sawalon ka jawab de ${male ? 'sakta' : 'sakti'} hoon, aam gup shup ya zaati baat nahi. Bataiye aap ko kis qanooni maamle mein madad chahiye.`,
      vars,
    );
  }
  if (language === 'UR') {
    return renderTemplate(
      `میں صرف اس فرم کے قانونی انٹیک، اپائنٹمنٹ، دستاویزات یا کیس کے سوالات کا جواب دے ${male ? 'سکتا' : 'سکتی'} ہوں، عام گپ شپ یا ذاتی بات نہیں۔ براہ کرم بتائیں آپ کو کس قانونی معاملے میں مدد چاہیے۔`,
      vars,
    );
  }
  return renderTemplate(
    "I can only help with this firm's legal intake, appointments, documents, or case questions, not casual chat. How can we help with a legal matter?",
    vars,
  );
}

/**
 * Sent when the agent's model call fails outright — retries exhausted on rate
 * limits, or the provider is down.
 *
 * It used to ask "what legal matter can we help with?", usually of a client who
 * had just described it, and only in Urdu script for any UR client. Asking for
 * a little more keeps the thread moving whatever they said; the next turn is
 * likely to reach the model. "کر سکوں" / "kar sakoon" is the same for a male or
 * female speaker.
 */
export function renderAgentFailureReply(
  ctx: AiRunContext,
  language: Language,
  channel: 'text' | 'voice',
): string {
  if (isRomanUrdu(ctx, language)) {
    return 'Aap ka message mil gaya. Thora sa aur bata dein, taake main sahi madad kar sakoon.';
  }
  if (language === 'UR') {
    return channel === 'voice'
      ? 'میں نے آپ کی بات سن لی۔ تھوڑا سا اور بتا دیں تاکہ میں صحیح مدد کر سکوں۔'
      : 'آپ کا پیغام مل گیا۔ تھوڑا سا اور بتا دیں تاکہ میں صحیح مدد کر سکوں۔';
  }
  return channel === 'voice'
    ? 'I heard your voice note. Could you tell me a bit more, so I can help properly?'
    : 'Got your message. Could you tell me a bit more, so I can help properly?';
}

const EN_ASSISTANT_PREFIX =
  /^(?:(?:hi|hy|hello|hey|assalamu?alaikum)[,!.]?\s+)?(?:i(?:['’]?m|\s+am)|this\s+is)\s+(?:the\s+)?(?:an?\s+)?(?:ai\s+)?(?:[^.\n]{0,80}?'s\s+)?assistant(?:\s+for\s+[^\n.!?]{0,80})?(?:\s*[,—–-]\s*not[^\n.!?]{0,90})?[.!?۔]?\s*/i;
const EN_ASSISTANT_FOLLOWUP =
  /^(?:i(?:['’]?ll| will) answer your messages(?: and voice notes)?[.!]?\s*)/i;
const EN_HELP_FOLLOWUP =
  /^(?:i(?:['’]?m|\s+am) here to help[.!—–,]*\s*|tell me how i can help(?: you)?[.!]\s*)/i;
const UR_ASSISTANT_PREFIX =
  /^میں[^\n۔.]{0,80}(?:اے\s*آئی\s*)?اسسٹنٹ\s*ہوں(?:[،,]?\s*وکیل[^\n۔.]{0,60})?[۔.]?\s*/;
const UR_ASSISTANT_FOLLOWUP =
  /^(?:آپ کے میسج اور وائس نوٹ کا جواب میں دوں گ[ای][۔.]?\s*)?(?:بتائیں آپ کو کیا چاہیے[؟?]?\s*)?/u;

/** Drop a leading "I am the AI assistant…" so first-turn disclosure is prepended once. */
export function stripLeadingAiSelfIntros(text: string, disclosure = ''): string {
  let remaining = text.trim();
  for (let i = 0; i < 4; i++) {
    if (!remaining) break;
    const stripped = remaining
      .replace(EN_ASSISTANT_PREFIX, '')
      .replace(EN_ASSISTANT_FOLLOWUP, '')
      .replace(EN_HELP_FOLLOWUP, '')
      .replace(UR_ASSISTANT_PREFIX, '')
      .replace(UR_ASSISTANT_FOLLOWUP, '')
      .trim();
    if (stripped !== remaining) {
      remaining = stripped.replace(/^[-—–]+\s*/, '');
      continue;
    }
    const { first, rest } = splitLeadBubble(remaining);
    if (disclosure && rest.trim() && alreadyHasDisclosure(first, disclosure)) {
      remaining = rest.trim();
      continue;
    }
    break;
  }
  return remaining;
}

function alreadyHasDisclosure(text: string, disclosure: string): boolean {
  const needle = normalizeDisclosure(disclosure);
  if (!needle) return false;
  return normalizeDisclosure(text).startsWith(needle);
}

function splitLeadBubble(text: string): { first: string; rest: string } {
  const para = text.indexOf('\n\n');
  if (para > 0 && para <= 280) {
    return { first: text.slice(0, para).trim(), rest: text.slice(para + 2) };
  }
  const match = text.match(/^([\s\S]{1,280}?[.!?۔])(?:\s+|$)/);
  if (match?.[1]) {
    return { first: match[1].trim(), rest: text.slice(match[0].length) };
  }
  return { first: text, rest: '' };
}

function normalizeDisclosure(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/\bi am\b/g, 'im')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatRetrievedContext(chunks: AiRunContext['retrievedChunks']): string {
  if (chunks.length === 0) return '';
  return chunks.map((c, i) => `[${i + 1}] ${c.title ?? 'Source'}: ${c.content}`).join('\n\n');
}
