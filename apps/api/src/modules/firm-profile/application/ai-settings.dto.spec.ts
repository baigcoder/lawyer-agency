import { describe, expect, it } from 'vitest';
import {
  aiSettingsSchema,
  buildAiAssumptionsBlock,
  defaultAiSettings,
  generateGreetingIntro,
  parseAiSettings,
  persistAiSettings,
} from './ai-settings.dto';

describe('AI settings helpers', () => {
  it('generates an English intro from firm profile fields', () => {
    const intro = generateGreetingIntro(
      {
        displayName: 'Baigo Law',
        city: 'Lahore',
        practiceAreas: ['Family law', 'Criminal defence'],
        firmAbout: '',
      },
      'en',
    );
    expect(intro).toContain('{{displayName}}');
    expect(intro).toContain('intake');
    expect(intro.length).toBeLessThanOrEqual(500);
  });

  it('generates an Urdu intro for the same firm', () => {
    const intro = generateGreetingIntro(
      {
        displayName: 'Baigo Law',
        city: 'لاہور',
        practiceAreas: ['فیملی لا'],
        firmAbout: '',
      },
      'ur',
    );
    expect(intro).toMatch(/[\u0600-\u06FF]/);
    expect(intro).toContain('{{displayName}}');
  });

  it('includes real-case assumptions in the prompt block', () => {
    const block = buildAiAssumptionsBlock(defaultAiSettings());
    expect(block).toMatch(/Never give legal advice/);
    expect(block).toMatch(/Do not invent case facts/);
    expect(block).toMatch(/Only answer questions about this law firm/);
    expect(block).toMatch(/same language/);
  });

  it('parses missing new fields as defaults', () => {
    const parsed = parseAiSettings({ aiTone: 'formal' });
    expect(parsed.aiLanguagePolicy).toBe('mirror');
    expect(parsed.aiReplyLength).toBe('balanced');
    expect(parsed.aiVoiceId).toBe('');
    expect(parsed.aiAskClarifyingQuestions).toBe(true);
    expect(parsed.aiFirmScopeOnly).toBe(true);
    expect(parsed.callsTakenBy).toBe('ai');
    expect(parsed.aiCallHoursTimezone).toBe('Asia/Karachi');
  });
});

describe('persistAiSettings', () => {
  it('stores every settings field, so none is silently dropped on save', () => {
    // It lists fields by hand. aiVoiceIdUrdu was left off: PUT answered 200
    // and the firm's Urdu voice was gone on the next load.
    const stored = persistAiSettings(defaultAiSettings());
    for (const key of Object.keys(aiSettingsSchema.shape)) {
      expect(stored, key).toHaveProperty(key);
    }
  });

  it('round-trips a separately chosen Urdu voice', () => {
    const settings = { ...defaultAiSettings(), aiVoiceId: 'EnglishPick000000001', aiVoiceIdUrdu: 'UrduPick000000000001' };
    const reloaded = parseAiSettings(persistAiSettings(settings));
    expect(reloaded.aiVoiceIdUrdu).toBe('UrduPick000000000001');
    expect(reloaded.aiVoiceId).toBe('EnglishPick000000001');
  });
});
