/**
 * Makes Urdu reply text say-able.
 *
 * An Urdu TTS voice is given Urdu script and reads it phonetically. Anything
 * left in Latin script — "CNIC", "WhatsApp", "9:00 AM", "25000" — is either
 * skipped, spelled out letter by letter, or read with English phonetics in the
 * middle of an Urdu sentence. Real firm replies are full of exactly those:
 * fees, hearing dates, office hours, document names.
 *
 * Everything here converts to Urdu words *before* the text reaches the voice.
 */

/** Urdu cardinals 0–99. Irregular throughout, so this is a table, not a rule. */
const ONES = [
  'صفر', 'ایک', 'دو', 'تین', 'چار', 'پانچ', 'چھ', 'سات', 'آٹھ', 'نو',
  'دس', 'گیارہ', 'بارہ', 'تیرہ', 'چودہ', 'پندرہ', 'سولہ', 'سترہ', 'اٹھارہ', 'انیس',
  'بیس', 'اکیس', 'بائیس', 'تیئیس', 'چوبیس', 'پچیس', 'چھببیس', 'ستائیس', 'اٹھائیس', 'انتیس',
  'تیس', 'اکتیس', 'بتیس', 'تینتیس', 'چونتیس', 'پینتیس', 'چھتیس', 'سینتیس', 'اڑتیس', 'انتالیس',
  'چالیس', 'اکتالیس', 'بیالیس', 'تینتالیس', 'چوالیس', 'پینتالیس', 'چھیالیس', 'سینتالیس', 'اڑتالیس', 'انچاس',
  'پچاس', 'اکاون', 'باون', 'ترپن', 'چون', 'پچپن', 'چھپن', 'ستاون', 'اٹھاون', 'انسٹھ',
  'ساٹھ', 'اکسٹھ', 'باسٹھ', 'تریسٹھ', 'چونسٹھ', 'پینسٹھ', 'چھیاسٹھ', 'سڑسٹھ', 'اڑسٹھ', 'انہتر',
  'ستر', 'اکہتر', 'بہتر', 'تہتر', 'چوہتر', 'پچھتر', 'چھہتر', 'ستتر', 'اٹھہتر', 'اناسی',
  'اسی', 'اکیاسی', 'بیاسی', 'تراسی', 'چوراسی', 'پچاسی', 'چھیاسی', 'ستاسی', 'اٹھاسی', 'نواسی',
  'نوے', 'اکیانوے', 'بانوے', 'ترانوے', 'چورانوے', 'پچانوے', 'چھیانوے', 'ستانوے', 'اٹھانوے', 'ننانوے',
];

/** South Asian scale: hundred, thousand, then lakh and crore — not millions. */
const SCALES: Array<{ value: number; word: string }> = [
  { value: 10_000_000, word: 'کروڑ' },
  { value: 100_000, word: 'لاکھ' },
  { value: 1_000, word: 'ہزار' },
  { value: 100, word: 'سو' },
];

/** Spells a whole number in Urdu words, e.g. 25000 → "پچیس ہزار". */
export function urduNumberWords(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (value < 0) return `منفی ${urduNumberWords(-value)}`;
  const n = Math.round(value);
  if (n < 100) return ONES[n] ?? String(n);

  for (const { value: scale, word } of SCALES) {
    if (n >= scale) {
      const count = Math.floor(n / scale);
      const rest = n % scale;
      const head = `${urduNumberWords(count)} ${word}`;
      return rest === 0 ? head : `${head} ${urduNumberWords(rest)}`;
    }
  }
  return String(n);
}

/**
 * Digit strings that should stay digit-by-digit rather than become a cardinal:
 * phone numbers, CNIC numbers and case numbers are read out as digits by a
 * person too. "ایک ارب…" for a phone number would be nonsense.
 */
export function urduDigitSequence(digits: string): string {
  return digits
    .split('')
    .map((d) => ONES[Number(d)] ?? d)
    .join(' ');
}

/** Part of day for a 24-hour hour value, the way a Pakistani would say it. */
function dayPart(hour24: number): string {
  if (hour24 < 4) return 'رات';
  if (hour24 < 12) return 'صبح';
  if (hour24 < 15) return 'دوپہر';
  if (hour24 < 19) return 'شام';
  return 'رات';
}

/**
 * Speaks a clock time the way Urdu actually does it: quarters and halves get
 * their own words (سوا / ساڑھے / پونے) rather than "four thirty".
 */
