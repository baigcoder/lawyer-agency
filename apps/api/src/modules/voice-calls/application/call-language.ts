/**
 * Per-call language resolution and the spoken literals that go with it.
 *
 * Before this existed the receptionist decided its STT language from
 * `session.transcript.at(-1)`, which at flush time is the *assistant's* own
 * last line — English — and is `undefined` on the caller's first utterance.
 * Under the default `mirror` policy that resolved to 'en' on turn one and then
 * never recovered, so an Urdu caller was transcribed as English for the whole
 * call. Language is now decided once per call and carried on the session.
 */

import type { AiSettings } from '../../firm-profile/application/ai-settings.dto';
import { urduClockTime, urduNumberWords } from '../../voice/application/urdu-speech';

export type CallLanguage = 'ur' | 'en';

const ARABIC_SCRIPT = /[؀-ۿ]/;

/** Whisper/ElevenLabs language codes that mean "this caller is speaking Urdu". */
const URDU_ADJACENT = new Set(['ur', 'urd', 'hi', 'hin', 'pa', 'pan', 'fa', 'fas', 'per']);

/**
 * Pakistan is the only market (D-001), so slot times are spoken in PKT unless a
 * caller-specific zone is threaded through later.
 */
export const CALL_TIME_ZONE = 'Asia/Karachi';

/**
 * Opening language for a call, plus whether that choice is final.
 *
 * `mirror` starts unlocked: the first caller utterance is transcribed with
 * auto-detect and the result locks the call. An explicit firm policy is locked
 * immediately — there is nothing to detect.
 */
export function initialCallLanguage(policy: AiSettings['aiLanguagePolicy']): {
  language: CallLanguage;
  locked: boolean;
} {
  if (policy === 'english_only') return { language: 'en', locked: true };
  if (policy === 'urdu_preferred') return { language: 'ur', locked: true };
  // Urdu is the safer opening for a Pakistani firm on `mirror`: a caller who
  // speaks English is understood by an Urdu greeting, and the detector will
  // switch the call to English on the first utterance anyway.
  return { language: 'ur', locked: false };
}

/**
 * Locks a `mirror` call from the first transcription. Whisper's own language
 * field is the primary signal — it is returned by the STT port and was
 * previously discarded — with an Arabic-script check as the tiebreaker for
 * providers that report nothing.
 */
export function detectCallLanguage(text: string, reported: string | null): CallLanguage {
  const code = (reported ?? '').trim().toLowerCase().split(/[-_]/)[0];
  if (code && URDU_ADJACENT.has(code)) return 'ur';
  if (code === 'en' || code === 'eng') {
    // Whisper sometimes reports `en` for Roman-Urdu ("mujhe madad chahiye").
    return isRomanUrdu(text) ? 'ur' : 'en';
  }
  if (ARABIC_SCRIPT.test(text)) return 'ur';
  return isRomanUrdu(text) ? 'ur' : 'en';
}

/**
 * Roman Urdu detector for the common case where the caller speaks Urdu but the
 * provider transliterates it into Latin script.
 */
export function isRomanUrdu(text: string): boolean {
  const lower = text.toLowerCase();
  const markers = [
    'mujhe', 'mujhay', 'aap', 'aap ka', 'apna', 'kya', 'kia', 'nahi', 'nahin',
    'hai', 'hain', 'karna', 'karni', 'chahiye', 'chahye', 'madad', 'mera',
    'meri', 'kaise', 'kaisay', 'kitna', 'kitni', 'sahab', 'bhai', 'baat',
    'masla', 'masla hai', 'zameen', 'jaidad', 'muqadma', 'adalat', 'wakeel',
    'salam', 'assalam', 'shukriya', 'theek', 'acha', 'phir', 'wapas',
  ];
  const hits = markers.filter((marker) => new RegExp(`\\b${marker}\\b`).test(lower)).length;
  return hits >= 2;
}

/**
 * Domain bias for Whisper's `prompt` field, shared with WhatsApp voice notes —
 * both are short, noisy audio about the same legal vocabulary.
 */
export { WHISPER_PROMPT } from '../../voice/application/stt-prompt';

/** Speaks a slot time as a human would say it, never as an ISO timestamp. */
export function spokenTime(at: Date, language: CallLanguage): string {
  try {
    if (language === 'ur') return spokenUrduDateTime(at);
    return new Intl.DateTimeFormat('en-PK', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: CALL_TIME_ZONE,
    }).format(at);
  } catch {
    return at.toISOString();
  }
}

const URDU_WEEKDAYS = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
const URDU_MONTHS = [
  'جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون',
  'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر',
];

/**
 * Urdu date and time in words.
 *
 * `Intl.DateTimeFormat('ur-PK')` returns "جمعرات، 20 اگست کو 4:30 PM" — Latin
 * digits and a literal "PM" inside an Urdu sentence, which the voice cannot
 * pronounce. Everything here is spoken words.
 */
export function spokenUrduDateTime(at: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
    timeZone: CALL_TIME_ZONE,
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const day = Number(get('day'));
  const monthIndex = Number(get('month')) - 1;
  // `hour12: false` renders midnight as 24 in some ICU versions.
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));

  const weekday = URDU_WEEKDAYS[weekdayIndex] ?? '';
  const month = URDU_MONTHS[monthIndex] ?? '';
  return `${weekday}، ${urduNumberWords(day)} ${month}، ${urduClockTime(hour, minute)}`;
}

