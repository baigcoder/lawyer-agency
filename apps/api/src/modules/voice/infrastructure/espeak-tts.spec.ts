import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { synthesizeWithEspeak } from './espeak-tts';

const hasEspeak = spawnSync('espeak-ng', ['--version'], { encoding: 'utf8' }).status === 0;

describe.skipIf(!hasEspeak)('synthesizeWithEspeak', () => {
  it('returns audio for a short English phrase', async () => {
    const result = await synthesizeWithEspeak({
      text: 'Hello, how can I help?',
      voiceGender: 'female',
      language: 'en',
    });
    expect(result.audioBuffer.length).toBeGreaterThan(100);
    expect(result.mimeType === 'audio/mpeg' || result.mimeType === 'audio/wav').toBe(true);
  });
});
