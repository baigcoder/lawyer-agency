import type { Language } from '../domain/types';

/**
 * "Which documents do you need?" is a process question — the FAQ agent answers
 * it from the knowledge base. Treating it as a document *request* opened a case
 * and a PENDING document request for every client who merely asked.
 */
export function isDocumentQuestion(text: string): boolean {
  return /\b(kya|kaun\s?se|kon\s?se|which|what)\b[^?]{0,40}\b(documents?|papers|kaghzat)\b/i.test(text)
    || /\bdocuments?\s+(needed|required|chahiye|chahye)\b/i.test(text)
    || /کون\s?سے\s?(کاغذات|دستاویز)|کیا\s?(کاغذات|دستاویزات)\s?(چاہیئے|چاہیے|درکار)/.test(text);
}

/**
 * Urdu alternatives live outside the `\b…\b` group on purpose: JavaScript word
 * boundaries are ASCII-only, so `\bکاغذات\b` never matches and every Urdu
 * branch inside the Latin group was dead.
 */
const URDU_DOCUMENT_OFFER = /میں\s?(دستاویز|کاغذات)|(دستاویز|کاغذات)\s?بھیج|شناختی\s?کارڈ/;

/** The client is offering to send a file now — worth creating a request for. */
export function isDocumentAsk(text: string): boolean {
  if (isDocumentQuestion(text)) return false;
  if (URDU_DOCUMENT_OFFER.test(text)) return true;
  return /\b(i will send (the )?documents?|i('ll| will) send (my )?(cnic|documents?|papers)|send(ing)? (you )?(my )?(cnic|documents?|papers)|document request|please send (the )?(file|papers|cnic)|cnic (copy|photo|pic))\b/i.test(
    text,
  );
}

export function documentRequestDescription(clientText: string, language: Language): string {
  if (/\bcnic\b/i.test(clientText) || clientText.includes('شناختی')) return 'CNIC copy';
  if (/\bnikah\b/i.test(clientText)) return 'Nikah nama';
  if (/\bfir\b/i.test(clientText)) return 'FIR copy';
  if (language === 'UR') return 'CNIC copy and relevant case papers';
  return 'CNIC copy and relevant case papers';
}

export function formatDocumentAsk(language: Language, description: string): string {
  if (language === 'UR') {
    return `براہ کرم ${description} اس واٹس ایپ چیٹ پر تصویر یا پی ڈی ایف کے طور پر بھیج دیں۔`;
  }
  return `Please send ${description} as a photo or PDF on this WhatsApp chat.`;
}

export function formatDocumentCreateFailed(language: Language): string {
  if (language === 'UR') {
    return 'دستاویز کی درخواست نہیں بن سکی۔ وکیل جلد پیغام کرے گا۔';
  }
  return 'I could not create that document request. A lawyer will follow up shortly.';
}
