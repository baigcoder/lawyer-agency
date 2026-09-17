/**
 * Decoding bias for Whisper's `prompt` field.
 *
 * Whisper leans on this for spelling and for staying in-language on short,
 * noisy audio — which is what both a WhatsApp voice note and a telephony turn
 * are. It lives in the `voice` module because it belongs to speech recognition,
 * not to any one caller; `voice-calls` re-uses it for live turns.
 */
export type SttLanguage = 'ur' | 'en';

export const WHISPER_PROMPT: Record<SttLanguage, string> = {
  ur: 'یہ پاکستان میں ایک قانونی فرم کی واٹس ایپ کال ہے۔ بات چیت اردو میں ہے۔ عام الفاظ: وکیل، مقدمہ، عدالت، جائیداد، کرایہ دار، ضمانت، ایف آئی آر، وکالت نامہ، شناختی کارڈ، تاریخ، اپائنٹمنٹ، فیس۔',
  en: 'This is a WhatsApp message to a Pakistani law firm. Common words: lawyer, advocate, case, court, hearing, FIR, bail, vakalatnama, CNIC, property, tenant, deadline, appointment, fee.',
};
