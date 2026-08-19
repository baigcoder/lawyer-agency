import { describe, expect, it } from 'vitest';
import { applyFirmScopeIntent, isCasualOffTopic } from './firm-scope';
import { defaultAiSettings } from '../../firm-profile/application/ai-settings.dto';

describe('firm-scope', () => {
  it('treats flirty casual messages as off-topic', () => {
    expect(isCasualOffTopic('hi love')).toBe(true);
    expect(isCasualOffTopic('hey baby')).toBe(true);
    expect(isCasualOffTopic('I love you')).toBe(true);
  });

  it('allows a plain greeting and legal questions', () => {
    expect(isCasualOffTopic('hi')).toBe(false);
    expect(isCasualOffTopic('salam')).toBe(false);
    expect(isCasualOffTopic('I need a divorce lawyer')).toBe(false);
    expect(isCasualOffTopic('When is my court hearing?')).toBe(false);
  });

  it('overrides router GREETING to OFF_TOPIC when firm-scope is on', () => {
    const settings = defaultAiSettings();
    expect(applyFirmScopeIntent('GREETING', 'hi love', settings)).toBe('OFF_TOPIC');
    expect(applyFirmScopeIntent('GREETING', 'hi', settings)).toBe('GREETING');
  });

  it('does not override when firm-scope is disabled', () => {
    const settings = { ...defaultAiSettings(), aiFirmScopeOnly: false };
    expect(applyFirmScopeIntent('GREETING', 'hi love', settings)).toBe('GREETING');
  });
});
