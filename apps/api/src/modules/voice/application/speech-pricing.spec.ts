import { describe, expect, it } from 'vitest';
import { pcmSeconds, sttCostMicros, ttsCostMicros } from './speech-pricing';
import { ttsModelPlan } from '../infrastructure/elevenlabs-tts.request';

describe('ttsCostMicros', () => {
  it('prices a realistic Urdu voice note', () => {
    // ~400 characters on eleven_v3 at $0.15/1k = $0.06.
    expect(ttsCostMicros('eleven_v3', 400)).toBe(60_000);
  });

  it('charges the faster models at their lower rate', () => {
    expect(ttsCostMicros('eleven_turbo_v2_5', 1_000)).toBe(75_000);
    expect(ttsCostMicros('eleven_v3', 1_000)).toBe(150_000);
  });

  it('charges nothing for the local engine', () => {
    expect(ttsCostMicros('espeak-ng', 5_000)).toBe(0);
  });

  it('prices an unknown model conservatively rather than as free', () => {
    expect(ttsCostMicros('some_future_model', 1_000)).toBe(150_000);
  });

  it('never returns a negative cost', () => {
    expect(ttsCostMicros('eleven_v3', -100)).toBe(0);
  });
});

describe('sttCostMicros', () => {
  it('prices a one-minute voice note', () => {
    expect(sttCostMicros('scribe_v1', 60)).toBe(6_000);
  });

  it('reflects how much cheaper Groq Whisper is', () => {
    expect(sttCostMicros('whisper-large-v3', 60)).toBeLessThan(sttCostMicros('scribe_v1', 60));
  });
});

describe('pcmSeconds', () => {
  it('converts a sample count to seconds', () => {
    expect(pcmSeconds(48_000, 48_000)).toBe(1);
    expect(pcmSeconds(24_000, 48_000)).toBe(0.5);
  });

  it('does not divide by zero', () => {
    expect(pcmSeconds(48_000, 0)).toBe(0);
  });
});

describe('ttsModelPlan — configurable Urdu note model', () => {
  it('defaults to the model with real Urdu support', () => {
    expect(ttsModelPlan({ language: 'ur', liveCall: false })[0]).toBe('eleven_v3');
  });

  it('honours a firm that chose the ~9x faster model', () => {
    const plan = ttsModelPlan({ language: 'ur', liveCall: false, urduNoteModel: 'eleven_turbo_v2_5' });
    expect(plan[0]).toBe('eleven_turbo_v2_5');
    // The other model stays as the fallback either way.
    expect(plan).toContain('eleven_v3');
  });

  it('ignores the setting for English, which turbo handles natively', () => {
    const plan = ttsModelPlan({ language: 'en', liveCall: false, urduNoteModel: 'eleven_v3' });
    expect(plan[0]).toBe('eleven_turbo_v2_5');
  });
});
