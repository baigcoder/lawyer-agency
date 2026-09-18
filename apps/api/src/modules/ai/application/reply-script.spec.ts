import { describe, expect, it } from 'vitest';
import { clientWritesLatin, isRomanUrduReply, replyLanguageLabel, replyScript } from './reply-script';
import { defaultDisclosure, defaultSpokenDisclosure, mergePromptVariables } from './ai-prompt-variables';
import { buildAiAssumptionsBlock, defaultAiSettings, urduGenderInstruction } from '../../firm-profile/application/ai-settings.dto';

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

describe('replyLanguageLabel', () => {
  it('tells the model "Roman Urdu" when the client typed in English letters', () => {
    // It used to render the bare code, so the prompt read "Reply in UR." —
    // and UR reads as Urdu script.
    const label = replyLanguageLabel('UR', 'Mere walid ka inteqal ho gaya hai', false);
    expect(label).toContain('Roman Urdu');
    expect(label).not.toBe('UR');
  });

  it('asks for Urdu script when the client wrote Urdu script', () => {
    expect(replyLanguageLabel('UR', 'میرے والد کا انتقال ہو گیا ہے', false)).toContain('Urdu script');
  });

  it('asks for Urdu script on a spoken reply whatever the client typed', () => {
    // The Urdu voice reads Latin letters with English phonetics.
    expect(replyLanguageLabel('UR', 'Mere walid ka inteqal ho gaya hai', true)).toContain('Urdu script');
  });

  it('says English in words for English and unknown', () => {
    expect(replyLanguageLabel('EN', 'My father passed away', false)).toBe('English');
    expect(replyLanguageLabel('UNKNOWN', '👍', false)).toBe('English');
  });

  it('decides by majority, so quoting "CNIC" inside Urdu script stays Urdu', () => {
    expect(clientWritesLatin('میرا CNIC اور FIR کی کاپی میرے پاس ہے')).toBe(false);
    expect(clientWritesLatin('mera CNIC aur FIR ki copy mere paas hai')).toBe(true);
  });

  it('uses an example that is neutral about the speaker gender', () => {
    // "samajh aa gaya" agrees with "masla", not with the assistant.
    expect(replyLanguageLabel('UR', 'aap madad karein', false)).toContain('samajh aa gaya');
  });
});

describe('mergePromptVariables language rendering', () => {
  const ctx = {
    firm: {
      firmName: 'F', displayName: 'F', city: 'Lahore', officeAddress: '', website: '',
      practiceAreas: [], clientLanguages: ['EN', 'UR', 'ROMAN_URDU'], officeHours: '', consultationFeePkr: 0,
      teamSize: 1, firmAbout: '', foundingYear: null, differentiators: [],
    },
    ownerProfile: null,
    aiSettings: defaultAiSettings(),
    isFirstClientTurn: false,
    conversationHistory: '',
    lastAiReply: '',
    intakeFields: {},
    clientId: 'c',
    caseId: undefined,
    retrievedChunks: [],
    retrievedContext: '',
    replyWillBeSpoken: false,
  } as unknown as Parameters<typeof mergePromptVariables>[0];

  it('never hands a template the raw "UR" code for a Roman Urdu client', () => {
    const vars = mergePromptVariables(ctx, { clientText: 'meri behn ka khula ka case hai', language: 'UR' });
    expect(vars['language']).toContain('Roman Urdu');
  });

  it('leaves variables without a language untouched', () => {
    expect(mergePromptVariables(ctx, { clientText: 'x' })['language']).toBeUndefined();
  });
});

describe('urduGenderInstruction in Roman Urdu', () => {
  it('gives Roman Urdu forms, not just Urdu script', () => {
    // With script-only examples, Roman Urdu replies still opened "Samajh gaya".
    expect(urduGenderInstruction('female')).toContain('samajh gayi');
    expect(urduGenderInstruction('male')).toContain('samajh gaya');
  });
});
