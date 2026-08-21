import { describe, expect, it } from 'vitest';
import { parseAiSettings } from '../../firm-profile/application/ai-settings.dto';
import { shouldUseVoiceReply, spokenLanguage } from './voice-reply.service';

describe('voice reply policy', () => {
  const base = parseAiSettings({
    aiVoiceEnabled: true,
    aiVoiceReplyMode: 'auto',
  });

  it('in auto mode replies with voice only when the client sent a voice note', () => {
    expect(shouldUseVoiceReply(base, 'AUDIO')).toBe(true);
    expect(shouldUseVoiceReply(base, 'TEXT')).toBe(false);
    expect(shouldUseVoiceReply({ ...base, aiVoiceReplyMode: 'voice_only' }, 'TEXT')).toBe(true);
  });

  it('never uses voice when disabled or text_only', () => {
    expect(shouldUseVoiceReply({ ...base, aiVoiceEnabled: false })).toBe(false);
    expect(shouldUseVoiceReply({ ...base, aiVoiceReplyMode: 'text_only' })).toBe(false);
  });

  it('speaks Urdu when the reply language or script is Urdu', () => {
    expect(spokenLanguage('UR', 'hello')).toBe('ur');
    expect(spokenLanguage('EN', 'السلام علیکم')).toBe('ur');
    expect(spokenLanguage('EN', 'How can I help?')).toBe('en');
  });
});
