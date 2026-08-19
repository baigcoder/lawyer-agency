import { renderTemplate } from '../infrastructure/prompt.repository';
import type { Language } from '../domain/types';
import type { AiRunContext } from './ai-context.types';
import { buildAiAssumptionsBlock } from '../../firm-profile/application/ai-settings.dto';
import { buildDynamicReplyRules } from './dynamic-reply-rules';

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
    aiAssumptions: buildAiAssumptionsBlock(aiSettings),
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
  return { ...buildFirmPromptVariables(ctx), ...extra };
}

export function formatIntakeFields(fields: Record<string, unknown>): string {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return 'None collected yet.';
  return entries.map(([k, v]) => `- ${k}: ${String(v)}`).join('\n');
}

export function renderHandoffMessage(ctx: AiRunContext, language: Language): string {
  const vars = buildFirmPromptVariables(ctx);
  const minutes = ctx.aiSettings.aiHandoffSlaMinutes;
  const responseTime =
    minutes > 0
      ? language === 'UR'
        ? `دفتری اوقات میں ${minutes} منٹ کے اندر`
        : `within ${minutes} minute${minutes === 1 ? '' : 's'} during office hours`
      : language === 'UR'
        ? 'جیسے ہی وکیل دستیاب ہو'
        : 'as soon as a lawyer is available';
  const template = ctx.aiSettings.aiHandoffMessage.trim() || defaultHandoffTemplate(language);
  return renderTemplate(template, { ...vars, responseTime });
}

function defaultHandoffTemplate(language: Language): string {
  if (language === 'UR') {
    return 'یہ معاملہ وکیل کی توجہ چاہتا ہے۔ میں نے آپ کا پیغام {{displayName}} کے وکیل کو بھیج دیا ہے؛ وہ {{responseTime}} جواب دیں گے۔';
  }
  return 'This needs a lawyer’s attention. I have forwarded your message to a lawyer at {{displayName}}; they will respond {{responseTime}}.';
}

export function renderGreetingMessage(ctx: AiRunContext, language: Language): string {
  const vars = buildFirmPromptVariables(ctx);
  if (language === 'UR') {
    return renderTemplate('وعلیکم السلام! {{displayName}} میں مدد کے لیے حاضر ہوں — بتائیں آپ کو کیا چاہیے؟', vars);
  }
  return renderTemplate('Hello! How can {{displayName}} help you today?', vars);
}

export function renderFirstTurnDisclosure(
  ctx: AiRunContext,
  language: Language,
  responseText: string,
): string {
  if (!ctx.isFirstClientTurn) return responseText;
  const vars = buildFirmPromptVariables(ctx);
  const template =
    ctx.aiSettings.aiConsentMessage.trim() ||
    (language === 'UR'
      ? 'میں {{displayName}} کا اے آئی اسسٹنٹ ہوں۔'
      : "I'm the AI assistant for {{displayName}}.");
  const disclosure = renderTemplate(template, vars).trim();
  if (!disclosure || responseText.trim().startsWith(disclosure)) return responseText;
  return `${disclosure}\n\n${responseText.trim()}`;
}

export function renderOffTopicRedirect(ctx: AiRunContext, language: Language): string {
  const vars = buildFirmPromptVariables(ctx);
  if (language === 'UR') {
    return renderTemplate(
      'میں {{displayName}} کا اے آئی اسسٹنٹ ہوں۔ میں صرف اس فرم کے قانونی انٹیک، اپائنٹمنٹ، دستاویزات یا کیس کے سوالات کا جواب دے سکتا/سکتی ہوں — عام گپ شپ یا ذاتی بات نہیں۔ براہ کرم بتائیں آپ کو کس قانونی معاملے میں مدد چاہیے۔',
      vars,
    );
  }
  return renderTemplate(
    "I'm the AI assistant for {{displayName}}. I can only help with this firm's legal intake, appointments, documents, or case questions — not casual chat. How can we help with a legal matter?",
    vars,
  );
}

export function formatRetrievedContext(chunks: AiRunContext['retrievedChunks']): string {
  if (chunks.length === 0) return '';
  return chunks.map((c, i) => `[${i + 1}] ${c.title ?? 'Source'}: ${c.content}`).join('\n\n');
}
