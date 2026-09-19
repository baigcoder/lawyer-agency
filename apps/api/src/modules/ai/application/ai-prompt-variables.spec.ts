import { describe, expect, it } from 'vitest';
import {
  buildFirmPromptVariables,
  renderAgentFailureReply,
  renderFirstTurnDisclosure,
  renderGreetingMessage,
  renderHandoffMessage,
  renderOffTopicRedirect,
} from './ai-prompt-variables';
import type { AiRunContext } from './ai-context.types';
import { defaultAiSettings } from '../../firm-profile/application/ai-settings.dto';

function sampleContext(overrides: Partial<AiRunContext> = {}): AiRunContext {
  return {
    firm: {
      firmName: 'ABC Law',
      displayName: 'ABC Law Associates',
      city: 'Lahore',
      officeAddress: '1 Mall Road',
      website: 'https://abclaw.pk',
      practiceAreas: ['Family Law'],
      clientLanguages: ['EN', 'UR'],
      officeHours: '9-5',
      consultationFeePkr: 5000,
      teamSize: 5,
      firmAbout: 'Full-service Lahore firm',
      foundingYear: 2010,
      differentiators: ['Urdu-first intake'],
    },
    ownerProfile: null,
    aiSettings: defaultAiSettings(),
    isFirstClientTurn: false,
    conversationHistory: 'Client: Hi',
    lastAiReply: '',
    intakeFields: { practiceArea: 'Family Law' },
    clientId: 'client-1',
    caseId: undefined,
    retrievedChunks: [],
    retrievedContext: '',
    replyWillBeSpoken: false,
    ...overrides,
  };
}

describe('ai-prompt-variables', () => {
  it('includes firm display name in prompt variables', () => {
    const vars = buildFirmPromptVariables(sampleContext());
    expect(vars.displayName).toBe('ABC Law Associates');
    expect(vars.practiceAreas).toContain('Family Law');
    expect(vars.aiAssumptions).toMatch(/Never give legal advice/);
    expect(vars.intakeFields).toContain('Family Law');
  });

  it('renders custom handoff message with display name', () => {
    const ctx = sampleContext({
      aiSettings: {
        ...defaultAiSettings(),
        aiHandoffMessage: 'A lawyer at {{displayName}} will call you soon.',
      },
    });
    expect(renderHandoffMessage(ctx, 'EN')).toBe('A lawyer at ABC Law Associates will call you soon.');
  });

  it('only promises the configured lawyer response time', () => {
    const configured = sampleContext({
      aiSettings: { ...defaultAiSettings(), aiHandoffSlaMinutes: 5 },
    });
    expect(renderHandoffMessage(configured, 'EN')).toContain('within 5 minutes during office hours');

    const unconfigured = renderHandoffMessage(sampleContext(), 'EN');
    expect(unconfigured).not.toMatch(/\b\d+\s+minute/);
    expect(unconfigured).toContain("I've sent this to my owner");
    expect(unconfigured).toContain("They'll reply to you");

    const withOwner = sampleContext({
      ownerProfile: {
        ownerName: 'Talha',
        bio: '',
        bioUr: '',
        yearsExperience: null,
        barCouncil: '',
        barEnrollmentNumber: '',
        education: [],
        achievements: [],
        languages: [],
        practiceAreas: [],
        featuredCases: [],
      },
    });
    expect(renderHandoffMessage(withOwner, 'EN')).toContain("I've sent this to Talha");
  });

  it('adds a concise configurable AI disclosure only on the first turn', () => {
    const firstTurn = sampleContext({ isFirstClientTurn: true });
    expect(renderFirstTurnDisclosure(firstTurn, 'EN', 'How can I help?')).toBe(
      "I'm the assistant for ABC Law Associates, not a lawyer. I'll answer your messages. Tell me how I can help.\n\nHow can I help?",
    );

    const withOwner = sampleContext({
      isFirstClientTurn: true,
      ownerProfile: {
        ownerName: 'Talha',
        bio: '',
        bioUr: '',
        yearsExperience: null,
        barCouncil: '',
        barEnrollmentNumber: '',
        education: [],
        achievements: [],
        languages: [],
        practiceAreas: [],
        featuredCases: [],
      },
    });
    expect(renderFirstTurnDisclosure(withOwner, 'EN', 'What happened?')).toContain(
      "I'm Talha's assistant, not Talha the lawyer.",
    );

    const custom = sampleContext({
      isFirstClientTurn: true,
      aiSettings: {
        ...defaultAiSettings(),
        aiConsentMessage: 'Automated intake for {{displayName}}.',
      },
    });
    expect(renderFirstTurnDisclosure(custom, 'EN', 'Please share the issue.')).toContain(
      'Automated intake for ABC Law Associates.',
    );
    expect(renderFirstTurnDisclosure(sampleContext(), 'EN', 'Welcome back.')).toBe(
      'Welcome back.',
    );

    const spoken = renderFirstTurnDisclosure(withOwner, 'EN', 'I heard your question about the house.', 'voice');
    expect(spoken.startsWith("I'm Talha's assistant, not Talha the lawyer.")).toBe(true);
    expect(spoken).toContain('I heard your question about the house.');
    expect(spoken).not.toContain('\n\n');
  });

  it('does not repeat an AI-assistant intro the model already wrote', () => {
    const firstTurn = sampleContext({ isFirstClientTurn: true });
    const disclosure =
      "I'm the assistant for ABC Law Associates, not a lawyer. I'll answer your messages. Tell me how I can help.";
    expect(
      renderFirstTurnDisclosure(firstTurn, 'EN', "I'm the AI assistant for ABC Law Associates. How can I help?"),
    ).toBe(`${disclosure}\n\nHow can I help?`);
    expect(renderFirstTurnDisclosure(firstTurn, 'EN', 'I am an assistant. Hello — how can I help?')).toBe(
      `${disclosure}\n\nHello — how can I help?`,
    );
    expect(
      renderFirstTurnDisclosure(
        firstTurn,
        'EN',
        "I'm Talha's assistant, not Talha the lawyer. I'll answer your messages and voice notes. What happened?",
      ),
    ).toBe(`${disclosure}\n\nWhat happened?`);
  });

  it('includes owner profile variables when configured', () => {
    const vars = buildFirmPromptVariables(
      sampleContext({
        ownerProfile: {
          ownerName: 'Adv. Ali',
          bio: 'Experienced litigator',
          bioUr: '',
          yearsExperience: 12,
          barCouncil: 'Punjab Bar Council',
          barEnrollmentNumber: '',
          education: ['LLB'],
          achievements: ['Best lawyer 2020'],
          languages: ['Urdu'],
          practiceAreas: ['Criminal'],
          featuredCases: [{ publicTitle: 'Bail granted', publicOutcome: 'Client released' }],
        },
      }),
    );
    expect(vars.ownerName).toBe('Adv. Ali');
    expect(vars.featuredCases).toContain('Bail granted');
    expect(vars.ownerProfileBlock).toContain('Adv. Ali');
  });
});

