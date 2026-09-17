import { describe, expect, it } from 'vitest';
import { ambiguousScan, containsPhrase, keywordScan } from './escalation-detector.service';

describe('containsPhrase', () => {
  it('matches on word boundaries, not substrings', () => {
    expect(containsPhrase('I was at the thana', 'thana')).toBe(true);
    expect(containsPhrase('our office is in Thanawala Road', 'thana')).toBe(false);
  });

  it('is case-insensitive and works with Urdu script', () => {
    expect(containsPhrase('Police Station', 'police station')).toBe(true);
    expect(containsPhrase('میرا بھائی گرفتار ہے', 'گرفتار')).toBe(true);
  });
});

describe('keywordScan — unambiguous emergencies', () => {
  it('still catches self-harm and violence immediately', () => {
    expect(keywordScan('I want to kill myself')).toMatchObject({ triggerType: 'SELF_HARM' });
    expect(keywordScan('my husband beats me')).toMatchObject({ triggerType: 'DOMESTIC_VIOLENCE' });
    expect(keywordScan('خودکشی کا سوچ رہا ہوں')).toMatchObject({ triggerType: 'SELF_HARM' });
  });

  it('still catches a first-person arrest and a killing', () => {
    expect(keywordScan('I was arrested last night, help')).toMatchObject({ triggerType: 'ACTIVE_ARREST' });
    expect(keywordScan('my brother killed someone')).toMatchObject({ triggerType: 'ACTIVE_ARREST' });
    expect(keywordScan('he is in jail right now')).toMatchObject({ triggerType: 'ACTIVE_ARREST' });
  });

  it('still catches an imminent hearing', () => {
    expect(keywordScan('my hearing is tomorrow')).toBeNull();
    expect(keywordScan('hearing tomorrow, what do I bring?')).toMatchObject({
      triggerType: 'IMMINENT_DEADLINE',
    });
  });

  it('catches an arrest reported about the client’s own people', () => {
    expect(keywordScan('my brother arrested please help')).toMatchObject({ triggerType: 'ACTIVE_ARREST' });
    expect(keywordScan('mera beta giraftar ho gaya')).toMatchObject({ triggerType: 'ACTIVE_ARREST' });
    expect(keywordScan('police arrested my son last night')).toMatchObject({ triggerType: 'ACTIVE_ARREST' });
  });

  it('does NOT hard-escalate ordinary legal vocabulary', () => {
    // These used to set the conversation to HUMAN_REQUIRED and stop the AI.
    expect(keywordScan('what is the procedure to file an FIR at a police station?')).toBeNull();
    expect(keywordScan('how much do you charge for a murder trial?')).toBeNull();
    expect(keywordScan('what documents are needed for bail?')).toBeNull();
    expect(keywordScan('ضمانت کا طریقہ کار کیا ہے؟')).toBeNull();
  });
});

describe('ambiguousScan — needs a judgement call', () => {
  it('flags legal vocabulary for model triage instead of dropping it', () => {
    expect(ambiguousScan('what is the procedure to file an FIR at a police station?')).toMatchObject({
      triggerType: 'ACTIVE_ARREST',
    });
    expect(ambiguousScan('how much do you charge for a murder trial?')).toMatchObject({
      triggerType: 'ACTIVE_ARREST',
    });
  });

  it('stays quiet when a certain trigger already fired', () => {
    expect(ambiguousScan('I was arrested at the police station')).toBeNull();
  });

  it('stays quiet on ordinary messages', () => {
    expect(ambiguousScan('what are your office hours?')).toBeNull();
    expect(ambiguousScan('Salam, I need help with a property transfer')).toBeNull();
  });
});
