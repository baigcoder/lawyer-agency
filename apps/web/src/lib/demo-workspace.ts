import type { SignalLevel } from '@/components/signal';
import type { EscalationTrigger, HandoffBrief } from '@/lib/schemas/escalations';
import type { DocumentDto } from '@/lib/schemas/document';
import type { PaymentMethod, PaymentStatus } from '@/lib/schemas/payment';
import type { CaseDto } from '@/lib/schemas/case';
import { DEMO_BRIEF } from '@/lib/demo-data';
import { DEMO_MATTER } from '@/components/matter-frame';

/**
 * The /demo workspace: one fictional Lahore chamber with consistent people,
 * matters and numbers across every page. Enum fields reuse the real API
 * schema types so demo screens and dashboard screens speak the same language.
 * Illustrative only — no real client data.
 */

export const FIRM = {
  name: 'Al-Madad Law Associates',
  city: 'Lahore',
  whatsapp: '+92 42 3578 1100',
  instance: 'almadad-main',
} as const;

export type Lawyer = {
  id: string;
  name: string;
  initials: string;
  title: string;
  role: 'Owner' | 'Lawyer' | 'Staff';
  enrolment: string;
  availability: { label: string; level: SignalLevel };
  openMatters: number;
  escalations7d: number;
  lastActive: string;
};

export const TEAM: Lawyer[] = [
  { id: 'saad', name: 'Saad Qureshi', initials: 'SQ', title: 'Managing Partner', role: 'Owner', enrolment: 'ASC · LHCBA', availability: { label: 'In chambers', level: 'ok' }, openMatters: 9, escalations7d: 2, lastActive: 'now' },
  { id: 'ayesha', name: 'Ayesha Khan', initials: 'AK', title: 'Senior Partner', role: 'Lawyer', enrolment: 'Advocate High Court · LHCBA', availability: { label: 'Available', level: 'ok' }, openMatters: 14, escalations7d: 5, lastActive: '2m ago' },
  { id: 'usman', name: 'Usman Tariq', initials: 'UT', title: 'Associate', role: 'Lawyer', enrolment: 'Advocate High Court · LHCBA', availability: { label: 'In court · LHC Bench III until 13:00', level: 'attention' }, openMatters: 11, escalations7d: 3, lastActive: '48m ago' },
  { id: 'hira', name: 'Hira Saleem', initials: 'HS', title: 'Associate', role: 'Lawyer', enrolment: 'Advocate · Lahore Bar Association', availability: { label: 'In consultation', level: 'attention' }, openMatters: 8, escalations7d: 4, lastActive: '6m ago' },
  { id: 'kamran', name: 'Kamran Javed', initials: 'KJ', title: 'Paralegal', role: 'Staff', enrolment: '—', availability: { label: 'Available', level: 'ok' }, openMatters: 0, escalations7d: 0, lastActive: '1m ago' },
  { id: 'nadia', name: 'Nadia Iqbal', initials: 'NI', title: 'Front desk & accounts', role: 'Staff', enrolment: '—', availability: { label: 'Off today', level: 'info' }, openMatters: 0, escalations7d: 0, lastActive: 'yesterday' },
];

export type DemoMessage = {
  id: string;
  from: 'client' | 'ai' | 'lawyer' | 'note' | 'system';
  body: string;
  time: string;
  kind?: 'voice' | 'image' | 'document';
  meta?: string;
  author?: string;
};

export type DemoConversation = {
  id: string;
  client: string;
  phone: string;
  language: 'Roman Urdu' | 'Urdu' | 'English';
  state: 'HUMAN_REQUIRED' | 'AI_ACTIVE' | 'HUMAN_ACTIVE' | 'CLOSED';
  signal: SignalLevel;
  caseRef?: string;
  matter?: string;
  assignee?: string;
  unread: number;
  time: string;
  preview: string;
  draft?: string;
  paymentProof?: boolean;
  messages: DemoMessage[];
};

