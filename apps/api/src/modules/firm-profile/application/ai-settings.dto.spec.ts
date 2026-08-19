import { describe, expect, it } from 'vitest';
import {
  buildAiAssumptionsBlock,
  defaultAiSettings,
  generateGreetingIntro,
  parseAiSettings,
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
  });
});
