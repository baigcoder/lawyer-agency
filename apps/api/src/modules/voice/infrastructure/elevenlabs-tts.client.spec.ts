import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ElevenLabsTtsClient, URDU_DEFAULT_VOICE_FEMALE } from './elevenlabs-tts.client';

interface Attempt {
  url: string;
  model: string;
  hasVoiceSettings: boolean;
}

/** Replies to each TTS POST from a scripted list of statuses. */
function stubFetch(statuses: Array<number | 'network-error'>) {
  const attempts: Attempt[] = [];
  const original = globalThis.fetch;
  let index = 0;

  globalThis.fetch = (async (url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { model_id: string; voice_settings?: unknown };
    attempts.push({
      url,
      model: body.model_id,
      hasVoiceSettings: body.voice_settings !== undefined,
    });
    const outcome = statuses[index++] ?? 200;
    if (outcome === 'network-error') throw new Error('socket hang up');
    if (outcome === 200) {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      } as unknown as Response;
    }
    return {
      ok: false,
      status: outcome,
      headers: new Headers(),
      text: async () => `error ${outcome}`,
    } as unknown as Response;
  }) as typeof globalThis.fetch;

  return { attempts, restore: () => { globalThis.fetch = original; } };
}

function makeClient(): ElevenLabsTtsClient {
  const config = {
    get: (key: string) => (key === 'ELEVENLABS_API_KEY' ? 'xi-test' : undefined),
  } as unknown as ConfigService<never, true>;
  return new ElevenLabsTtsClient(config);
}

const note = { text: 'Your hearing is on Monday.', voiceGender: 'female' as const, language: 'en' as const };

describe('ElevenLabsTtsClient fallback chain', () => {
  it('returns the audio on a first-attempt success', async () => {
    const stub = stubFetch([200]);
    try {
      const result = await makeClient().synthesize(note);
      expect(result.mimeType).toBe('audio/mpeg');
      expect(stub.attempts).toHaveLength(1);
    } finally {
      stub.restore();
    }
  });

  it('retries the SAME model after a 429 instead of switching', async () => {
    const stub = stubFetch([429, 200]);
    try {
      await makeClient().synthesize(note);
      expect(stub.attempts).toHaveLength(2);
      // Switching models cannot clear a concurrency limit.
      expect(stub.attempts[0]?.model).toBe(stub.attempts[1]?.model);
    } finally {
      stub.restore();
    }
  });

  it('moves to the next model when this one rejects the request', async () => {
    const stub = stubFetch([400, 200]);
    try {
      await makeClient().synthesize(note);
      expect(stub.attempts[0]?.model).not.toBe(stub.attempts[1]?.model);
    } finally {
      stub.restore();
    }
  });

  it('survives a dropped socket instead of failing the whole synthesis', async () => {
    const stub = stubFetch(['network-error', 200]);
    try {
      const result = await makeClient().synthesize(note);
      expect(result.audioBuffer.length).toBe(3);
    } finally {
      stub.restore();
    }
  });

  it('keeps the tuned voice settings on every fallback attempt', async () => {
    const stub = stubFetch([400, 400, 200]);
    try {
      await makeClient().synthesize(note);
      // The old English fallback sent text + model only, reverting the slower
      // speaking rate the firm had tuned.
      expect(stub.attempts.every((a) => a.hasVoiceSettings)).toBe(true);
    } finally {
      stub.restore();
    }
  });

  it('stops immediately on a bad API key rather than burning the chain', async () => {
    const stub = stubFetch([401, 200, 200]);
    try {
      // Falls through to espeak, which is unavailable in this environment;
      // what matters is that only one ElevenLabs request was spent.
      await makeClient().synthesize(note).catch(() => undefined);
      expect(stub.attempts).toHaveLength(1);
    } finally {
      stub.restore();
    }
  });

  it('falls back to a curated voice when the tenant stored a malformed id', async () => {
    const stub = stubFetch([200]);
    try {
      await makeClient().synthesize({
        text: 'مقدمے کی تاریخ پیر کو ہے۔',
        voiceGender: 'female',
        language: 'ur',
        voiceId: '../../v1/user',
      });
      expect(stub.attempts[0]?.url).toContain(URDU_DEFAULT_VOICE_FEMALE);
      expect(stub.attempts[0]?.url).not.toContain('..');
    } finally {
      stub.restore();
    }
  });

  it('reports the characters ElevenLabs actually bills, not the raw input', async () => {
    const stub = stubFetch([200]);
    try {
      // Markdown and the URL are stripped before synthesis, so the raw length
      // overstated what was charged.
      const raw = '**Please** read https://example.com/very/long/path before Monday.';
      const result = await makeClient().synthesize({ ...note, text: raw });
      expect(result.charactersUsed).toBeLessThan(raw.length);
    } finally {
      stub.restore();
    }
  });
});