export const CONVERSATIONS: DemoConversation[] = [
  {
    id: 'c-ahmed',
    client: DEMO_MATTER.client,
    phone: DEMO_MATTER.phone,
    language: 'Roman Urdu',
    state: 'HUMAN_REQUIRED',
    signal: 'critical',
    caseRef: DEMO_MATTER.reference,
    matter: 'Criminal · post-arrest bail',
    assignee: 'Ayesha Khan',
    unread: 0,
    time: '23:43',
    preview: DEMO_MATTER.thread.c2,
    draft: DEMO_MATTER.thread.draft,
    messages: [
      { id: 'a1', from: 'client', body: DEMO_MATTER.thread.c1, time: '23:42' },
      { id: 'a2', from: 'ai', body: DEMO_MATTER.thread.a1, time: '23:42', meta: 'Approved intake question' },
      { id: 'a3', from: 'client', body: DEMO_MATTER.thread.c2, time: '23:43' },
      { id: 'a4', from: 'system', body: 'Active arrest detected — automation paused, escalated to Ayesha Khan', time: '23:43' },
      { id: 'a5', from: 'note', author: 'Ayesha Khan', body: 'Will take this. Check sections in FIR once copy arrives — likely 380/411.', time: '23:47' },
    ],
  },
  {
    id: 'c-sana',
    client: 'Sana Ahmed',
    phone: '+92 333 •••• 118',
    language: 'Roman Urdu',
    state: 'AI_ACTIVE',
    signal: 'routine',
    matter: 'Enquiry · fees & hours',
    unread: 2,
    time: '10:12',
    preview: 'Ji Saturday 11 baje theek hai.',
    messages: [
      { id: 's1', from: 'client', body: 'Consultation fee kitni hai? Aur Saturday ko office khula hota hai?', time: '10:09' },
      { id: 's2', from: 'ai', body: 'Consultation fee PKR 5,000 hai. Office Saturday ko 10 se 2 baje tak khula hai. Kya main aap ke liye waqt book karoon?', time: '10:09', meta: 'Source · Firm FAQ › Fees & hours' },
      { id: 's3', from: 'client', body: 'Ji Saturday 11 baje theek hai.', time: '10:12' },
    ],
  },
  {
    id: 'c-mkhan',
    client: 'Muhammad Khan',
    phone: '+92 345 •••• 902',
    language: 'Urdu',
    state: 'HUMAN_ACTIVE',
    signal: 'attention',
    caseRef: 'WK-1029',
    matter: 'Revenue · fard correction',
    assignee: 'Usman Tariq',
    unread: 1,
    time: '09:58',
    preview: 'Voice note · 0:48',
    messages: [
      { id: 'm1', from: 'client', kind: 'voice', body: 'پٹواری نے فرد میں رقبہ غلط لکھ دیا ہے، انتقال بھی رکا ہوا ہے۔ اگلی پیشی کب ہے؟', time: '09:58', meta: 'Transcribed · 0:48' },
      { id: 'm2', from: 'lawyer', author: 'Usman Tariq', body: 'Khan sahab, aglay hafte Tehsildar ke samne date hai. Fard ki taaza copy bhej dein.', time: '10:05' },
    ],
  },
  {
    id: 'c-bilal',
    client: 'Bilal Hussain',
    phone: '+92 300 •••• 557',
    language: 'English',
    state: 'HUMAN_REQUIRED',
    signal: 'urgent',
    caseRef: 'WK-1037',
    matter: 'Civil revision · LHC',
    assignee: 'Usman Tariq',
    unread: 1,
    time: '09:31',
    preview: 'Sent the fee via Easypaisa, screenshot attached.',
    paymentProof: true,
    messages: [
      { id: 'b1', from: 'client', body: 'Hearing is tomorrow, right? I have not signed the vakalatnama yet.', time: '09:24' },
      { id: 'b2', from: 'ai', body: 'Your hearing for WK-1037 is tomorrow at 09:00 at the Lahore High Court. I have let Usman Tariq know about the vakalatnama.', time: '09:24', meta: 'From case diary' },
      { id: 'b3', from: 'client', kind: 'image', body: 'Sent the fee via Easypaisa, screenshot attached.', time: '09:31', meta: 'easypaisa_receipt.jpg' },
    ],
  },
  {
    id: 'c-farah',
    client: 'Farah Raza',
    phone: '+92 321 •••• 640',
    language: 'Roman Urdu',
    state: 'AI_ACTIVE',
    signal: 'routine',
    caseRef: 'WK-1046',
    matter: 'Family · custody',
    unread: 0,
    time: 'Yesterday',
    preview: 'Agli tareekh 14 October hai, Family Court Lahore.',
    messages: [
      { id: 'f1', from: 'client', body: 'Case ki hearing ki date kya hai?', time: '18:20' },
      { id: 'f2', from: 'ai', body: 'Agli tareekh 14 October hai, Family Court Lahore, subah 10 baje.', time: '18:20', meta: 'From case diary' },
    ],
  },
  {
    id: 'c-hina',
    client: 'Hina Aslam',
    phone: '+92 312 •••• 274',
    language: 'Urdu',
    state: 'CLOSED',
    signal: 'info',
    matter: 'Consultation booked',
    unread: 0,
    time: 'Mon',
    preview: 'اپائنٹمنٹ جمعرات کو کنفرم ہے',
    messages: [
      { id: 'h1', from: 'client', body: 'کیا جمعرات کو وقت مل سکتا ہے؟', time: '12:02' },
      { id: 'h2', from: 'ai', body: 'جی، جمعرات شام ۴:۳۰ بجے عائشہ خان صاحبہ کے ساتھ اپائنٹمنٹ کنفرم ہے۔', time: '12:03', meta: 'Booked from open slots' },
    ],
  },
];