const URDU_SCRIPT = /[؀-ۿ]/;

describe('fixed replies follow the client script', () => {
  // These were Urdu script for every UR client, so a Roman Urdu client who had
  // been getting Roman Urdu from the agent got one line they may not read.
  const roman = sampleContext({ replyInRomanUrdu: true });
  const script = sampleContext({ replyInRomanUrdu: false });

  it('sends the urgent handoff in Roman Urdu to a Roman Urdu client', () => {
    const withSla = sampleContext({
      replyInRomanUrdu: true,
      aiSettings: { ...defaultAiSettings(), aiHandoffSlaMinutes: 15 },
    });
    const line = renderHandoffMessage(withSla, 'UR');
    expect(line).not.toMatch(URDU_SCRIPT);
    expect(line).toContain('fori maamla');
    expect(line).toContain('15 minute ke andar');
  });

  it('keeps the handoff in Urdu script for an Urdu-script client', () => {
    expect(renderHandoffMessage(script, 'UR')).toMatch(URDU_SCRIPT);
  });

  it('never applies Roman Urdu to an English reply', () => {
    expect(renderHandoffMessage(roman, 'EN')).toContain('urgent');
  });

  it('respects a firm-written handoff message as it is', () => {
    const custom = sampleContext({
      replyInRomanUrdu: true,
      aiSettings: { ...defaultAiSettings(), aiHandoffMessage: 'Wakeel sahab jald rabta karenge.' },
    });
    expect(renderHandoffMessage(custom, 'UR')).toBe('Wakeel sahab jald rabta karenge.');
  });

  it('redirects off-topic chat in Roman Urdu too', () => {
    expect(renderOffTopicRedirect(roman, 'UR')).not.toMatch(URDU_SCRIPT);
    expect(renderOffTopicRedirect(script, 'UR')).toMatch(URDU_SCRIPT);
  });

  it('agrees the off-topic verb with the configured voice', () => {
    // It was always masculine "سکتا" while the default voice is female.
    expect(renderOffTopicRedirect(script, 'UR')).toContain('سکتی');
    const male = sampleContext({ aiSettings: { ...defaultAiSettings(), aiVoiceGender: 'male' } });
    expect(renderOffTopicRedirect(male, 'UR')).toContain('سکتا');
    expect(renderOffTopicRedirect(roman, 'UR')).toContain('sakti hoon');
  });

  it('greets in Roman Urdu too', () => {
    expect(renderGreetingMessage(roman, 'UR')).not.toMatch(URDU_SCRIPT);
  });
});

describe('renderAgentFailureReply', () => {
  it('answers a Roman Urdu client in Roman Urdu', () => {
    const line = renderAgentFailureReply(sampleContext({ replyInRomanUrdu: true }), 'UR', 'text');
    expect(line).not.toMatch(URDU_SCRIPT);
  });

  it('answers an Urdu-script client in Urdu script', () => {
    expect(renderAgentFailureReply(sampleContext(), 'UR', 'text')).toMatch(URDU_SCRIPT);
  });

  it('does not say it heard a text message', () => {
    expect(renderAgentFailureReply(sampleContext(), 'EN', 'text')).not.toContain('heard');
    expect(renderAgentFailureReply(sampleContext(), 'EN', 'voice')).toContain('voice note');
    expect(renderAgentFailureReply(sampleContext(), 'UR', 'text')).not.toContain('سن لی');
  });

  it('does not ask which legal matter — the client has usually just said', () => {
    for (const line of [
      renderAgentFailureReply(sampleContext(), 'EN', 'text'),
      renderAgentFailureReply(sampleContext({ replyInRomanUrdu: true }), 'UR', 'text'),
      renderAgentFailureReply(sampleContext(), 'UR', 'voice'),
    ]) {
      expect(line).not.toMatch(/legal matter|qanooni maamle|قانونی معاملے/);
    }
  });
});
