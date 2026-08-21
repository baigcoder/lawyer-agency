import type { RetrievedChunk } from './retriever.port';

export const PAKISTAN_PROCESS_CATEGORY = 'pakistan-process';

export interface PakistanLawyerArticle {
  id: string;
  title: string;
  keywords: string[];
  content: string;
}

/**
 * General Pakistani legal-process orientation for every firm (T2).
 * Not legal advice, not a substitute for a licensed advocate, not firm policy.
 */
export const PAKISTAN_LAWYER_KNOWLEDGE: readonly PakistanLawyerArticle[] = [
  {
    id: 'pk-how-lawyers-work',
    title: 'How lawyers in Pakistan typically work with a new client',
    keywords: [
      'lawyer', 'advocate', 'vakil', 'wakeel', 'attorney', 'legal help', 'consultation',
      'وکیل', 'مشورہ', 'مشاورہ', 'qanoon', 'قانون', 'bar council', 'vakalatnama', 'وکالت نامہ',
      'case', 'کیس', 'masla', 'معاملہ', 'legal', 'madad', 'help with',
    ],
    content: `EN: In Pakistan, only an advocate enrolled with a Provincial Bar Council (and the Pakistan Bar Council) may appear in court. A first meeting is usually a consultation: the client explains facts, shows CNIC and papers, and says what they want (notice, settlement, court case, bail, etc.). To represent someone in court the lawyer generally needs a signed vakalatnama (power to appear). The receptionist can collect facts and documents and book a time; the owner/lawyer decides strategy. This is general process, not legal advice.

UR: پاکستان میں عدالت میں پیش ہونے کے لیے وکیل کا بار کونسل میں اندراج ضروری ہے۔ پہلی ملاقات میں عام طور پر سی این آئی سی، دستاویزات اور معاملے کی تفصیل لی جاتی ہے۔ عدالتی نمائندگی کے لیے وکالت نامہ دستخط ہوتا ہے۔ یہ عام عمل کی معلومات ہے، قانونی مشورہ نہیں۔`,
  },
  {
    id: 'pk-documents',
    title: 'Documents Pakistani clients are often asked to bring',
    keywords: [
      'document', 'documents', 'papers', 'cnic', 'id card', 'nadra', 'stamp paper',
      'دستاویز', 'کاغذات', 'شناختی کارڈ', 'فائل', 'copy', 'photocopy', 'agreement',
    ],
    content: `EN: Pakistani law firms commonly ask for: original CNIC (and copies), any court notice, FIR or police papers, contracts/agreements, property papers (registry, fard, mutation), nikahnama, previous orders, and WhatsApp/email proof if relevant. Bring copies; keep originals unless the lawyer asks. Missing papers is normal — the firm can list what is still needed. Do not invent which document “wins” a case.

UR: عام دستاویزات: شناختی کارڈ، عدالتی نوٹس، ایف آئی آر، معاہدے، ملکیتی کاغذات (رجسٹری، فرد، انتقال)، نکاح نامہ، پرانے احکامات۔ کاپیاں لائیں؛ اصل تب دیں جب وکیل کہے۔ یہ فہرست عام ہے، ہر کیس الگ ہوتا ہے۔`,
  },
  {
    id: 'pk-fir-bail-criminal',
    title: 'FIR, police, and bail — general process in Pakistan',
    keywords: [
      'fir', 'police', 'thana', 'chowki', 'arrest', 'arrested', 'giraftar', 'bail', 'zamanat',
      'criminal', 'sessions', 'ipc', 'ppc', 'murder', 'qatl', 'theft', 'dacoity', 'fraud',
      'ایف آئی آر', 'پولیس', 'تھانہ', 'گرفتار', 'ضمانت', 'قتل', 'چوری',
    ],
    content: `EN: A First Information Report (FIR) is a police record of a cognizable offence, usually at the local thana. After an FIR, investigation and possible arrest can follow. Bail is a court process (not a WhatsApp decision). If someone is in custody, just arrested, or there is violence/murder, the receptionist must not advise — note the facts, city, and police station if known, and send it to the owner immediately. Sessions Court commonly hears serious criminal trials; High Courts hear some bail/appeals. This is orientation only.

UR: ایف آئی آر پولیس کا اندراج ہے۔ گرفتاری یا ضمانت عدالت کا معاملہ ہے۔ اگر کوئی گرفتار ہے یا قتل/تشدد ہے تو مشورہ نہ دیں — فوراً مالک وکیل کو بھیجیں۔`,
  },
  {
    id: 'pk-family',
    title: 'Family matters in Pakistan (khula, divorce, maintenance, custody)',
    keywords: [
      'divorce', 'khula', 'talaq', 'nikah', 'nikahnama', 'maintenance', 'nafqa', 'custody',
      'guardian', 'family court', 'haq mehr', 'wife', 'husband', 'dowry', 'jahez',
      'طلاق', 'خلع', 'نکاح', 'نان نفقہ', 'حاضانت', 'بیوی', 'شوہر',
    ],
    content: `EN: Family disputes in Pakistan (khula, talaq, maintenance/nafqa, custody/guardianship, haq mehr, dower, domestic issues) are usually heard in Family Court. Typical papers: CNIC, nikahnama, children’s B-forms, proof of income or expenses, prior court orders. Outcomes depend on facts and the Family Courts Act process — never predict a result or tell someone to “file khula today.” Collect the story, children’s ages, city, and whether a case is already filed, then the lawyer reviews.

UR: خلع، طلاق، نان نفقہ، حاضانت عام طور پر فیملی کورٹ میں ہوتے ہیں۔ نکاح نامہ اور شناختی کارڈ اکثر درکار ہوتے ہیں۔ نتیجہ نہ بتائیں — تفصیل لے کر وکیل کے پاس بھیجیں۔`,
  },
  {
    id: 'pk-property-civil',
    title: 'Property and civil disputes in Pakistan',
    keywords: [
      'property', 'plot', 'house', 'land', 'registry', 'fard', 'mutation', 'intiqal', 'stay',
      'injunction', 'civil suit', 'possession', 'tenant', 'landlord', 'rent', 'agreement to sell',
      'جائیداد', 'زمین', 'رجسٹری', 'فرد', 'انتقال', 'کرائہ', 'مکاں',
    ],
    content: `EN: Property and contract disputes are usually civil matters: sale agreement, registry, fard (record of rights), mutation/intiqal, possession, rent, or a stay/injunction. Clients often bring the registry, fard, tax receipts, and notices. Civil cases can take time; limitation (deadlines) matter — do not guess a last date. Ask city, what paper they hold, and whether anyone is occupying the property. A lawyer reviews title and next step.

UR: جائیداد، رجسٹری، فرد، انتقال، قبضہ، کرائہ عام دیوانی معاملات ہیں۔ تاریخِ مدت اندازے سے نہ بتائیں۔ کاغذات اور شہر پوچھیں، وکیل جائزہ لے گا۔`,
  },
  {
    id: 'pk-courts',
    title: 'Courts in Pakistan (civil, family, sessions, High Court, Supreme Court)',
    keywords: [
      'court', 'adalat', 'high court', 'supreme court', 'sessions', 'civil judge', 'magistrate',
      'writ', 'appeal', 'petition', 'hearing', 'peshi', 'cause list',
      'عدالت', 'ہائی کورٹ', 'سپریم کورٹ', 'پیشی', 'اپیل',
    ],
    content: `EN: Rough map: Civil Judges / Senior Civil Judges hear many civil suits; Family Court hears family matters; Magistrates and Sessions Courts hear criminal matters; High Courts hear appeals, bail in some matters, and constitutional petitions; the Supreme Court is the apex court. “Which court” depends on the case type and value/offence — the lawyer decides. Hearings (peshi) are listed; missing a date can hurt. The receptionist can note the next date if the client has a slip, not advise adjournment strategy.

UR: دیوانی، فیملی، سیشنز، ہائی کورٹ، سپریم کورٹ الگ دائرے ہیں۔ کون سی عدالت وکیل بتائے گا۔ پیشی کی تاریخ نوٹ کر سکتے ہیں، حکمت عملی نہیں۔`,
  },
  {
    id: 'pk-fees',
    title: 'How Pakistani law firms usually charge',
    keywords: [
      'fee', 'fees', 'charges', 'kitni fee', 'consultation fee', 'professional fee', 'advance',
      'vakil ki fee', 'فیس', 'مشاورہ فیس', 'خرچہ', 'payment', 'jazzcash',
    ],
    content: `EN: Pakistani firms often separate (1) consultation fee for the first meeting from (2) professional fee for a case, notice, or bail, sometimes with an advance. Court fee, stamps, and miscellaneous expenses are usually extra. Amounts are set by this firm — never quote a market “standard” fee or promise a result for money. Share this firm’s published consultation fee and hours if available; otherwise collect the matter and let the owner confirm.

UR: مشاورہ فیس اور کیس کی پیشہ ورانہ فیس اکثر الگ ہوتی ہے۔ عدالتی خرچہ الگ ہو سکتا ہے۔ بازار کی فیس نہ بتائیں — اس دفتر کی فیس یا مالک کی تصدیق۔`,
  },
  {
    id: 'pk-cheque-labour-consumer',
    title: 'Cheque bounce, labour, tax, and consumer matters in Pakistan',
    keywords: [
      'cheque', 'check bounce', '138', 'negotiable', 'labour', 'salary', 'job', 'fired', 'termination',
      'consumer', 'warranty', 'company', 'nirc', 'tax', 'fbr', 'ntn', 'filer', 'income tax', 'sales tax',
      'چیک', 'تنخواہ', 'نوکری', 'صارف', 'ٹیکس',
    ],
    content: `EN: Dishonoured cheques are often discussed under the Negotiable Instruments framework; labour issues (salary, illegal termination) may go to labour forums / NIRC depending on the facts; tax/NTN/FBR filer questions are for a lawyer or tax practitioner to review returns and notices — the receptionist only notes the year, notice type, and city; consumer complaints may go to consumer courts. These are fact-heavy. Ask for copies and dates. Do not tell them they “will surely win” or which section to file.

UR: چیک باؤنس، تنخواہ/برطرفی، ٹیکس/ایف بی آر نوٹس، صارف شکایات الگ فورم پر جا سکتے ہیں۔ کاپی اور تاریخیں لیں، فتح کا وعدہ نہ کریں۔`,
  },
  {
    id: 'pk-succession-poa',
    title: 'Inheritance, succession, and power of attorney in Pakistan',
    keywords: [
      'inheritance', 'warasat', 'succession', 'heir', 'death certificate', 'letter of administration',
      'succession certificate', 'power of attorney', 'mukhtarnama', 'attorney',
      'وراثت', 'میراث', 'مختار نامہ', 'جانشینی',
    ],
    content: `EN: After a death, families often need a death certificate, heir details, and then a succession certificate or letter of administration for banks/property — process depends on movable vs immovable assets and whether there is a will. A power of attorney / mukhtarnama lets someone act for another (sometimes for overseas Pakistanis). Formalities (stamp, witnesses, attestation) matter; the lawyer checks what is valid. Collect who died, which assets, and who the heirs are — no share-splitting advice on WhatsApp.

UR: وراثت میں ڈیتھ سرٹیفکیٹ اور ورثاء کی تفصیل عام ہے۔ مختار نامہ دوسرے کو اختیار دیتا ہے۔ حصہ بندی یہاں نہ بتائیں۔`,
  },
  {
    id: 'pk-deadlines',
    title: 'Court dates and deadlines in Pakistan',
    keywords: [
      'deadline', 'limitation', 'last date', 'tomorrow court', 'hearing tomorrow', 'peshi kal',
      'time barred', 'limitation act', 'urgent', 'stay order',
      'مدت', 'آخری تاریخ', 'کل پیشی', 'فوری',
    ],
    content: `EN: Pakistani procedure has limitation periods and listed hearing dates. Missing a peshi or a filing deadline can seriously hurt a case. If the client says court is within 48 hours, treat it as urgent: take the date, court name, city, and case number if they have it, and send it to the owner. Never guess “you still have time.”

UR: پیشی یا قانونی مدت چھوٹنا نقصان دہ ہو سکتا ہے۔ 48 گھنٹے میں عدالت ہو تو فوری مالک کو بھیجیں — اندازہ نہ لگائیں کہ وقت باقی ہے۔`,
  },
  {
    id: 'pk-bail-stages',
    title: 'Bail stages in Pakistan (pre-arrest, post-arrest, anticipatory)',
    keywords: [
      'bail', 'zamanat', 'pre arrest', 'post arrest', 'anticipatory bail', '497', '498', 'adc',
      'surety', 'sureties', 'nazarband', 'judicial custody', 'physical remand',
      'ضمانت', 'پیشگی ضمانت', 'جسمانی ریمانڈ', 'عدالتی حراست', 'ضامن',
      'bail chahiye', 'zamanat chahiye', 'giraftari se pehle',
    ],
    content: `EN: Bail in Pakistan is a court order, not a police or WhatsApp decision. People often talk about pre-arrest (anticipatory) bail, post-arrest bail, sureties, and remand. Serious offences have stricter rules. The receptionist should note: who is at risk of arrest, FIR number if any, police station, city, and whether they are already in custody — then hand off to the lawyer. Never say “you will get bail” or which section to file.

UR: ضمانت عدالت دیتی ہے۔ گرفتاری سے پہلے یا بعد، ضامن، ریمانڈ — تفصیل نوٹ کر کے وکیل کو بھیجیں۔ ضمانت کا وعدہ نہ کریں۔`,
  },
  {
    id: 'pk-fir-vs-complaint',
    title: 'FIR versus private complaint in Pakistan',
    keywords: [
      'fir', 'complaint', 'private complaint', 'application', 'cognizable', 'non cognizable',
      'thana refuse', 'police refuse', 'section 22a', 'justice of peace',
      'ایف آئی آر', 'شکایت', 'تھانہ انکار', 'نوٹس', 'cognizable',
      'thana nahi likh raha', 'fir nahi ho rahi',
    ],
    content: `EN: An FIR records a cognizable offence at the thana. If police refuse, some matters go through other routes (for example applications before a Justice of Peace) — the correct path depends on facts. A “complaint” in ordinary language is not always the same as a criminal private complaint. Collect what happened, where, when, and any written refusal; do not tell them which form to file.

UR: ایف آئی آر تھانے پر ہوتی ہے۔ انکار ہو تو راستہ حقائق پر منحصر ہے — کون سی درخواست وکیل بتائے۔`,
  },
  {
    id: 'pk-family-timelines',
    title: 'Family case timelines in Pakistan (orientation only)',
    keywords: [
      'khula kitne din', 'divorce time', 'how long', 'family case delay', 'nafqa kitne',
      'maintenance amount', 'custody how long', 'iddat',
      'کتنے دن', 'کتنا وقت', 'خلع کب', 'نان نفقہ کتنا', 'عدت',
      'kitne mahine', 'jaldi faisla',
    ],
    content: `EN: Family matters (khula, maintenance, custody) have procedural steps and waiting periods in law, but real duration varies by city, court load, and whether parties settle. Never quote a fixed number of days for “khula finishes” or a rupee figure for maintenance. Ask for nikahnama, children’s ages, city, and whether a case is already filed; the lawyer gives timelines after review.

UR: خلع یا نان نفقہ کی مدت اور رقم کیس اور شہر پر منحصر ہے۔ مقررہ دن یا رقم نہ بتائیں — کاغذات لے کر وکیل بھیجیں۔`,
  },
  {
    id: 'pk-property-checklist',
    title: 'Property papers checklist for Pakistani clients',
    keywords: [
      'fard', 'registry', 'mutation', 'intiqal', 'allotment', 'noc', 'site plan', 'tokens',
      'bayana', 'agreement to sell', 'power of attorney sale', 'fraud plot', 'double sale',
      'فرد', 'رجسٹری', 'انتقال', 'بیعانہ', 'الاٹمنٹ', 'غلط پلاٹ',
      'property papers', 'plot papers',
    ],
    content: `EN: For land or house disputes, firms often ask for: CNIC, sale agreement / bayana, registry, fard, mutation/intiqal, tax receipts, allotment/NOC if society property, and photos of possession. Double sale and fake registry stories are common — do not decide title on WhatsApp. List what they have, city, and survey/plot number if known.

UR: جائیداد کے لیے فرد، رجسٹری، انتقال، بیعانہ، الاٹمنٹ عام کاغذات ہیں۔ ملکیت یہاں فیصلہ نہ کریں — فہرست بنا کر وکیل کو دیں۔`,
  },
  {
    id: 'pk-overseas-mukhtarnama',
    title: 'Overseas Pakistanis and mukhtarnama / power of attorney',
    keywords: [
      'overseas', 'abroad', 'dubai', 'saudi', 'uk', 'canada', 'embassy', 'attestation',
      'mukhtarnama', 'power of attorney', 'poa', 'consulate', 'nadra overseas',
      'بیرون ملک', 'مختار نامہ', 'سفارت خانہ', 'خارجہ', 'اتسٹیشن',
      'main bahar hun', 'dubai se', 'poa chahiye',
    ],
    content: `EN: Overseas Pakistanis often need a power of attorney / mukhtarnama so someone in Pakistan can sell property, appear, or collect documents. Embassy/consulate attestation and local formalities can matter. Collect: country of residence, what the attorney must do, and whose CNIC. The lawyer checks the correct form — do not draft POA wording on chat.

UR: بیرون ملک پاکستانی اکثر مختار نامہ بنواتے ہیں۔ ملک، کام، اور شناختی تفصیل لیں — مسودہ یہاں نہ لکھیں۔`,
  },
  {
    id: 'pk-cybercrime',
    title: 'Cybercrime and online harassment reporting in Pakistan',
    keywords: [
      'cyber', 'fia', 'harassment', 'blackmail', 'hacked', 'facebook', 'instagram', 'whatsapp threat',
      'revenge porn', 'defamation online', 'nr3c', 'peca',
      'سائبر', 'ایف آئی اے', 'بلیک میل', 'ہیک', 'آن لائن', 'ذلت',
      'account hack', 'photo leak',
    ],
    content: `EN: Online threats, hacking, blackmail, and non-consensual image sharing may involve FIA / cybercrime reporting and other laws. Preserve screenshots, URLs, and dates; do not delete evidence. If there is an immediate safety risk, escalate to the owner. Never tell them which PECA section applies.

UR: آن لائن بلیک میل یا ہیک میں اسکرین شاٹ محفوظ رکھیں۔ خطرہ ہو تو فوراً وکیل کو بھیجیں — دفعہ نہ بتائیں۔`,
  },
  {
    id: 'pk-ndps-drugs',
    title: 'Narcotics / NDPS matters — urgent handoff only',
    keywords: [
      'drugs', 'heroin', 'charas', 'cannabis', 'ndps', 'cns', 'narcotics', 'police raid',
      'نشہ', 'ہیروئن', 'چرس', 'منشیات', 'چھاپہ',
      'caught with drugs', 'narcotics case',
    ],
    content: `EN: Narcotics cases are serious criminal matters. The receptionist must not advise on quantities, bail chances, or what to tell police. Note city, custody status, and any FIR, then escalate to the owner immediately. Comfort briefly; no legal strategy on WhatsApp.

UR: منشیات کے کیس سنگین ہیں۔ مشورہ نہ دیں — شہر اور گرفتاری کی صورتحال نوٹ کر کے فوراً مالک کو بھیجیں۔`,
  },
  {
    id: 'pk-labour-consumer-forums',
    title: 'Labour and consumer forums in Pakistan',
    keywords: [
      'labour court', 'nirc', 'illegal termination', 'unpaid salary', 'eobi', 'social security',
      'consumer court', 'warranty', 'defective product', 'company refund',
      'لیبر', 'تنخواہ نہیں', 'برطرفی', 'صارف عدالت', 'وارنٹی',
      'salary nahi mili', 'job se nikal diya',
    ],
    content: `EN: Unpaid wages or illegal termination may go to labour forums / NIRC depending on the employer and facts. Defective goods or services may go to consumer courts. Ask for appointment letter, salary slips, invoices, and notices. Do not promise reinstatement or a refund amount.

UR: تنخواہ یا برطرفی لیبر فورم پر جا سکتی ہے؛ خراب چیز صارف عدالت۔ کاغذات لیں، وعدہ نہ کریں۔`,
  },
  {
    id: 'pk-cheque-notice',
    title: 'Cheque bounce — collect papers, no section advice',
    keywords: [
      'cheque bounce', 'dishonoured', 'bank return', 'legal notice cheque', '138', 'negotiable instruments',
      'چیک واپس', 'چیک باؤنس', 'بینک میمو', 'لیگل نوٹس چیک',
      'cheque wapas', 'cheque bounce ho gaya',
    ],
    content: `EN: A dishonoured cheque usually comes with a bank return memo. Next steps can include a legal notice and court process under negotiable instruments rules — timelines and sections are for the lawyer. Collect cheque copy, memo, and parties’ names; do not draft a notice on WhatsApp or promise recovery.

UR: چیک باؤنس پر بینک میمو اور چیک کی کاپی لیں۔ نوٹس یا مقدمہ وکیل دیکھے — وصولی کا وعدہ نہ کریں۔`,
  },
];

