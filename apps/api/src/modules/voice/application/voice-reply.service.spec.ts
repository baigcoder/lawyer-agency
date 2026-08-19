import { describe, expect, it } from 'vitest';
import { parseAiSettings } from '../../firm-profile/application/ai-settings.dto';

function shouldUseVoice(
  settings: ReturnType<typeof parseAiSettings>,
  inboundContentType: string,
): boolean {
  if (!settings.aiVoiceEnabled) return false;
  if (settings.aiVoiceReplyMode === 'text_only') return false;
  if (settings.aiVoiceReplyMode === 'voice_only') return true;
  return inboundContentType === 'AUDIO';
}

describe('voice reply policy', () => {
  const base = parseAiSettings({
    aiVoiceEnabled: true,
    aiVoiceReplyMode: 'auto',
  });

  it('replies with voice when client sent audio in auto mode', () => {
    expect(shouldUseVoice(base, 'AUDIO')).toBe(true);
    expect(shouldUseVoice(base, 'TEXT')).toBe(false);
  });

  it('replies with voice for all messages in voice_only mode', () => {
    const settings = { ...base, aiVoiceReplyMode: 'voice_only' as const };
    expect(shouldUseVoice(settings, 'TEXT')).toBe(true);
  });

  it('never uses voice when disabled or text_only', () => {
    expect(shouldUseVoice({ ...base, aiVoiceEnabled: false }, 'AUDIO')).toBe(false);
    expect(shouldUseVoice({ ...base, aiVoiceReplyMode: 'text_only' }, 'AUDIO')).toBe(false);
  });
});
