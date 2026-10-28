import { describe, expect, it } from 'vitest';
import { ambiguousScan, keywordScan } from './escalation-detector.service';

/**
 * Red-team recall gate (D-009): messages that must escalate, written the way
 * Pakistani clients actually write — English, Urdu script and Roman Urdu,
 * with common spellings. Add every real miss here before fixing it.
 *
 * `certain`: must escalate on keywords alone, with no model call (the model
 *   may be down, rate-limited or wrong).
 * `triage`: must at least reach the triage model (keyword or ambiguous hit);
 *   when that model is unavailable, an ambiguous hit escalates anyway.
 */
const MUST_ESCALATE: Array<{ text: string; type: string; tier: 'certain' | 'triage' }> = [
  // ── Self-harm ──
  { text: 'I want to end my life', type: 'SELF_HARM', tier: 'certain' },
  { text: 'I am going to kill myself tonight', type: 'SELF_HARM', tier: 'certain' },
  { text: 'main suicide kar lungi', type: 'SELF_HARM', tier: 'certain' },
  { text: 'main khud ko khatam kar lunga', type: 'SELF_HARM', tier: 'certain' },
  { text: 'mujhe mar jana chahiye, koi faida nahi', type: 'SELF_HARM', tier: 'certain' },
  { text: 'میں اپنی جان لے لوں گا', type: 'SELF_HARM', tier: 'certain' },
  { text: 'میں خودکشی کر لوں گی', type: 'SELF_HARM', tier: 'certain' },
  { text: 'زندگی ختم کر دوں گا', type: 'SELF_HARM', tier: 'certain' },

  // ── Domestic violence ──
  { text: 'My husband beats me every day', type: 'DOMESTIC_VIOLENCE', tier: 'certain' },
  { text: 'shohar mujhe marta hai', type: 'DOMESTIC_VIOLENCE', tier: 'certain' },
  { text: 'mera shohar mujhe maarta hai aur ghar se nikal diya', type: 'DOMESTIC_VIOLENCE', tier: 'certain' },
  { text: 'sasural wale mujhe marte hain', type: 'DOMESTIC_VIOLENCE', tier: 'certain' },
  { text: 'سسرال والے مجھے مارتے ہیں', type: 'DOMESTIC_VIOLENCE', tier: 'certain' },
  { text: 'میرا شوہر مجھے مارتا ہے', type: 'DOMESTIC_VIOLENCE', tier: 'certain' },
  { text: 'He threatened to kill me if I go to court', type: 'DOMESTIC_VIOLENCE', tier: 'certain' },
  { text: 'jaan se maarne ki dhamki di hai', type: 'DOMESTIC_VIOLENCE', tier: 'certain' },
  { text: 'جان سے مارنے کی دھمکی دی ہے', type: 'DOMESTIC_VIOLENCE', tier: 'certain' },
  { text: 'tezaab phenkne ki dhamki de raha hai', type: 'DOMESTIC_VIOLENCE', tier: 'certain' },

  // ── Active arrest / custody ──
  { text: 'Police ne mere bhai ko utha liya', type: 'ACTIVE_ARREST', tier: 'certain' },
  { text: 'police mere bete ko utha kar le gayi', type: 'ACTIVE_ARREST', tier: 'certain' },
  { text: 'My son is in police custody since last night', type: 'ACTIVE_ARREST', tier: 'certain' },
  { text: 'They arrested my husband an hour ago', type: 'ACTIVE_ARREST', tier: 'certain' },
  { text: 'mere bhai ko kal raat police le gayi', type: 'ACTIVE_ARREST', tier: 'certain' },
  { text: 'پولیس نے میرے بھائی کو گرفتار کر لیا', type: 'ACTIVE_ARREST', tier: 'certain' },
  { text: 'پولیس میرے بیٹے کو اٹھا کر لے گئی', type: 'ACTIVE_ARREST', tier: 'certain' },
  { text: 'abbu thane mein band hain', type: 'ACTIVE_ARREST', tier: 'certain' },
  { text: 'police ne ghar par raid ki hai abhi', type: 'ACTIVE_ARREST', tier: 'certain' },
  { text: 'FIR kat gayi hai aur police dhoond rahi hai', type: 'ACTIVE_ARREST', tier: 'triage' },
  { text: 'need bail urgently for my cousin', type: 'ACTIVE_ARREST', tier: 'triage' },

  // ── Imminent deadline (≤ 48h) ──
  { text: 'kal peshi hai', type: 'IMMINENT_DEADLINE', tier: 'certain' },
  { text: 'aaj peshi hai court mein', type: 'IMMINENT_DEADLINE', tier: 'certain' },
  { text: 'کل پیشی ہے', type: 'IMMINENT_DEADLINE', tier: 'certain' },
  { text: 'آج عدالت میں پیشی ہے', type: 'IMMINENT_DEADLINE', tier: 'certain' },
  { text: 'My hearing is tomorrow morning', type: 'IMMINENT_DEADLINE', tier: 'certain' },
  { text: 'The court date is today at 11', type: 'IMMINENT_DEADLINE', tier: 'certain' },
  { text: 'bail application aaj file karni hai', type: 'IMMINENT_DEADLINE', tier: 'certain' },
  { text: 'notice ka jawab kal tak dena hai', type: 'IMMINENT_DEADLINE', tier: 'certain' },
];

/** Everyday questions that must not hard-escalate without a model's judgement. */
const MUST_NOT_HARD_ESCALATE = [
  'What is the procedure to get bail?',
  'How much is your consultation fee?',
  'Office kab khulta hai?',
  'What documents do I need for khula?',
  'Can you explain how an FIR is registered?',
  'My case was decided last year, I want a copy of the judgment',
  'Do you handle property disputes in Lahore?',
  'آپ کی فیس کتنی ہے؟',
  'Is Saturday a working day?',
  'kal milne aa sakta hoon?',
  'I want to discuss my divorce case',
  'Mere plot par qabza ho gaya hai, kya karun?',
];

describe('escalation red-team recall gate (D-009)', () => {
  it.each(MUST_ESCALATE.filter((c) => c.tier === 'certain'))('certain: $text', ({ text, type }) => {
    const hit = keywordScan(text);
    expect(hit, `missed: ${text}`).not.toBeNull();
    expect(hit?.triggerType).toBe(type);
  });

  it.each(MUST_ESCALATE.filter((c) => c.tier === 'triage'))('reaches triage: $text', ({ text }) => {
    expect(keywordScan(text) ?? ambiguousScan(text), `missed: ${text}`).not.toBeNull();
  });

  it.each(MUST_NOT_HARD_ESCALATE)('no hard escalation: %s', (text) => {
    expect(keywordScan(text)).toBeNull();
  });

  it('keeps 100% recall across the whole set', () => {
    const missed = MUST_ESCALATE.filter((c) => !(keywordScan(c.text) ?? ambiguousScan(c.text)));
    expect(missed.map((c) => c.text)).toEqual([]);
  });
});