export function urduClockTime(hour24: number, minute: number): string {
  const part = dayPart(hour24);
  const h12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const nextH12 = (hour24 + 1) % 12 === 0 ? 12 : (hour24 + 1) % 12;
  const hourWord = ONES[h12] ?? String(h12);
  const nextHourWord = ONES[nextH12] ?? String(nextH12);

  if (minute === 0) return `${part} ${hourWord} بجے`;
  if (minute === 15) return `${part} سوا ${hourWord} بجے`;
  if (minute === 30) return `${part} ساڑھے ${hourWord} بجے`;
  if (minute === 45) return `${part} پونے ${nextHourWord} بجے`;
  return `${part} ${hourWord} بج کر ${urduNumberWords(minute)} منٹ`;
}

/**
 * English words and abbreviations that show up constantly in a Pakistani legal
 * chat. Written in Urdu script they are pronounced correctly; left in Latin
 * they are mangled. Keys are matched case-insensitively on word boundaries.
 */
const TERMS: Record<string, string> = {
  cnic: 'شناختی کارڈ',
  nic: 'شناختی کارڈ',
  fir: 'ایف آئی آر',
  whatsapp: 'واٹس ایپ',
  pdf: 'پی ڈی ایف',
  sms: 'ایس ایم ایس',
  email: 'ای میل',
  'e-mail': 'ای میل',
  online: 'آن لائن',
  office: 'دفتر',
  court: 'عدالت',
  lawyer: 'وکیل',
  advocate: 'وکیل',
  case: 'مقدمہ',
  file: 'فائل',
  form: 'فارم',
  address: 'پتہ',
  appointment: 'اپائنٹمنٹ',
  consultation: 'مشاورت',
  fee: 'فیس',
  fees: 'فیس',
  document: 'دستاویز',
  documents: 'دستاویزات',
  passport: 'پاسپورٹ',
  visa: 'ویزا',
  bail: 'ضمانت',
  am: 'صبح',
  pm: 'شام',
  pkr: 'روپے',
  rs: 'روپے',
  nadra: 'نادرا',
  ok: 'ٹھیک ہے',
};

const ARABIC_SCRIPT = /[؀-ۿ]/;

export function hasUrduScript(text: string): boolean {
  return ARABIC_SCRIPT.test(text);
}

/**
 * Rewrites an Urdu reply into something an Urdu voice can pronounce.
 *
 * Only applied to text that is already mostly Urdu — an English reply must not
 * have its numbers turned into Urdu words.
 */
export function normalizeUrduForSpeech(text: string): string {
  if (!hasUrduScript(text)) return text;

  let out = text;

  // Times first: "9:00 AM" must become one phrase before the digits and the
  // "AM" are handled separately and end up as "نو صفر صفر صبح".
  out = out.replace(/\b(\d{1,2}):(\d{2})\s*(am|pm|AM|PM|a\.m\.|p\.m\.)?/g, (match, h, m, suffix) => {
    let hour = Number(h);
    const minute = Number(m);
    if (hour > 23 || minute > 59) return match;
    const marker = typeof suffix === 'string' ? suffix.toLowerCase().replace(/\./g, '') : '';
    if (marker === 'pm' && hour < 12) hour += 12;
    if (marker === 'am' && hour === 12) hour = 0;
    return urduClockTime(hour, minute);
  });

  // Long digit runs stay digit-by-digit: phone, CNIC, case numbers.
  out = out.replace(/\b\d{7,}\b/g, (digits) => urduDigitSequence(digits));

  // Grouped amounts: "25,000" → "پچیس ہزار".
  out = out.replace(/\b\d{1,3}(?:,\d{2,3})+\b/g, (grouped) =>
    urduNumberWords(Number(grouped.replace(/,/g, ''))),
  );

  // Remaining plain numbers: fees, dates, counts.
  out = out.replace(/\b\d+\b/g, (digits) => urduNumberWords(Number(digits)));

  // Latin terms → Urdu script. Longest first so "e-mail" beats "mail".
  for (const term of Object.keys(TERMS).sort((a, b) => b.length - a.length)) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{M}])${escapeRegExp(term)}(?![\\p{L}\\p{M}])`, 'giu');
    out = out.replace(pattern, TERMS[term] ?? term);
  }

  // Urdu sentences end with a danda and pause on an Urdu comma. Latin marks
  // inside Urdu text phrase badly.
  out = out.replace(/\.(\s|$)/g, '۔$1').replace(/,(\s|$)/g, '،$1');

  return out.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