/** Arrives live a few seconds into the demo. */
export const INCOMING: DemoConversation = {
  id: 'c-zainab',
  client: 'Zainab Malik',
  phone: '+92 302 •••• 731',
  language: 'Roman Urdu',
  state: 'AI_ACTIVE',
  signal: 'attention',
  matter: 'Family · khula enquiry',
  unread: 1,
  time: 'now',
  preview: 'Mujhe khula ke liye wakeel chahiye. Kya aap Family Court Lahore mein case lete hain?',
  messages: [
    { id: 'z1', from: 'client', body: 'Mujhe khula ke liye wakeel chahiye. Kya aap Family Court Lahore mein case lete hain?', time: 'now' },
  ],
};

/** Arrives mid-demo with a deadline — the escalation path, live. */
export const INCOMING_URGENT: DemoConversation = {
  id: 'c-tariq',
  client: 'Tariq Mehmood',
  phone: '+92 301 •••• 486',
  language: 'Roman Urdu',
  state: 'HUMAN_REQUIRED',
  signal: 'urgent',
  caseRef: 'WK-1050',
  matter: 'Banking · freeze notice',
  unread: 1,
  time: 'now',
  preview: 'Bank ne notice bheja hai — kal subah 10 baje tak jawab na diya to account freeze.',
  messages: [
    { id: 't1', from: 'client', body: 'Bank ne notice bheja hai — kal subah 10 baje tak jawab na diya to account freeze kar denge. Business ka account hai.', time: 'now' },
    { id: 't2', from: 'system', body: 'Deadline under 24h detected — automation paused, escalated to the duty lawyer', time: 'now' },
  ],
};

export type DemoEscalation = {
  id: string;
  trigger: EscalationTrigger;
  client: string;
  caseRef?: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  slaSeconds: number;
  /** Absolute deadline (epoch ms), stamped when the demo loads. */
  deadline?: number;
  assignee?: string;
  excerpt: string;
  brief: HandoffBrief;
};

