import { describe, expect, it } from 'vitest';
import {
  normalizeUrduForSpeech,
  urduClockTime,
  urduDigitSequence,
  urduNumberWords,
} from './urdu-speech';
import { prepareSpokenTtsText } from './spoken-text';

describe('urduNumberWords', () => {
  it('handles the irregular teens and twenties', () => {
    expect(urduNumberWords(1)).toBe('ایک');
    expect(urduNumberWords(11)).toBe('گیارہ');
    expect(urduNumberWords(20)).toBe('بیس');
    expect(urduNumberWords(25)).toBe('پچیس');
    expect(urduNumberWords(99)).toBe('ننانوے');
  });

  it('uses the South Asian scale, not millions', () => {
    expect(urduNumberWords(100)).toBe('ایک سو');
    expect(urduNumberWords(25_000)).toBe('پچیس ہزار');
    expect(urduNumberWords(100_000)).toBe('ایک لاکھ');
    expect(urduNumberWords(2_500_000)).toBe('پچیس لاکھ');
    expect(urduNumberWords(10_000_000)).toBe('ایک کروڑ');
  });

  it('joins a remainder onto the scale', () => {
    expect(urduNumberWords(1_500)).toBe('ایک ہزار پانچ سو');
    expect(urduNumberWords(125)).toBe('ایک سو پچیس');
  });
});

describe('urduClockTime', () => {
  it('uses the Urdu quarter and half idioms', () => {
    expect(urduClockTime(16, 0)).toBe('شام چار بجے');
    expect(urduClockTime(16, 15)).toBe('شام سوا چار بجے');
    expect(urduClockTime(16, 30)).toBe('شام ساڑھے چار بجے');
    // 4:45 is "a quarter to five", not "four forty-five".
    expect(urduClockTime(16, 45)).toBe('شام پونے پانچ بجے');
  });

  it('spells out an odd number of minutes', () => {
    expect(urduClockTime(9, 20)).toBe('صبح نو بج کر بیس منٹ');
  });

  it('picks the right part of day', () => {
    expect(urduClockTime(9, 0)).toContain('صبح');
    expect(urduClockTime(13, 0)).toContain('دوپہر');
    expect(urduClockTime(17, 0)).toContain('شام');
    expect(urduClockTime(22, 0)).toContain('رات');
  });
});

describe('urduDigitSequence', () => {
  it('reads a phone number digit by digit, as a person would', () => {
    expect(urduDigitSequence('030')).toBe('صفر تین صفر');
  });
});

describe('normalizeUrduForSpeech', () => {
  it('converts fees and dates to words', () => {
    expect(normalizeUrduForSpeech('فیس 25000 روپے ہے۔')).toContain('پچیس ہزار');
    expect(normalizeUrduForSpeech('پیشی 20 اگست کو ہے۔')).toContain('بیس اگست');
  });

  it('converts clock times, including the AM/PM marker', () => {
    const out = normalizeUrduForSpeech('دفتر کا وقت 9:00 AM سے 6:00 PM تک ہے۔');
    expect(out).toContain('صبح نو بجے');
    expect(out).toContain('شام چھ بجے');
    expect(out).not.toMatch(/AM|PM|\d/);
  });

  it('writes borrowed legal terms in Urdu script', () => {
    const out = normalizeUrduForSpeech('اپنا CNIC اور FIR کی کاپی WhatsApp پر بھیج دیں۔');
    expect(out).toContain('شناختی کارڈ');
    expect(out).toContain('ایف آئی آر');
    expect(out).toContain('واٹس ایپ');
    expect(out).not.toMatch(/[A-Za-z]/);
  });

  it('keeps a phone number digit by digit rather than as one huge cardinal', () => {
    const out = normalizeUrduForSpeech('مجھے 03001234567 پر کال کریں۔');
    expect(out).toContain('صفر تین صفر صفر');
    expect(out).not.toContain('کروڑ');
  });

  it('uses Urdu sentence punctuation', () => {
    expect(normalizeUrduForSpeech('ٹھیک ہے. اگلا مرحلہ.')).not.toContain('.');
  });

  it('leaves an English reply completely alone', () => {
    const english = 'Your hearing is on 20 August. The fee is 25000 PKR.';
    expect(normalizeUrduForSpeech(english)).toBe(english);
  });
});

describe('prepareSpokenTtsText — Urdu end to end', () => {
  it('hands the voice no Latin letters and no bare digits', () => {
    const reply = 'آپ کی پیشی 20 اگست کو 4:30 PM پر ہے۔ CNIC ساتھ لائیں۔ فیس 25000 روپے۔';
    const spoken = prepareSpokenTtsText(reply, 'female');
    expect(spoken).not.toMatch(/[A-Za-z]/);
    expect(spoken).not.toMatch(/\d/);
    expect(spoken).toContain('شام ساڑھے چار بجے');
    expect(spoken).toContain('شناختی کارڈ');
    expect(spoken).toContain('پچیس ہزار');
  });
});

describe('Latin words left in an Urdu reply', () => {
  // Left in Latin, the voice read them with English phonetics mid-sentence.
  const latin = /[A-Za-z]/;

  it('names courts the way Pakistanis say them', () => {
    const spoken = normalizeUrduForSpeech('آپ family court میں دعویٰ دائر کریں، high court بعد میں۔');
    expect(spoken).toContain('فیملی کورٹ');
    expect(spoken).toContain('ہائی کورٹ');
    expect(spoken).not.toMatch(latin);
  });

  it('writes common legal words in Urdu script', () => {
    const spoken = normalizeUrduForSpeech('bank سے return memo لیں اور legal notice بھیجیں۔');
    expect(spoken).toContain('بینک');
    expect(spoken).toContain('ریٹرن میمو');
    expect(spoken).toContain('لیگل نوٹس');
    expect(spoken).not.toMatch(latin);
  });

  it('reads a section with a letter as number then letter', () => {
    const spoken = normalizeUrduForSpeech('دفعہ 489-F کے تحت شکایت ہوگی۔');
    expect(spoken).toContain('چار سو نواسی ایف');
    expect(spoken).not.toContain('-');
  });

  it('spells an unknown acronym letter by letter', () => {
    expect(normalizeUrduForSpeech('FBR سے NTN بنوائیں۔')).toContain('ایف بی آر');
  });

  it('says weekdays in Urdu', () => {
    expect(normalizeUrduForSpeech('Monday کو دفتر آئیں۔')).toContain('پیر');
  });

  it('leaves an English reply alone', () => {
    expect(normalizeUrduForSpeech('Visit the family court on Monday.')).toBe('Visit the family court on Monday.');
  });
});
