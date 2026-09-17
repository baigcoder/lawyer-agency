import { describe, expect, it } from 'vitest';
import { isRomanUrduReply, replyScript } from './reply-script';
import { defaultDisclosure, defaultSpokenDisclosure } from './ai-prompt-variables';
import { buildAiAssumptionsBlock, defaultAiSettings } from '../../firm-profile/application/ai-settings.dto';

const vars = { displayName: 'Talha Law', ownerName: 'Not provided' };

describe('replyScript', () => {
  it('reads Roman Urdu as Latin script', () => {
    expect(replyScript('Aapki behn ka khula ka case samajh gaya')).toBe('latin');
  });

  it('reads Urdu script as Urdu', () => {
    expect(replyScript('آپ کی بہن کا خلع کا کیس سمجھ گیا')).toBe('urdu');
  });

  it('defaults short text to Urdu script, the safer choice for a Pakistani client', () => {
    expect(replyScript('ok')).toBe('urdu');
  });

  it('is not fooled by a few English words inside Urdu script', () => {
    expect(replyScript('آپ کا CNIC اور FIR کی کاپی درکار ہے، شکریہ')).toBe('urdu');
  });
});

describe('isRomanUrduReply', () => {
  it('is true only when the language is UR and the script is Latin', () => {
    expect(isRomanUrduReply('UR', 'Aap ko kya chahiye bataiye')).toBe(true);
    expect(isRomanUrduReply('UR', 'بتائیں آپ کو کیا چاہیے')).toBe(false);
    expect(isRomanUrduReply('EN', 'Tell me how I can help you')).toBe(false);
  });
});

describe('defaultDisclosure', () => {
  it('mirrors Roman Urdu instead of answering in Urdu script', () => {
    // The client got Urdu script here while the agent replied in Roman Urdu —
    // two scripts in one message.
    const line = defaultDisclosure('UR', vars, { romanUrdu: true });
    expect(line).not.toMatch(/[؀-ۿ]/);
    expect(line).toContain('wakeel nahi');
  });

  it('uses Urdu script when the client writes Urdu script', () => {
    expect(defaultDisclosure('UR', vars, { romanUrdu: false })).toMatch(/[؀-ۿ]/);
  });

  it('agrees the Urdu verb with the configured voice', () => {
    expect(defaultDisclosure('UR', vars, { voiceGender: 'female', voiceEnabled: true })).toContain('دوں گی');
    expect(defaultDisclosure('UR', vars, { voiceGender: 'male', voiceEnabled: true })).toContain('دوں گا');
  });

  it('agrees gender in Roman Urdu too, not just Urdu script', () => {
    const female = defaultDisclosure('UR', vars, { romanUrdu: true, voiceGender: 'female' });
    const male = defaultDisclosure('UR', vars, { romanUrdu: true, voiceGender: 'male' });
    expect(female).toContain('dungi');
    expect(female).not.toContain('dunga');
    expect(male).toContain('dunga');
  });

  it('only promises to answer voice notes when the firm speaks back', () => {
    expect(defaultDisclosure('EN', vars, { voiceEnabled: true })).toContain('voice notes');
    expect(defaultDisclosure('EN', vars, { voiceEnabled: false })).not.toContain('voice notes');
    expect(defaultDisclosure('UR', vars, { voiceEnabled: false })).not.toContain('وائس نوٹ');
    expect(defaultDisclosure('UR', vars, { romanUrdu: true, voiceEnabled: false })).not.toContain('voice notes');
  });

  it('still says it is not the lawyer, in every variant', () => {
    expect(defaultDisclosure('EN', vars)).toContain('not a lawyer');
    expect(defaultDisclosure('UR', vars)).toContain('وکیل نہیں');
    expect(defaultDisclosure('UR', vars, { romanUrdu: true })).toContain('wakeel nahi');
  });
});

describe('defaultSpokenDisclosure', () => {
  it('never uses Roman Urdu — an Urdu voice mispronounces Latin letters', () => {
    const line = defaultSpokenDisclosure('UR', vars);
    expect(line).toContain('وکیل نہیں');
    // The firm's own name stays as written; only the Urdu words must be in
    // Urdu script, so strip the firm name before asserting.
    expect(line.replace(vars.displayName, '')).not.toMatch(/[A-Za-z]/);
  });
});

describe('language policy instruction', () => {
  it('forbids mixing scripts, which the model does unprompted', () => {
    const settings = defaultAiSettings();
    expect(buildAiAssumptionsBlock(settings)).toContain('Never mix Urdu script and Roman Urdu');
    expect(buildAiAssumptionsBlock({ ...settings, aiLanguagePolicy: 'urdu_preferred' })).toContain(
      'Never mix Urdu script and Roman Urdu',
    );
  });

  it('does not bother with the rule when the firm is English-only', () => {
    const englishOnly = { ...defaultAiSettings(), aiLanguagePolicy: 'english_only' as const };
    expect(buildAiAssumptionsBlock(englishOnly)).not.toContain('Never mix');
  });
});