export const ESCALATIONS: DemoEscalation[] = [
  {
    id: 'e1',
    trigger: 'ACTIVE_ARREST',
    client: DEMO_MATTER.client,
    caseRef: DEMO_MATTER.reference,
    status: 'OPEN',
    slaSeconds: 12 * 60 + 41,
    assignee: 'Ayesha Khan',
    excerpt: DEMO_MATTER.thread.c1,
    brief: DEMO_BRIEF,
  },
  {
    id: 'e2',
    trigger: 'IMMINENT_DEADLINE',
    client: 'Bilal Hussain',
    caseRef: 'WK-1037',
    status: 'OPEN',
    slaSeconds: 41 * 60 + 8,
    excerpt: 'Hearing is tomorrow, right? I have not signed the vakalatnama yet.',
    brief: {
      reason: 'Hearing tomorrow at 09:00; vakalatnama not yet signed.',
      matterType: 'Civil revision · Lahore High Court',
      situation: 'Client is due before LHC Bench III tomorrow. Vakalatnama is unsigned and the fee proof was sent this morning.',
      facts: { client: 'Bilal Hussain', court: 'LHC · Bench III', 'next date': 'Tomorrow, 09:00' },
      documents: { requests: [{ description: 'Signed vakalatnama', status: 'PENDING' }], files: [{ filename: 'easypaisa_receipt.jpg', docType: 'PAYMENT_PROOF' }] },
      openItems: ['Can the client come to chambers before 08:30 to sign?'],
      nextAction: 'Verify the fee proof and arrange signing of the vakalatnama today.',
    },
  },
  {
    id: 'e3',
    trigger: 'DOMESTIC_VIOLENCE',
    client: 'Rukhsana Bibi',
    caseRef: 'WK-1044',
    status: 'ACKNOWLEDGED',
    slaSeconds: 0,
    assignee: 'Hira Saleem',
    excerpt: 'Ghar mein maar peet hoti hai, bachon ke saath alag rehna chahti hoon.',
    brief: {
      reason: 'Client describes ongoing domestic violence.',
      matterType: 'Family · protection & custody',
      situation: 'Client wishes to live separately with her children. Safety resources shared by the lawyer; consultation booked.',
      facts: { client: 'Rukhsana Bibi', city: 'Lahore' },
      documents: { requests: [], files: [] },
      openItems: [],
      nextAction: 'Consultation today 15:00 with Hira Saleem.',
    },
  },
];

/** Raised live alongside INCOMING_URGENT; the deadline is stamped on arrival. */
export const LIVE_ESCALATION: DemoEscalation = {
  id: 'e4',
  trigger: 'IMMINENT_DEADLINE',
  client: 'Tariq Mehmood',
  caseRef: 'WK-1050',
  status: 'OPEN',
  slaSeconds: 15 * 60,
  excerpt: 'Bank ne notice bheja hai — kal subah 10 baje tak jawab na diya to account freeze kar denge.',
  brief: {
    reason: 'Reply to a bank notice due tomorrow 10:00; business account at risk of freeze.',
    matterType: 'Banking · account freeze notice',
    situation: 'Client received a notice from his bank and must respond by 10:00 tomorrow or the business account will be frozen. Notice not yet shared.',
    facts: { client: 'Tariq Mehmood', deadline: 'Tomorrow, 10:00', account: 'Business current account' },
    documents: { requests: [{ description: 'Copy of the bank notice', status: 'PENDING' }], files: [] },
    openItems: ['Which bank and branch issued the notice?'],
    nextAction: 'Claim, call the client tonight and obtain the notice.',
  },
};

export type DemoActivity = { id: string; time: string; what: string; who: string; source: string };

/** “What Wakeel did” — seeded history; the live script prepends to it. */
export const ACTIVITY: DemoActivity[] = [
  { id: 'act-4', time: '10:09', what: 'Answered fee & hours question', who: 'Sana Ahmed', source: 'FAQ · Fees & hours' },
  { id: 'act-3', time: '09:24', what: 'Told client the next hearing date', who: 'Bilal Hussain', source: 'Case diary' },
  { id: 'act-2', time: '23:44', what: 'Opened WK-1042, requested FIR & CNIC', who: 'Ahmed Raza', source: 'Intake' },
  { id: 'act-1', time: '23:43', what: 'Stopped automation — arrest detected', who: 'Ahmed Raza', source: 'Safety rule' },
];

export type DemoCase = {
  reference: string;
  client: string;
  title: string;
  practice: 'Criminal' | 'Civil' | 'Family' | 'Property' | 'Revenue' | 'Corporate';
  forum: string;
  status: CaseDto['status'];
  urgency: CaseDto['urgency'];
  lawyer: string;
  nextDate?: string;
  opened: string;
  billedPkr: number;
  collectedPkr: number;
  documents: number;
  timeline: Array<{ time: string; text: string; who?: string }>;
};