const MIN_HITS = 1;
const MAX_ARTICLES = 3;

export function matchPakistanLawyerKnowledge(query: string, limit = MAX_ARTICLES): RetrievedChunk[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];

  const scored = PAKISTAN_LAWYER_KNOWLEDGE.map((article) => {
    const hits = article.keywords.filter((keyword) => normalized.includes(normalizeKeyword(keyword))).length;
    const titleBoost = article.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4)
      .some((w) => normalized.includes(w))
      ? 1
      : 0;
    const totalHits = hits + titleBoost;
    // Prefer multi-keyword hits; still allow a single strong keyword (>=5 chars).
    const strongSolo = hits === 1 && article.keywords.some((k) => k.length >= 5 && normalized.includes(normalizeKeyword(k)));
    if (totalHits < 2 && !strongSolo) {
      return { article, hits: 0, score: 0 };
    }
    const score = Math.min(0.92, 0.4 + totalHits * 0.1);
    return { article, hits: totalHits, score };
  })
    .filter((row) => row.hits >= MIN_HITS)
    .sort((a, b) => b.score - a.score || b.hits - a.hits);

  return scored.slice(0, limit).map((row) => ({
    chunkId: `pakistan:${row.article.id}`,
    kbId: row.article.id,
    title: row.article.title,
    content: row.article.content,
    score: row.score,
    source: 'knowledge_base' as const,
  }));
}

/** Light Roman-Urdu / punctuation normalization before keyword scoring. */
export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[—–―]/g, ' ')
    .replace(/\b(ki|ke|ka|ko|se|mein|main|mujhe|mera|meri|hamare)\b/g, ' ')
    .replace(/(.)\1{2,}/g, '$1$1')
    .replace(/[^a-z0-9\u0600-\u06ff\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKeyword(keyword: string): string {
  return normalizeQuery(keyword);
}
