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
