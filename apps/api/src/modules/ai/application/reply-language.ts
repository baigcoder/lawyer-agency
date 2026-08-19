import type { Language } from '../domain/types';
import type { AiSettings } from '../../firm-profile/application/ai-settings.dto';

/**
 * Applies the firm's reply-language policy (D-004 default: mirror the client).
 */
export function applyReplyLanguagePolicy(detected: Language, settings: AiSettings): Language {
  if (settings.aiLanguagePolicy === 'english_only' || !settings.aiUrduReplyEnabled) {
    return detected === 'UR' ? 'EN' : detected === 'UNKNOWN' ? 'EN' : detected;
  }
  if (settings.aiLanguagePolicy === 'urdu_preferred') {
    if (detected === 'UR') return 'UR';
    if (detected === 'EN') return 'EN';
    return 'UR';
  }
  return detected === 'UNKNOWN' ? 'EN' : detected;
}