export const CASES: DemoCase[] = [
  { reference: 'WK-1042', client: 'Ahmed Raza', title: 'State v. Kamran Raza — post-arrest bail', practice: 'Criminal', forum: 'Judicial Magistrate · Cantt Courts, Lahore', status: 'ENGAGED', urgency: 'CRITICAL', lawyer: 'Ayesha Khan', nextDate: 'Tomorrow · 09:00', opened: 'Today', billedPkr: 50000, collectedPkr: 0, documents: 0, timeline: [
    { time: '23:42', text: 'Enquiry received on WhatsApp (Roman Urdu)' },
    { time: '23:43', text: 'Active arrest detected — escalated', who: 'Wakeel AI' },
    { time: '23:44', text: 'Matter WK-1042 opened · FIR copy & CNIC requested', who: 'Wakeel AI' },
    { time: '23:47', text: 'Claimed by Ayesha Khan', who: 'Ayesha Khan' },
  ] },
  { reference: 'WK-1037', client: 'Bilal Hussain', title: 'Hussain v. Province of Punjab — civil revision', practice: 'Civil', forum: 'Lahore High Court · Bench III', status: 'IN_COURT', urgency: 'HIGH', lawyer: 'Usman Tariq', nextDate: 'Tomorrow · 09:00', opened: '12 Mar', billedPkr: 180000, collectedPkr: 150000, documents: 14, timeline: [
    { time: '09:31', text: 'Fee proof received via WhatsApp (Easypaisa)' },
    { time: '09:24', text: 'Client asked about hearing — answered from case diary', who: 'Wakeel AI' },
    { time: 'Mon', text: 'Hearing adjourned to tomorrow', who: 'Usman Tariq' },
  ] },
  { reference: 'WK-1029', client: 'Muhammad Khan', title: 'Correction of fard & pending intiqal — Mauza Kot Abdul Malik', practice: 'Revenue', forum: 'Tehsildar · Sheikhupura', status: 'ENGAGED', urgency: 'NORMAL', lawyer: 'Usman Tariq', nextDate: 'Thu 16 Oct · 11:00', opened: '02 Sep', billedPkr: 60000, collectedPkr: 60000, documents: 6, timeline: [
    { time: '09:58', text: 'Voice note received and transcribed (Urdu)' },
    { time: '10:05', text: 'Fresh fard copy requested', who: 'Usman Tariq' },
  ] },
  { reference: 'WK-1046', client: 'Farah Raza', title: 'Guardianship & maintenance of minors', practice: 'Family', forum: 'Family Court · Lahore', status: 'IN_COURT', urgency: 'NORMAL', lawyer: 'Hira Saleem', nextDate: 'Tue 14 Oct · 10:00', opened: '18 Aug', billedPkr: 90000, collectedPkr: 60000, documents: 9, timeline: [
    { time: 'Yesterday', text: 'Client asked for next date — answered from diary', who: 'Wakeel AI' },
  ] },
  { reference: 'WK-1011', client: 'Rana Shahid', title: 'Suit for specific performance — agreement to sell, DHA Phase 6', practice: 'Property', forum: 'Civil Court · Lahore', status: 'IN_COURT', urgency: 'HIGH', lawyer: 'Saad Qureshi', nextDate: 'Today · 14:00', opened: '05 Jan', billedPkr: 400000, collectedPkr: 250000, documents: 27, timeline: [
    { time: 'Today', text: 'Evidence affidavit filed', who: 'Saad Qureshi' },
  ] },
  { reference: 'WK-1018', client: 'Noor Textiles (Pvt) Ltd', title: 'Shareholders’ agreement & SECP filings', practice: 'Corporate', forum: 'Advisory · SECP', status: 'ENGAGED', urgency: 'LOW', lawyer: 'Saad Qureshi', opened: '21 Jul', billedPkr: 300000, collectedPkr: 285000, documents: 12, timeline: [
    { time: 'Fri', text: 'Retainer proof (PKR 15,000) awaiting verification' },
  ] },
  { reference: 'WK-1049', client: 'Zainab Malik', title: 'Khula — dissolution of marriage', practice: 'Family', forum: 'Family Court · Lahore', status: 'LEAD', urgency: 'NORMAL', lawyer: 'Hira Saleem', opened: 'Today', billedPkr: 0, collectedPkr: 0, documents: 0, timeline: [] },
  { reference: 'WK-1003', client: 'Imran Butt', title: 'Complaint u/s 489-F — dishonoured cheque', practice: 'Criminal', forum: 'Judicial Magistrate · Rawalpindi', status: 'CLOSED', urgency: 'LOW', lawyer: 'Ayesha Khan', opened: '10 Feb', billedPkr: 120000, collectedPkr: 120000, documents: 11, timeline: [] },
];

