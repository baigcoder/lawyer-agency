/**
 * Which script a reply is written in.
 *
 * `Language` only distinguishes EN / UR / UNKNOWN, so Roman Urdu — a client
 * writing Urdu in Latin letters — is carried as `UR`. That is fine for the
 * agents, which mirror whatever script the client used, but any *fixed* string
 * the orchestrator prepends has to make the same choice or the client gets two
 * scripts in one message:
 *
 *   میں Development Firm کا اسسٹنٹ ہوں، وکیل نہیں۔ …
 *   Wa alaikum assalam, aapki behn ka khula ka case samajh gaya. …
 */
export type ReplyScript = 'latin' | 'urdu';

/**
 * Decides from the reply the agent actually produced, which already mirrors the
 * client. A short string is treated as Urdu script when `UR`: too few letters
 * to judge, and Urdu script is the safer default for a Pakistani client.
 */
export function replyScript(text: string): ReplyScript {
  const letters = text.replace(/[^A-Za-z؀-ۿ]/g, '');
  if (letters.length < 8) return 'urdu';
  const latin = (letters.match(/[A-Za-z]/g) ?? []).length;
  return latin / letters.length > 0.7 ? 'latin' : 'urdu';
}

export function isRomanUrduReply(language: string, text: string): boolean {
  return language === 'UR' && replyScript(text) === 'latin';
}

/** Whether the client typed in Latin letters. Decided by majority, so an
 * Urdu-script message that quotes "CNIC" or "FIR" still counts as Urdu. */
export function clientWritesLatin(text: string): boolean {
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  const urdu = (text.match(/[؀-ۿ]/g) ?? []).length;
  return latin > urdu;
}

/**
 * What the prompt's `{{language}}` should say.
 *
 * It used to render the raw code, so a client writing Roman Urdu produced a
 * prompt that read "Reply in UR." — and UR reads as Urdu script. Measured on
 * four Roman Urdu messages, only two replies came back in Roman Urdu: one was
 * entirely Urdu script, one switched script mid-sentence. The model was doing
 * what the prompt said.
 *
 * A spoken reply is always Urdu script whatever the client typed: the Urdu
 * voice reads Latin letters with English phonetics.
 */
export function replyLanguageLabel(language: string, clientText: string, spoken: boolean): string {
  // The examples agree with "masla", not with the speaker, so they stay neutral
  // for a male or female voice — gender is urduGenderInstruction's job.
  if (language !== 'UR') return 'English';
  if (!spoken && clientWritesLatin(clientText)) {
    return 'Roman Urdu — Urdu written in English letters, like "aap ka masla samajh aa gaya". Do not switch to Urdu script at any point';
  }
  return 'Urdu, in Urdu script, like "آپ کا مسئلہ سمجھ آ گیا". Do not switch to Roman Urdu at any point';
}