/**
 * Everything the receptionist says outside the LLM turn. These were English
 * string literals inline, so an Urdu call heard English for escalation, slot
 * offers, booking confirmation, and the call-limit sign-off.
 */
export const CALL_LINES = {
  escalating: {
    ur: 'میں یہ معاملہ ابھی وکیل کو دے رہا/رہی ہوں۔ آگے وکیل صاحب خود آپ سے بات کریں گے۔ اپنا خیال رکھیں۔',
    en: 'I am connecting you with a lawyer on this. A lawyer will take it from here. Please stay safe.',
  },
  callLimit: {
    ur: 'مجھے یہ کال اب ختم کرنی ہے۔ براہِ کرم واٹس ایپ پر بات جاری رکھیں۔',
    en: 'I need to end this call now. Please continue on WhatsApp.',
  },
  noSlotToBook: {
    ur: 'ابھی میرے پاس بک کرنے کے لیے کوئی وقت موجود نہیں۔ کیا میں دستیابی دیکھ لوں؟',
    en: 'I do not have an open slot to book yet. Would you like me to check availability?',
  },
  noSlotsThisWeek: {
    ur: 'اس ہفتے کوئی وقت خالی نہیں دکھ رہا۔ وکیل صاحب واٹس ایپ پر وقت تجویز کر دیں گے۔',
    en: 'I do not see an open slot this week. A lawyer can propose a time on WhatsApp.',
  },
  sayOneTwoThree: {
    ur: 'ایک، دو، یا تین کہیں۔',
    en: 'Say 1, 2, or 3.',
  },
  checkingDiary: {
    ur: 'میں ڈائری دیکھ لیتا/لیتی ہوں۔',
    en: 'Let me check the diary.',
  },
  bookingThatSlot: {
    ur: 'میں وہی وقت بک کر دیتا/دیتی ہوں۔',
    en: 'I will book that slot.',
  },
  checkingKb: {
    ur: 'میں فرم کی معلومات دیکھ لیتا/لیتی ہوں۔',
    en: 'I will check the firm knowledge base.',
  },
  lawyerWillTake: {
    ur: 'میں یہ معاملہ وکیل کو دے دیتا/دیتی ہوں۔',
    en: 'I will have a lawyer take this.',
  },
  tellMeBriefly: {
    ur: 'مختصراً بتائیے کیا ہوا، اور کیا معاملہ فوری ہے؟',
    en: 'Please tell me briefly what happened and whether this is urgent.',
  },
  noAnswerOnFile: {
    ur: 'یہ جواب میرے پاس موجود نہیں ہے۔',
    en: 'I could not find that answer on file.',
  },
} as const;

export function line(key: keyof typeof CALL_LINES, language: CallLanguage): string {
  return CALL_LINES[key][language];
}

/** Spoken slot offer, e.g. "…: 1) جمعرات، 20 اگست، 4:30 PM؛ 2) …". */
export function spokenSlotOffer(
  lawyerName: string,
  slots: ReadonlyArray<{ startsAt: Date }>,
  language: CallLanguage,
): string {
  const listed = slots
    .map((slot, index) => `${index + 1}) ${spokenTime(slot.startsAt, language)}`)
    .join(language === 'ur' ? '، ' : '; ');
  return language === 'ur'
    ? `${lawyerName} کے ساتھ خالی اوقات: ${listed}۔ ${CALL_LINES.sayOneTwoThree.ur}`
    : `Open slots with ${lawyerName}: ${listed}. ${CALL_LINES.sayOneTwoThree.en}`;
}

export function spokenBookingConfirmation(
  lawyerName: string,
  startsAt: Date,
  language: CallLanguage,
): string {
  return language === 'ur'
    ? `${lawyerName} کے ساتھ ${spokenTime(startsAt, 'ur')} کا وقت بک ہو گیا۔ تصدیق واٹس ایپ پر بھیج دی جائے گی۔`
    : `Booked with ${lawyerName} at ${spokenTime(startsAt, 'en')}. A WhatsApp confirmation is on its way.`;
}

/**
 * Language instruction for the receptionist LLM. Without this the prompt was
 * entirely English, so the model answered in English even to an Urdu caller —
 * and Roman Urdu is worse than either, because the Urdu TTS voice pronounces
 * Latin letters with English phonetics.
 */
export function languageInstruction(
  language: CallLanguage,
  voiceGender: 'male' | 'female' = 'female',
): string {
  if (language !== 'ur') return 'Reply only in English, in short spoken sentences.';
  return [
    'Reply ONLY in Urdu, written in Urdu (Arabic) script.',
    'Never reply in Roman Urdu or English — your text is spoken aloud by an Urdu voice, and Latin script is mispronounced.',
    // Urdu verbs agree with the speaker's gender, and the caller hears the
    // voice — a female voice saying "کر سکتا ہوں" is instantly not a person.
    voiceGender === 'male'
      ? 'Speak about yourself in the masculine form (کر سکتا ہوں، کروں گا).'
      : 'Speak about yourself in the feminine form (کر سکتی ہوں، کروں گی).',
    'Say numbers, dates and times as words, never as digits or a timestamp.',
    'Keep sentences short and plain; this is spoken, not written.',
  ].join('\n');
}