export type DemoHearing = {
  day: number; // 0 = Monday
  time: string;
  court: string;
  bench?: string;
  caseRef: string;
  title: string;
  lawyer: string;
  level: SignalLevel;
  kind: 'Hearing' | 'Consultation' | 'Filing';
};

export const WEEK_DAYS = ['Mon 13', 'Tue 14', 'Wed 15', 'Thu 16', 'Fri 17', 'Sat 18'];
export const TODAY_INDEX = 2;

export const HEARINGS: DemoHearing[] = [
  { day: 0, time: '10:00', court: 'Sessions Court · Lahore', bench: 'ASJ-IV', caseRef: 'WK-0987', title: 'Bail cancellation — arguments', lawyer: 'Ayesha Khan', level: 'routine', kind: 'Hearing' },
  { day: 1, time: '10:00', court: 'Family Court · Lahore', caseRef: 'WK-1046', title: 'Guardianship — evidence', lawyer: 'Hira Saleem', level: 'routine', kind: 'Hearing' },
  { day: 1, time: '15:30', court: 'Chambers', caseRef: 'WK-1018', title: 'Board resolution review', lawyer: 'Saad Qureshi', level: 'info', kind: 'Consultation' },
  { day: 2, time: '11:30', court: 'Chambers', caseRef: 'WK-1046', title: 'Consultation · Farah Raza', lawyer: 'Hira Saleem', level: 'info', kind: 'Consultation' },
  { day: 2, time: '14:00', court: 'Civil Court · Lahore', bench: 'Civil Judge Class-I', caseRef: 'WK-1011', title: 'Specific performance — evidence', lawyer: 'Saad Qureshi', level: 'attention', kind: 'Hearing' },
  { day: 2, time: '15:00', court: 'Chambers', caseRef: 'WK-1044', title: 'Consultation · Rukhsana Bibi', lawyer: 'Hira Saleem', level: 'attention', kind: 'Consultation' },
  { day: 3, time: '09:00', court: 'Cantt Courts · Lahore', bench: 'Judicial Magistrate', caseRef: 'WK-1042', title: 'Post-arrest bail — first production', lawyer: 'Ayesha Khan', level: 'critical', kind: 'Hearing' },
  { day: 3, time: '09:00', court: 'Lahore High Court', bench: 'Bench III', caseRef: 'WK-1037', title: 'Civil revision — arguments', lawyer: 'Usman Tariq', level: 'urgent', kind: 'Hearing' },
  { day: 3, time: '11:00', court: 'Tehsildar · Sheikhupura', caseRef: 'WK-1029', title: 'Fard correction — hearing', lawyer: 'Usman Tariq', level: 'routine', kind: 'Hearing' },
  { day: 4, time: '12:00', court: 'LHC Registry', caseRef: 'WK-1037', title: 'File rejoinder', lawyer: 'Kamran Javed', level: 'routine', kind: 'Filing' },
  { day: 5, time: '11:00', court: 'Chambers', caseRef: '—', title: 'Consultation · Sana Ahmed', lawyer: 'Ayesha Khan', level: 'info', kind: 'Consultation' },
];

export type DemoDocument = Pick<DocumentDto, 'filename' | 'docType' | 'ocrStatus' | 'sizeBytes'> & {
  caseRef: string;
  client: string;
  tier: 'T1' | 'T2' | 'T3';
  source: 'WhatsApp' | 'Staff upload' | 'Firm template';
  added: string;
  indexed: boolean;
};

