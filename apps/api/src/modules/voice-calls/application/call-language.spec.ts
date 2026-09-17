import { describe, expect, it } from 'vitest';
import {
  detectCallLanguage,
  initialCallLanguage,
  isRomanUrdu,
  languageInstruction,
  line,
  spokenBookingConfirmation,
  spokenSlotOffer,
  spokenTime,
} from './call-language';

describe('initialCallLanguage', () => {
  it('locks an explicit firm policy immediately', () => {
    expect(initialCallLanguage('english_only')).toEqual({ language: 'en', locked: true });
    expect(initialCallLanguage('urdu_preferred')).toEqual({ language: 'ur', locked: true });
  });

  it('opens `mirror` in Urdu but leaves it unlocked for the caller to decide', () => {
    expect(initialCallLanguage('mirror')).toEqual({ language: 'ur', locked: false });
  });
});

describe('detectCallLanguage', () => {
  it('trusts the provider language code', () => {
    expect(detectCallLanguage('some transcript', 'ur')).toBe('ur');
    expect(detectCallLanguage('some transcript', 'en')).toBe('en');
  });

  it('treats Hindi/Punjabi/Farsi codes as Urdu', () => {
    expect(detectCallLanguage('bolna hai', 'hi')).toBe('ur');
    expect(detectCallLanguage('bolna hai', 'pa')).toBe('ur');
  });

  it('overrides an `en` code when the words are Roman Urdu', () => {
    expect(detectCallLanguage('mujhe wakeel se baat karni hai', 'en')).toBe('ur');
  });

  it('falls back to Arabic script when nothing is reported', () => {
    expect(detectCallLanguage('مجھے مدد چاہیے', null)).toBe('ur');
    expect(detectCallLanguage('I need help with a property case', null)).toBe('en');
  });
});

describe('isRomanUrdu', () => {
  it('needs more than one marker so English is not misread', () => {
    expect(isRomanUrdu('hai')).toBe(false);
    expect(isRomanUrdu('mujhe madad chahiye')).toBe(true);
  });
});

describe('spoken output', () => {
  const at = new Date('2026-08-20T11:30:00Z'); // 16:30 PKT

  it('speaks a slot time as words, never an ISO timestamp', () => {
    const spoken = spokenTime(at, 'en');
    expect(spoken).not.toContain('T11:30');
    expect(spoken).toContain('4:30');
  });

  it('numbers the slot offer and asks for 1/2/3', () => {
    const offer = spokenSlotOffer('Ayesha', [{ startsAt: at }, { startsAt: at }], 'en');
    expect(offer).toContain('1)');
    expect(offer).toContain('2)');
    expect(offer).toContain('Say 1, 2, or 3.');
    expect(offer).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('confirms a booking in the call language', () => {
    expect(spokenBookingConfirmation('Ayesha', at, 'en')).toContain('Booked with Ayesha');
    expect(spokenBookingConfirmation('Ayesha', at, 'ur')).toMatch(/[؀-ۿ]/);
  });

  it('has an Urdu form for every spoken line', () => {
    for (const key of ['escalating', 'callLimit', 'noSlotsThisWeek', 'tellMeBriefly'] as const) {
      expect(line(key, 'ur')).toMatch(/[؀-ۿ]/);
      expect(line(key, 'en')).toMatch(/[A-Za-z]/);
    }
  });
});

describe('languageInstruction', () => {
  it('forbids Roman Urdu on an Urdu call — the Urdu voice mispronounces Latin script', () => {
    expect(languageInstruction('ur')).toContain('Never reply in Roman Urdu');
    expect(languageInstruction('en')).toContain('only in English');
  });
});
