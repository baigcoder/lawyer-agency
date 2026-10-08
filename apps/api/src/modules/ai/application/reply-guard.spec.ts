import { describe, expect, it } from 'vitest';
import { guardReply, type ReplyGuardInput } from './reply-guard';

const base: ReplyGuardInput = {
  clientText: '',
  sources: '',
  differentiators: ['Urdu-first', 'Same-day bail response'],
  voiceGender: 'female',
};

describe('guardReply', () => {
  it('drops a duration the firm never gave, keeps the rest', () => {
    expect(
      guardReply('Khula ka process aam tor par 3-6 mahine lag sakta hai. Consultation fee PKR 5,000 hai.', {
        ...base,
        clientText: 'khula ka kitna time lagta hai?',
      }),
    ).toBe('Consultation fee PKR 5,000 hai.');
    expect(
      guardReply('Is mein aam tor par 3-6 mahine lagte hain, lekin koi guarantee nahi.', { ...base, clientText: 'kitna time?' }),
    ).toBe('Koi guarantee nahi.');
  });

  it('keeps durations the client said or the sources contain', () => {
    const echo = 'Husband 8 mahine se kharcha nahi de raha, samajh aa gaya.';
    expect(guardReply(echo, { ...base, clientText: 'Husband 8 mahine se kharcha nahi de raha' })).toBe(echo);
    const sourced = 'Is mein aam tor par 2–4 months lagte hain [1].';
    expect(guardReply(sourced, { ...base, sources: 'Typical time 2–4 months.' })).toBe(sourced);
  });

  it('removes the sales line from a bail answer, not from other answers', () => {
    const reply = 'Bail ka time case pe depend karta hai. Hamari firm same-day bail response deti hai. FIR ki copy hai?';
    expect(guardReply(reply, { ...base, clientText: '489F mein bail kitne din mein milti hai?' })).toBe(
      'Bail ka time case pe depend karta hai. FIR ki copy hai?',
    );
    expect(
      guardReply('Aap ka sawal samajh aa gaya, hum guarantee nahi de sakte, lekin humari team same‑day bail response deti hai.', {
        ...base,
        clientText: 'bail ki guarantee hai?',
      }),
    ).toBe('Aap ka sawal samajh aa gaya, hum guarantee nahi de sakte.');
    const why = 'Hamari firm same-day bail response deti hai.';
    expect(guardReply(why, { ...base, clientText: 'aap ki firm kyun choose karun?' })).toBe(why);
  });

  it('gives the female assistant feminine first-person verbs', () => {
    expect(guardReply('Samajh gaya. Main madad kar sakta hoon, jawab dunga.', base)).toBe(
      'Samajh gayi. Main madad kar sakti hoon, jawab dungi.',
    );
    expect(guardReply('آپ کا مسئلہ سمجھ گیا ہوں۔ میں مدد کر سکتا ہوں، جواب دوں گا۔', base)).toBe(
      'آپ کا مسئلہ سمجھ گئی ہوں۔ میں مدد کر سکتی ہوں، جواب دوں گی۔',
    );
  });

  it('leaves agreement with a masculine noun, and a male voice, alone', () => {
    expect(guardReply('Aap ka masla samajh aa gaya.', base)).toBe('Aap ka masla samajh aa gaya.');
    expect(guardReply('آپ کا مسئلہ سمجھ آگیا۔', base)).toBe('آپ کا مسئلہ سمجھ آگیا۔');
    expect(guardReply('Samajh gaya, main dekhta hoon.', { ...base, voiceGender: 'male' })).toBe(
      'Samajh gaya, main dekhta hoon.',
    );
  });

  it('never empties the reply', () => {
    expect(guardReply('Is mein 6 mahine lagte hain.', base)).toBe('Is mein 6 mahine lagte hain.');
  });
});
