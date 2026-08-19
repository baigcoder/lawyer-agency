import { describe, expect, it } from 'vitest';
import { applyReplyLanguagePolicy } from './reply-language';
import { defaultAiSettings } from '../../firm-profile/application/ai-settings.dto';

describe('applyReplyLanguagePolicy', () => {
  it('mirrors the client language by default', () => {
    const settings = defaultAiSettings();
    expect(applyReplyLanguagePolicy('UR', settings)).toBe('UR');
    expect(applyReplyLanguagePolicy('EN', settings)).toBe('EN');
  });

  it('forces English when Urdu replies are disabled', () => {
    const settings = { ...defaultAiSettings(), aiUrduReplyEnabled: false };
    expect(applyReplyLanguagePolicy('UR', settings)).toBe('EN');
  });

  it('forces English under english_only even if Urdu is enabled', () => {
    const settings = { ...defaultAiSettings(), aiLanguagePolicy: 'english_only' as const };
    expect(applyReplyLanguagePolicy('UR', settings)).toBe('EN');
  });

  it('keeps English when the client wrote English under urdu_preferred', () => {
    const settings = { ...defaultAiSettings(), aiLanguagePolicy: 'urdu_preferred' as const };
    expect(applyReplyLanguagePolicy('EN', settings)).toBe('EN');
    expect(applyReplyLanguagePolicy('UR', settings)).toBe('UR');
  });
});
