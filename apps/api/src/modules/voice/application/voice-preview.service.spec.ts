import { describe, expect, it, vi } from 'vitest';
import { VoicePreviewService } from './voice-preview.service';
import type { TextToSpeechPort } from './text-to-speech.port';

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

  it('returns base64 audio for a preview', async () => {
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
    const preview = await service.preview({ voiceId: 'v1', language: 'ur' });
    expect(preview.mimeType).toBe('audio/mpeg');
    expect(preview.audioBase64).toBe(Buffer.from('abc').toString('base64'));
    expect(tts.synthesize).toHaveBeenCalledWith(
      expect.objectContaining({ voiceId: 'v1', language: 'ur' }),
    );
  });
});
