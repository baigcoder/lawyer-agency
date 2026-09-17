import { describe, expect, it } from 'vitest';
import {
  clipToSentence,
  heuristicTurn,
  newCallLanguageState,
  receptionistGreeting,
  recentCallTurns,
  VoiceReceptionistService,
  type ReceptionistSession,
} from './voice-receptionist.service';
import { parseAiSettings, type AiSettings } from '../../firm-profile/application/ai-settings.dto';

function session(overrides: Partial<ReceptionistSession> = {}): ReceptionistSession {
  const settings: AiSettings = parseAiSettings({});
  return {
    tenantId: 't',
    voiceCallId: 'v',
    conversationId: 'c',
    clientId: 'cl',
    fromWaPhone: '923001234567',
    firmName: 'Talha Law',
    settings,
    tenantAllowlist: [],
    offeredSlots: null,
    transcript: [],
    disposition: 'ABANDONED',
    ...newCallLanguageState(settings),
    ...overrides,
  };
}

/** `lockLanguage` needs no collaborators, so an empty instance is enough. */
const receptionist = Object.create(VoiceReceptionistService.prototype) as VoiceReceptionistService;

describe('receptionistGreeting', () => {
  it('speaks as the firm assistant, not the lawyer', () => {
    expect(receptionistGreeting('Talha law associates')).toContain('assistant for Talha law associates');
    expect(receptionistGreeting('Talha law associates')).toContain('not the lawyer');
  });

  it('greets an Urdu call in Urdu script', () => {
    expect(receptionistGreeting('Talha Law', 'ur')).toMatch(/[؀-ۿ]/);
  });
});

describe('lockLanguage', () => {
  it('lets the caller, not the greeting, decide a `mirror` call', () => {
    const s = session();
    expect(s.languageLocked).toBe(false);
    expect(receptionist.lockLanguage(s, 'I need help with a rent case', 'en')).toBe('en');
    expect(s.languageLocked).toBe(true);
  });

  it('keeps the locked language on later turns so the voice never flips', () => {
    const s = session();
    receptionist.lockLanguage(s, 'مجھے مدد چاہیے', 'ur');
    expect(s.language).toBe('ur');
    // A later English-looking turn must not switch the call.
    expect(receptionist.lockLanguage(s, 'ok thanks', 'en')).toBe('ur');
    expect(s.language).toBe('ur');
  });

  it('never re-detects when the firm pinned a policy', () => {
    const settings = parseAiSettings({ aiLanguagePolicy: 'english_only' });
    const s = session({ settings, ...newCallLanguageState(settings) });
    expect(s.languageLocked).toBe(true);
    expect(receptionist.lockLanguage(s, 'مجھے مدد چاہیے', 'ur')).toBe('en');
  });
});

describe('heuristicTurn', () => {
  it('lists slots when the client asks to book', () => {
    expect(heuristicTurn('I want to book an appointment tomorrow', null).tool).toBe('list_slots');
  });

  it('books a numbered slot after offers', () => {
    const offered = {
      lawyerId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d0e',
      lawyerName: 'Ayesha',
      slots: [
        { startsAt: new Date('2026-08-20T04:00:00Z'), endsAt: new Date('2026-08-20T04:30:00Z') },
      ],
    };
    expect(heuristicTurn('1 please', offered)).toMatchObject({ tool: 'book_appointment', slotIndex: 1 });
  });

  it('captures intake otherwise', () => {
    expect(heuristicTurn('my landlord is not returning the deposit', null).tool).toBe('capture_intake');
  });

  it('routes an Urdu-script ask and speaks the fallback line in Urdu', () => {
    const turn = heuristicTurn('مجھے ملاقات کا وقت چاہیے', null, 'ur');
    expect(turn.tool).toBe('list_slots');
    expect(turn.speak).toMatch(/[؀-ۿ]/);
  });
});

describe('recentCallTurns', () => {
  it('gives the model the call so far, so it stops re-asking', () => {
    const s = session({
      transcript: [
        { role: 'assistant', text: 'How can I help?' },
        { role: 'user', text: 'My name is Bilal' },
      ],
    });
    expect(recentCallTurns(s)).toBe('You: How can I help?\nCaller: My name is Bilal');
  });
});

describe('clipToSentence', () => {
  it('stops at a sentence end rather than mid-word', () => {
    expect(clipToSentence('One fact here. Second fact here.', 20)).toBe('One fact here.');
  });

  it('leaves short text alone', () => {
    expect(clipToSentence('Short.', 40)).toBe('Short.');
  });
});
