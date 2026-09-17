import { describe, expect, it } from 'vitest';
import { pickGenderedForm, prepareSpokenTtsText } from './spoken-text';
import {
  buildAiAssumptionsBlock,
  defaultAiSettings,
  urduGenderInstruction,
} from '../../firm-profile/application/ai-settings.dto';

describe('pickGenderedForm', () => {
  it('picks by suffix, not by order', () => {
    expect(pickGenderedForm('سکتا', 'سکتی', 'female')).toBe('سکتی');
    expect(pickGenderedForm('سکتی', 'سکتا', 'female')).toBe('سکتی');
    expect(pickGenderedForm('سکتا', 'سکتی', 'male')).toBe('سکتا');
    expect(pickGenderedForm('سکتی', 'سکتا', 'male')).toBe('سکتا');
  });

  it('declines non-gendered pairs so both words survive', () => {
    expect(pickGenderedForm('and', 'or', 'female')).toBeUndefined();
    // "یا/اور" is a word pair, not a gender doublet.
    expect(pickGenderedForm('یا', 'اور', 'male')).toBeUndefined();
    // Both halves are kept, separated by a spoken pause.
    const spoken = prepareSpokenTtsText('کل یا/اور پرسوں آئیں', 'female');
    expect(spoken).toContain('یا');
    expect(spoken).toContain('اور');
  });

  it('keeps an English date written with a slash intact', () => {
    expect(prepareSpokenTtsText('Come on 12/3 please', 'female')).toContain('12/3');
  });
});

describe('prepareSpokenTtsText — Urdu gender agreement', () => {
  const doublet = 'میں آپ کی مدد کر سکتا/سکتی ہوں۔';

  it('speaks the feminine form in a female voice', () => {
    // A female voice saying "کر سکتا ہوں" is instantly not a real person.
    expect(prepareSpokenTtsText(doublet, 'female')).toContain('سکتی');
    expect(prepareSpokenTtsText(doublet, 'female')).not.toContain('سکتا');
  });

  it('speaks the masculine form in a male voice', () => {
    expect(prepareSpokenTtsText(doublet, 'male')).toContain('سکتا');
    expect(prepareSpokenTtsText(doublet, 'male')).not.toContain('سکتی');
  });

  it('defaults to the old behaviour when no voice is given', () => {
    expect(prepareSpokenTtsText(doublet)).toContain('سکتا');
  });
});

describe('urduGenderInstruction', () => {
  it('tells the model which gender it speaks as', () => {
    expect(urduGenderInstruction('female')).toContain('سکتی');
    expect(urduGenderInstruction('male')).toContain('سکتا');
  });
});

describe('buildAiAssumptionsBlock — spoken replies', () => {
  const settings = defaultAiSettings();

  it('requires Urdu script only when the reply will be spoken', () => {
    const spoken = buildAiAssumptionsBlock(settings, { replyWillBeSpoken: true });
    expect(spoken).toContain('SPOKEN ALOUD');
    expect(spoken).toContain('never in Roman Urdu');
  });

  it('leaves a text reply free to mirror Roman Urdu (D-004)', () => {
    const written = buildAiAssumptionsBlock(settings);
    expect(written).not.toContain('SPOKEN ALOUD');
    // The script-mirroring policy is still there for written replies.
    expect(written).toContain('Roman Urdu');
  });

  it('always states the speaker gender so Urdu verbs agree', () => {
    expect(buildAiAssumptionsBlock({ ...settings, aiVoiceGender: 'female' })).toContain('سکتی');
    expect(buildAiAssumptionsBlock({ ...settings, aiVoiceGender: 'male' })).toContain('سکتا');
  });
});
