import { describe, expect, it } from 'vitest';
import { matchPakistanLawyerKnowledge, normalizeQuery } from './pakistan-lawyer-knowledge';

describe('matchPakistanLawyerKnowledge', () => {
  it('returns FIR/bail process notes for an arrest question', () => {
    const hits = matchPakistanLawyerKnowledge('mera bhai giraftar ho gaya, FIR hoi hai, bail chahiye');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.title).toMatch(/FIR|bail/i);
  });

  it('returns family process notes for khula', () => {
    const hits = matchPakistanLawyerKnowledge('khula ke liye kya documents chahiye');
    expect(hits.some((h) => /family|khula/i.test(h.title))).toBe(true);
  });

  it('returns tax/FBR process notes for a filer question', () => {
    const hits = matchPakistanLawyerKnowledge('I am a tax filer and got an FBR notice');
    expect(hits.some((h) => /tax|cheque/i.test(h.title))).toBe(true);
  });

  it('matches bail stages and cybercrime articles', () => {
    expect(matchPakistanLawyerKnowledge('pre arrest bail zamanat stages').some((h) => /bail/i.test(h.title))).toBe(
      true,
    );
    expect(matchPakistanLawyerKnowledge('FIA cyber blackmail facebook').some((h) => /cyber/i.test(h.title))).toBe(
      true,
    );
  });

  it('matches overseas mukhtarnama and labour forum questions', () => {
    expect(
      matchPakistanLawyerKnowledge('overseas pakistan mukhtarnama power of attorney').some((h) =>
        /mukhtar|overseas|power/i.test(h.title),
      ),
    ).toBe(true);
    expect(
      matchPakistanLawyerKnowledge('illegal termination unpaid salary labour court').some((h) =>
        /labour|consumer/i.test(h.title),
      ),
    ).toBe(true);
  });
});

describe('normalizeQuery', () => {
  it('strips common Roman Urdu particles', () => {
    expect(normalizeQuery('khula ke liye kya documents')).toContain('khula');
    expect(normalizeQuery('khula ke liye kya documents')).not.toMatch(/\bke\b/);
  });
});
