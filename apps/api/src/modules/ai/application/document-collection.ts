import type { Language } from '../domain/types';

export function isDocumentAsk(text: string): boolean {
  return /\b(i will send (the )?documents?|i('ll| will) send (my )?(cnic|documents?|papers)|send(ing)? (you )?(my )?(cnic|documents?|papers)|kya documents( chahiye)?|documents? chahiye|document request|please send (the )?(file|papers|cnic)|cnic (copy|photo|pic)|میں دستاویز|کاغذات (بھیج|چاہیئے)|شناختی کارڈ)\b/i.test(
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
