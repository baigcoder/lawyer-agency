import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { ElevenLabsTtsClient, voiceRecommendedFor } from './elevenlabs-tts.client';
import { ttsModelPlan } from './elevenlabs-tts.request';
import { VoicePreviewService } from '../application/voice-preview.service';
import type { TextToSpeechPort } from '../application/text-to-speech.port';

const EN_FEMALE = 'EnglishFemaleVoice01';
const EN_MALE = 'EnglishMaleVoice0001';
const UR_FEMALE = 'UrduFemaleVoice00001';
const UR_MALE = 'UrduMaleVoice0000001';

function makeClient(): ElevenLabsTtsClient {
  const values: Record<string, string> = {
    ELEVENLABS_API_KEY: 'xi_test',
    ELEVENLABS_VOICE_ID_FEMALE: EN_FEMALE,
    ELEVENLABS_VOICE_ID_MALE: EN_MALE,
    ELEVENLABS_VOICE_ID_URDU_FEMALE: UR_FEMALE,
    ELEVENLABS_VOICE_ID_URDU_MALE: UR_MALE,
    ELEVENLABS_URDU_NOTE_MODEL: 'eleven_turbo_v2_5',
  };
  const config = { get: (key: string) => values[key] } as unknown as ConfigService<never, true>;
  return new ElevenLabsTtsClient(config);
}

/** Runs one synthesis against a stubbed ElevenLabs and returns the voice id in the URL. */
async function voiceUsed(input: Parameters<ElevenLabsTtsClient['synthesize']>[0]): Promise<string> {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    urls.push(url);
    return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(4) } as unknown as Response;
  }) as typeof globalThis.fetch;
  try {
    await makeClient().synthesize(input);
  } finally {
    globalThis.fetch = original;
  }
  return decodeURIComponent(/text-to-speech\/([^?]+)/.exec(urls[0] ?? '')?.[1] ?? '');
}

describe('voice per reply language', () => {
  const urdu = 'آپ کا مسئلہ سمجھ آ گیا۔';
  const english = 'I understand your matter.';
  const firmPicks = { voiceId: 'FirmEnglishPick00001', urduVoiceId: 'FirmUrduPick00000001' };

  it("speaks Urdu with the firm's Urdu pick, never its English one", async () => {
    // One voice used to serve both, so an English pick read Urdu script with
    // English phonetics.
    expect(await voiceUsed({ text: urdu, voiceGender: 'female', ...firmPicks })).toBe(firmPicks.urduVoiceId);
  });

  it("speaks English with the firm's English pick", async () => {
    expect(await voiceUsed({ text: english, voiceGender: 'female', ...firmPicks })).toBe(firmPicks.voiceId);
  });

  it('falls back to the Urdu default, not the English pick, when no Urdu voice is chosen', async () => {
    expect(await voiceUsed({ text: urdu, voiceGender: 'male', voiceId: firmPicks.voiceId })).toBe(UR_MALE);
    expect(await voiceUsed({ text: urdu, voiceGender: 'female' })).toBe(UR_FEMALE);
  });

  it('falls back to the English default for English', async () => {
    expect(await voiceUsed({ text: english, voiceGender: 'male', urduVoiceId: firmPicks.urduVoiceId })).toBe(EN_MALE);
  });

  it('ignores a malformed pick instead of 404ing through every model', async () => {
    expect(await voiceUsed({ text: urdu, voiceGender: 'female', urduVoiceId: 'bad/../id' })).toBe(UR_FEMALE);
  });

  it('reports the voice it used, so a preview can name it', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(4) }) as unknown as Response) as typeof globalThis.fetch;
    try {
      const result = await makeClient().synthesize({ text: urdu, voiceGender: 'female' });
      expect(result.voiceId).toBe(UR_FEMALE);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('voiceRecommendedFor', () => {
  it('offers Hindi-labelled voices for Urdu — ElevenLabs has no Urdu label', () => {
    expect(voiceRecommendedFor('hi', 'Anika – Empathetic Support')).toEqual(['ur']);
  });

  it('offers a voice named for Urdu for Urdu whatever its label', () => {
    expect(voiceRecommendedFor(undefined, 'Reva - Urdu (female)')).toEqual(['ur']);
  });

  it('offers English-labelled and unlabelled voices for English', () => {
    expect(voiceRecommendedFor('en', 'Sarah')).toEqual(['en']);
    expect(voiceRecommendedFor(undefined, 'Laura')).toEqual(['en']);
  });

  it('recommends a voice in another language for neither', () => {
    expect(voiceRecommendedFor('es', 'Lucia')).toEqual([]);
  });
});

describe('Urdu note model', () => {
  it('leads with turbo when configured, keeping v3 as the recovery', () => {
    expect(ttsModelPlan({ language: 'ur', liveCall: false, urduNoteModel: 'eleven_turbo_v2_5' })).toEqual([
      'eleven_turbo_v2_5',
      'eleven_v3',
    ]);
  });
});

describe('voice picker defaults', () => {
  const tts: TextToSpeechPort = {
    isConfigured: () => true,
    listVoices: vi.fn(async () => []),
    loadVoices: async () => ({
      complete: true,
      voices: [
        { id: UR_FEMALE, name: 'Anika', gender: 'female', accent: 'Standard', language: 'hi', recommendedFor: ['ur'] },
        { id: EN_FEMALE, name: 'Sarah', gender: 'female', accent: 'American', language: 'en', recommendedFor: ['en'] },
      ],
    }),
    defaultVoices: () => ({ en: { female: EN_FEMALE, male: EN_MALE }, ur: { female: UR_FEMALE, male: UR_MALE } }),
    synthesize: vi.fn(async () => ({ audioBuffer: Buffer.from('a'), mimeType: 'audio/mpeg', charactersUsed: 1, model: 'm', voiceId: UR_FEMALE })),
  };

  it('names the voice a reply really falls back to, per language', async () => {
    // "Default" used to be labelled — and previewed — as the first voice of
    // that gender in the list, not the one clients heard.
    const listed = await new VoicePreviewService(tts).listVoices();
    expect(listed.defaults?.ur.female).toEqual({ id: UR_FEMALE, name: 'Anika' });
    expect(listed.defaults?.en.female).toEqual({ id: EN_FEMALE, name: 'Sarah' });
    // Not in the library: named by id rather than dropped.
    expect(listed.defaults?.ur.male).toEqual({ id: UR_MALE, name: UR_MALE });
  });

  it('previews the default with no voice id, the same way a reply picks it', async () => {
    const preview = await new VoicePreviewService(tts).preview({ language: 'ur', voiceGender: 'female', voiceId: '' });
    expect(tts.synthesize).toHaveBeenCalledWith(expect.objectContaining({ urduVoiceId: undefined, language: 'ur' }));
    expect(preview.voiceId).toBe(UR_FEMALE);
  });
});
