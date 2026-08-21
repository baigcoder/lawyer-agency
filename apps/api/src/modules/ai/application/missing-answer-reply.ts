import type { Language } from '../domain/types';

/**
 * Dead-end copy when the FAQ KB is empty. Clients hear this as
 * "mujhe sawal ka jawab nahi mil saka" — never send it.
 */
export function looksLikeMissingAnswer(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /جواب نہیں مل سک/.test(text) ||
    /جواب نہیں ملا/.test(text) ||
    /جواب نہیں دے سک/.test(text) ||
    /jawab nahi mil/.test(t) ||
    /jawab nahi de sak/.test(t) ||
    (/sawal ka jawab/.test(t) && /nahi/.test(t)) ||
    /could(?:n't| not) find (the )?(an )?answer/.test(t) ||
    /don['’]?t have (information on that|that detail|a (published )?firm answer)/.test(t) ||
    /do not have (that detail on file|a published firm answer|information on that)/.test(t)
  );
}

export function continueWithoutKb(language: Language, sampleText = ''): string {
  if (language === 'UR' && isMostlyLatin(sampleText)) {
    return 'Samajh gaya. Bataein aap ko kis masle mein madad chahiye, main note karke aage barhata hoon.';
  }
  if (language === 'UR') {
    return 'سمجھ گیا۔ بتائیں آپ کو کس معاملے میں مدد چاہیے، میں نوٹ کر کے آگے بڑھاتا ہوں۔';
  }
  return 'Got it. Tell me what you need help with and I’ll take it from there.';
}

export function rewriteMissingAnswerReply(text: string, language: Language): string {
  if (!looksLikeMissingAnswer(text)) return text;
  return continueWithoutKb(language, text);
}

function isMostlyLatin(text: string): boolean {
  const letters = text.replace(/[^A-Za-z\u0600-\u06FF]/g, '');
  if (letters.length < 8) return false;
  const latin = (letters.match(/[A-Za-z]/g) ?? []).length;
  return latin / letters.length > 0.7;
}
