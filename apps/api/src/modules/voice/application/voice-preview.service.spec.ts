import { describe, expect, it, vi } from 'vitest';
import { buildVoicePreviewText, VoicePreviewService } from './voice-preview.service';
import type { TextToSpeechPort } from './text-to-speech.port';

describe('buildVoicePreviewText', () => {
  it('uses the firm name and stays spoken-safe', () => {
    const en = buildVoicePreviewText({ language: 'en', tone: 'friendly', displayName: 'Talha Law' });
    expect(en).toContain('Talha Law');
    expect(en).not.toMatch(/\/|—|--/);
    const ur = buildVoicePreviewText({ language: 'ur', tone: 'concise', displayName: 'طلہ لاء' });
    expect(ur).toContain('طلہ لاء');
  });

  it('varies copy by tone', () => {
    const formal = buildVoicePreviewText({ language: 'en', tone: 'formal', displayName: 'ABC' });
    const concise = buildVoicePreviewText({ language: 'en', tone: 'concise', displayName: 'ABC' });
    expect(formal).toContain('Please tell me');
    expect(concise.length).toBeLessThan(formal.length);
  });
});

describe('VoicePreviewService', () => {
  it('lists voices and reports whether ElevenLabs is configured', async () => {
    const tts: TextToSpeechPort = {
      isConfigured: () => true,
      listVoices: vi.fn(async () => [{ id: 'v1', name: 'Sarah', gender: 'female', accent: 'American' }]),
      synthesize: vi.fn(),
    };
    const service = new VoicePreviewService(tts);
    const listed = await service.listVoices();
    expect(listed.configured).toBe(true);
    expect(listed.voices[0]?.name).toBe('Sarah');
  });

  it('returns base64 audio and passes gender to TTS', async () => {
    const tts: TextToSpeechPort = {
      isConfigured: () => true,
      listVoices: vi.fn(async () => []),
      synthesize: vi.fn(async () => ({
        audioBuffer: Buffer.from('abc'),
        mimeType: 'audio/mpeg',
        charactersUsed: 12,
      })),
    };
    const service = new VoicePreviewService(tts);
    const preview = await service.preview({
      voiceId: 'v1',
      language: 'ur',
      voiceGender: 'male',
      tone: 'friendly',
      displayName: 'Talha',
    });
    expect(preview.mimeType).toBe('audio/mpeg');
    expect(preview.audioBase64).toBe(Buffer.from('abc').toString('base64'));
    expect(tts.synthesize).toHaveBeenCalledWith(
      expect.objectContaining({
        voiceId: 'v1',
        language: 'ur',
        voiceGender: 'male',
        text: expect.stringContaining('Talha'),
      }),
    );
  });
});
