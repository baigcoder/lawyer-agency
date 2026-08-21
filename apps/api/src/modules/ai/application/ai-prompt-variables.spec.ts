import { describe, expect, it } from 'vitest';
import {
  buildFirmPromptVariables,
  renderFirstTurnDisclosure,
  renderHandoffMessage,
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
      "I'm the assistant for ABC Law Associates, not a lawyer. I'll answer your messages and voice notes. Tell me how I can help.\n\nHow can I help?",
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
      "I'm the assistant for ABC Law Associates, not a lawyer. I'll answer your messages and voice notes. Tell me how I can help.";
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