export const DOCUMENTS: DemoDocument[] = [
  { filename: 'easypaisa_receipt.jpg', docType: 'PAYMENT_PROOF', ocrStatus: 'COMPLETED', sizeBytes: 182_000, caseRef: 'WK-1037', client: 'Bilal Hussain', tier: 'T2', source: 'WhatsApp', added: '09:31', indexed: true },
  { filename: 'fard_kot_abdul_malik.pdf', docType: 'OTHER', ocrStatus: 'PROCESSING', sizeBytes: 1_240_000, caseRef: 'WK-1029', client: 'Muhammad Khan', tier: 'T3', source: 'WhatsApp', added: '10:14', indexed: false },
  { filename: 'evidence_affidavit_PW1.pdf', docType: 'AFFIDAVIT', ocrStatus: 'COMPLETED', sizeBytes: 640_000, caseRef: 'WK-1011', client: 'Rana Shahid', tier: 'T3', source: 'Staff upload', added: 'Today', indexed: true },
  { filename: 'cnic_farah_raza.jpg', docType: 'CNIC', ocrStatus: 'SKIPPED', sizeBytes: 210_000, caseRef: 'WK-1046', client: 'Farah Raza', tier: 'T3', source: 'WhatsApp', added: '18 Aug', indexed: false },
  { filename: 'court_notice_14_oct.pdf', docType: 'COURT_NOTICE', ocrStatus: 'COMPLETED', sizeBytes: 380_000, caseRef: 'WK-1046', client: 'Farah Raza', tier: 'T2', source: 'Staff upload', added: '02 Oct', indexed: true },
  { filename: 'agreement_to_sell_dha6.pdf', docType: 'CONTRACT', ocrStatus: 'COMPLETED', sizeBytes: 2_900_000, caseRef: 'WK-1011', client: 'Rana Shahid', tier: 'T3', source: 'Staff upload', added: '05 Jan', indexed: true },
  { filename: 'vakalatnama_template_urdu.docx', docType: 'OTHER', ocrStatus: 'SKIPPED', sizeBytes: 48_000, caseRef: '—', client: 'Firm', tier: 'T1', source: 'Firm template', added: 'Jun', indexed: true },
];

export type KnowledgeArticle = {
  title: string;
  category: string;
  status: 'APPROVED' | 'IN_REVIEW' | 'DRAFT';
  languages: string;
  used7d: number;
  approvedBy?: string;
  updated: string;
};

export const KNOWLEDGE: KnowledgeArticle[] = [
  { title: 'Consultation fees & office hours', category: 'Fees', status: 'APPROVED', languages: 'EN · UR · Roman', used7d: 41, approvedBy: 'Saad Qureshi', updated: '12 Sep' },
  { title: 'Documents to bring for a bail matter', category: 'Criminal', status: 'APPROVED', languages: 'EN · UR · Roman', used7d: 17, approvedBy: 'Ayesha Khan', updated: '03 Oct' },
  { title: 'What happens at a first family-court hearing', category: 'Family', status: 'APPROVED', languages: 'EN · Roman', used7d: 12, approvedBy: 'Hira Saleem', updated: '28 Sep' },
  { title: 'How to obtain a fresh fard from the PLRA centre', category: 'Revenue', status: 'APPROVED', languages: 'UR · Roman', used7d: 6, approvedBy: 'Usman Tariq', updated: '19 Sep' },
  { title: 'Payment methods: Easypaisa, JazzCash, bank transfer', category: 'Fees', status: 'APPROVED', languages: 'EN · UR · Roman', used7d: 23, approvedBy: 'Saad Qureshi', updated: '01 Oct' },
  { title: 'Khula: process overview for first enquiries', category: 'Family', status: 'IN_REVIEW', languages: 'EN · Roman', used7d: 0, updated: 'Today' },
  { title: 'Overseas Pakistanis — power of attorney basics', category: 'Property', status: 'DRAFT', languages: 'EN', used7d: 0, updated: 'Yesterday' },
];

export type DemoPayment = {
  id: string;
  client: string;
  caseRef: string;
  description: string;
  amountPkr: number;
  method: PaymentMethod;
  status: PaymentStatus;
  date: string;
  overdue?: boolean;
};

export const PAYMENTS: DemoPayment[] = [
  { id: 'p1', client: 'Bilal Hussain', caseRef: 'WK-1037', description: 'Hearing fee · civil revision', amountPkr: 30000, method: 'EASYPAISA', status: 'PENDING', date: 'Today 09:31' },
  { id: 'p2', client: 'Noor Textiles (Pvt) Ltd', caseRef: 'WK-1018', description: 'Monthly retainer · October', amountPkr: 15000, method: 'BANK_TRANSFER', status: 'PENDING', date: 'Fri' },
  { id: 'p3', client: 'Rana Shahid', caseRef: 'WK-1011', description: 'Evidence stage fee', amountPkr: 150000, method: 'BANK_TRANSFER', status: 'REQUESTED', date: '28 Sep', overdue: true },
  { id: 'p4', client: 'Farah Raza', caseRef: 'WK-1046', description: 'Second instalment', amountPkr: 30000, method: 'JAZZCASH', status: 'REQUESTED', date: '01 Oct', overdue: true },
  { id: 'p5', client: 'Muhammad Khan', caseRef: 'WK-1029', description: 'Professional fee · revenue matter', amountPkr: 60000, method: 'CASH', status: 'RECORDED_MANUAL', date: '02 Sep' },
  { id: 'p6', client: 'Sana Ahmed', caseRef: '—', description: 'Consultation fee', amountPkr: 5000, method: 'EASYPAISA', status: 'SUCCEEDED', date: 'Yesterday' },
  { id: 'p7', client: 'Imran Butt', caseRef: 'WK-1003', description: 'Final bill', amountPkr: 40000, method: 'BANK_TRANSFER', status: 'SUCCEEDED', date: '30 Sep' },
  { id: 'p8', client: 'Noor Textiles (Pvt) Ltd', caseRef: 'WK-1018', description: 'SECP filing fee (disbursement)', amountPkr: 85000, method: 'BANK_TRANSFER', status: 'SUCCEEDED', date: '26 Sep' },
];

export const ANALYTICS = {
  enquiries14d: [11, 14, 9, 17, 15, 12, 6, 13, 18, 16, 21, 19, 14, 8],
  aiHandled14d: [8, 10, 7, 12, 11, 9, 5, 10, 13, 12, 15, 14, 10, 6],
  medianFirstReplySec: 38,
  medianLawyerAckMin: 9,
  funnel: [
    { label: 'Enquiries', value: 212 },
    { label: 'Qualified', value: 141 },
    { label: 'Consultation booked', value: 64 },
    { label: 'Engaged', value: 29 },
  ],
  practice: [
    { label: 'Criminal', value: 31 },
    { label: 'Family', value: 24 },
    { label: 'Property', value: 18 },
    { label: 'Civil', value: 12 },
    { label: 'Revenue', value: 9 },
    { label: 'Corporate', value: 6 },
  ],
  languages: [
    { label: 'Roman Urdu', value: 58 },
    { label: 'Urdu', value: 27 },
    { label: 'English', value: 15 },
  ],
};

export const WHATSAPP = {
  status: 'connected' as const,
  transport: 'Evolution API · Cloud',
  lastWebhook: '2s ago',
  inboundToday: 47,
  outboundToday: 52,
  openWindows: 18,
  throughput24h: [2, 1, 0, 0, 0, 1, 3, 6, 9, 12, 14, 11, 9, 10, 12, 8, 7, 9, 11, 13, 9, 6, 4, 3],
  templates: [
    { name: 'hearing_reminder', language: 'en · ur', status: 'APPROVED' as const, sent7d: 34 },
    { name: 'document_request', language: 'en · ur', status: 'APPROVED' as const, sent7d: 21 },
    { name: 'payment_receipt', language: 'en', status: 'APPROVED' as const, sent7d: 12 },
    { name: 'appointment_confirmation', language: 'ur', status: 'PENDING' as const, sent7d: 0 },
  ],
};

export function formatPkr(amount: number): string {
  return `PKR ${amount.toLocaleString('en-PK')}`;
}
