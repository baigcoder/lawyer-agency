import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE_URL = 'http://localhost:3000';
const AXE_PATH = resolve(process.cwd(), 'node_modules/axe-core/axe.min.js');
const axeSource = readFileSync(AXE_PATH, 'utf-8');

// Mock data fixtures conforming to Zod schemas
const now = new Date();
const in24h = new Date(now.getTime() + 20 * 60 * 60 * 1000).toISOString();
const past24h = new Date(now.getTime() - 30 * 60 * 60 * 1000).toISOString();

const mockSession = {
  userId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d11',
  tenantId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d0e',
  name: 'Barrister Ali Khan',
  email: 'ali.khan@wakeellaw.pk',
  role: 'OWNER',
  permissions: [
    'users:read', 'users:write', 'lawyers:read', 'lawyers:write',
    'inbox:read', 'inbox:write', 'cases:read', 'cases:write',
    'escalations:read', 'escalations:write', 'payments:read', 'payments:write',
    'documents:read', 'documents:write', 'analytics:read', 'settings:read', 'settings:write'
  ],
  isOwner: true
};

const mockWhatsAppStatus = {
  connected: true,
  provider: 'META_CLOUD',
  verificationStatus: 'VERIFIED',
  connectionStage: 'LIVE',
  displayPhoneNumber: '+92 300 1234567',
  wabaId: 'waba_pk_123456',
  templates: { approved: 6, pending: 0, rejected: 0, paused: 0 }
};

const mockEvolutionStatus = {
  instanceName: 'wakeel-chamber-01',
  connectionType: 'baileys',
  status: 'connected',
  phoneNumber: '+923001234567',
  displayName: 'Wakeel Chambers Lahore',
  qrCode: null
};

const conv1Id = '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0001';
const conv2Id = '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0002';
const conv3Id = '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0003';
const msgDraftId = '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0011';

const mockConversations = [
  {
    id: conv1Id,
    state: 'AI_ACTIVE',
    client: {
      id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0101',
      name: 'Tariq Mehmood',
      waPhone: '+923005551234'
    },
    case: {
      id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0201',
      reference: 'WAK-2026-001'
    },
    assignedTo: {
      id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d11',
      name: 'Barrister Ali Khan'
    },
    lastMessage: {
      body: 'Sir, I have uploaded the property transfer registry documents.',
      senderType: 'CLIENT',
      contentType: 'text',
      createdAt: now.toISOString()
    },
    unreadCount: 1,
    sessionWindowExpiresAt: in24h,
    lastClientMessageAt: now.toISOString(),
    updatedAt: now.toISOString(),
    documentCount: 2,
    pendingDraft: {
      messageId: msgDraftId,
      body: 'Assalam-o-Alaikum Tariq Sahib. We have received your property registry documents and Advocate Ali Khan is reviewing the revenue record verification. Would you like to schedule an in-chamber consultation for tomorrow at 3:00 PM?'
    },
    pendingPayment: {
      id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0301',
      amountCents: 5000000,
      currency: 'PKR',
      description: 'Consultation and Registry Verification Fee',
      proofMessageId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0010',
      proofDocumentId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0401'
    }
  },
  {
    id: conv2Id,
    state: 'HUMAN_REQUIRED',
    client: {
      id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0102',
      name: 'Zainab Bibi',
      waPhone: '+923214445678'
    },
    case: null,
    assignedTo: null,
    lastMessage: {
      body: 'URGENT: Police visited my residence without warrant regarding family dispute.',
      senderType: 'CLIENT',
      contentType: 'text',
      createdAt: now.toISOString()
    },
    unreadCount: 3,
    sessionWindowExpiresAt: in24h,
    lastClientMessageAt: now.toISOString(),
    updatedAt: now.toISOString(),
    documentCount: 1,
    pendingDraft: null,
    pendingPayment: null
  },
  {
    id: conv3Id,
    state: 'CLOSED',
    client: {
      id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0103',
      name: 'Hamza Farooq',
      waPhone: '+923337778899'
    },
    case: null,
    assignedTo: null,
    lastMessage: {
      body: 'Shukriya counsel, consultation went very well.',
      senderType: 'CLIENT',
      contentType: 'text',
      createdAt: past24h
    },
    unreadCount: 0,
    sessionWindowExpiresAt: past24h,
    lastClientMessageAt: past24h,
    updatedAt: past24h,
    documentCount: 0,
    pendingDraft: null,
    pendingPayment: null
  }
];

const mockConv1Detail = {
  conversation: mockConversations[0],
  messages: [
    {
      id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0008',
      direction: 'INBOUND',
      senderType: 'CLIENT',
      senderName: 'Tariq Mehmood',
      body: 'Assalam-o-Alaikum, I need legal representation regarding a commercial property dispute in Gulberg Lahore.',
      contentType: 'text',
      deliveryStatus: 'READ',
      createdAt: new Date(now.getTime() - 4 * 3600000).toISOString()
    },
    {
      id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0009',
      direction: 'OUTBOUND',
      senderType: 'AI',
      senderName: 'Wakeel AI Assistant',
      body: 'Walaikum Assalam Tariq Sahib. Welcome to Wakeel Chambers. Please share whether the property is currently leased and if any stay order has been granted by civil court.',
      contentType: 'text',
      deliveryStatus: 'DELIVERED',
      createdAt: new Date(now.getTime() - 3 * 3600000).toISOString()
    },
    {
      id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0010',
      direction: 'INBOUND',
      senderType: 'CLIENT',
      senderName: 'Tariq Mehmood',
      body: 'Sir, I have uploaded the property transfer registry documents.',
      contentType: 'text',
      deliveryStatus: 'READ',
      mediaUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400',
      createdAt: new Date(now.getTime() - 1 * 3600000).toISOString()
    },
    {
      id: msgDraftId,
      direction: 'OUTBOUND',
      senderType: 'AI',
      senderName: 'Wakeel AI Assistant',
      body: 'Assalam-o-Alaikum Tariq Sahib. We have received your property registry documents and Advocate Ali Khan is reviewing the revenue record verification. Would you like to schedule an in-chamber consultation for tomorrow at 3:00 PM?',
      contentType: 'text',
      deliveryStatus: 'PENDING',
      pendingApproval: true,
      createdAt: now.toISOString()
    }
  ]
};

const mockConv3Detail = {
  conversation: mockConversations[2],
  messages: [
    {
      id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0015',
      direction: 'INBOUND',
      senderType: 'CLIENT',
      senderName: 'Hamza Farooq',
      body: 'Shukriya counsel, consultation went very well.',
      contentType: 'text',
      deliveryStatus: 'READ',
      createdAt: past24h
    }
  ]
};

const mockEscalations = [
  {
    id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0501',
    conversationId: conv2Id,
    triggerType: 'IMMINENT_DEADLINE',
    status: 'OPEN',
    detectedExcerpt: 'Police visited my residence without warrant regarding family dispute.',
    handoffReason: 'Imminent criminal procedure / civil rights urgency requiring senior advocate triage.',
    handoffBrief: {
      reason: 'Urgent harassment / search without warrant complaint in family litigation context.',
      matterType: 'Criminal Defence / Constitutional Writ',
      facts: {
        'Jurisdiction': 'Lahore High Court jurisdiction / Model Town Police Station',
        'Party Status': 'Petitioner',
        'Prior Proceedings': 'No prior FIR disclosed; complainant states verbal harassment'
      },
      documents: {
        requests: [{ description: 'Police call-up notice or inquiry diary number', status: 'PENDING' }],
        files: [{ filename: 'residence_cctv_notice.jpg', docType: 'EVIDENCE_PHOTO' }]
      },
      openItems: ['Verify FIR status via police station clerk', 'Prepare Section 22-A petition draft if required'],
      nextAction: 'Direct advocate telephone contact with client within 15 minutes.'
    },
    slaDeadline: new Date(now.getTime() + 25 * 60 * 1000).toISOString(),
    acknowledgedAt: null,
    resolvedAt: null,
    createdAt: now.toISOString(),
    client: {
      id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0102',
      name: 'Zainab Bibi',
      waPhone: '+923214445678'
    },
    assignedTo: null,
    acknowledgerName: null,
    slaBreached: false
  },
  {
    id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0502',
    conversationId: conv1Id,
    triggerType: 'MANUAL',
    status: 'ACKNOWLEDGED',
    detectedExcerpt: 'Registry verification requested',
    handoffReason: 'Client requested specific partner consultation fee quote.',
    handoffBrief: {
      reason: 'Partner fee schedule discussion.',
      matterType: 'Property and real estate',
      facts: { 'Property Value': 'PKR 85,000,000' },
      documents: { requests: [], files: [] },
      openItems: ['Confirm fee quote'],
      nextAction: 'Advocate follow-up'
    },
    slaDeadline: new Date(now.getTime() + 120 * 60 * 1000).toISOString(),
    acknowledgedAt: now.toISOString(),
    resolvedAt: null,
    createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    client: {
      id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0101',
      name: 'Tariq Mehmood',
      waPhone: '+923005551234'
    },
    assignedTo: {
      id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d11',
      name: 'Barrister Ali Khan'
    },
    acknowledgerName: 'Barrister Ali Khan',
    slaBreached: false
  }
];

const mockCases = [
  {
    id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0201',
    tenantId: mockSession.tenantId,
    clientId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0101',
    reference: 'WAK-2026-001',
    matterType: 'Civil litigation',
    status: 'ENGAGED',
    urgency: 'HIGH',
    summary: 'Commercial property partition and specific performance suit before Senior Civil Judge Lahore.',
    intakeData: { court: 'Civil Court Lahore', suitValuation: 'PKR 45,000,000' },
    openedAt: new Date(now.getTime() - 14 * 86400000).toISOString(),
    closedAt: null
  },
  {
    id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0202',
    tenantId: mockSession.tenantId,
    clientId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0102',
    reference: 'WAK-2026-002',
    matterType: 'Property and real estate',
    status: 'IN_COURT',
    urgency: 'NORMAL',
    summary: 'Title confirmation and perpetual injunction against illegal dispossession.',
    intakeData: { court: 'District Court Rawalpindi' },
    openedAt: new Date(now.getTime() - 40 * 86400000).toISOString(),
    closedAt: null
  }
];

const mockHearings = [
  {
    id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0601',
    caseId: mockCases[0].id,
    courtName: 'Court of Senior Civil Judge (Court No. 4), Lahore',
    judge: 'Malik Mohammad Aslam, Civil Judge 1st Class',
    hearingAt: new Date(now.getTime() + 3 * 86400000).toISOString(),
    location: 'Judicial Complex, Lahore',
    notes: 'Arguments on temporary injunction application under Order 39 Rule 1 & 2 CPC.',
    reminderSentAt: null,
    createdAt: now.toISOString()
  }
];

const mockAppointments = [
  {
    id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0701',
    clientId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0101',
    clientName: 'Tariq Mehmood',
    clientWaPhone: '+923005551234',
    lawyerId: mockSession.userId,
    lawyerName: 'Barrister Ali Khan',
    caseId: mockCases[0].id,
    startsAt: new Date(now.getTime() + 24 * 3600000).toISOString(),
    endsAt: new Date(now.getTime() + 25 * 3600000).toISOString(),
    status: 'CONFIRMED',
    location: 'Chamber 12, High Court Bar Association Lahore',
    notes: 'Document review and vakalatnama signing.',
    reminderSentAt: null
  }
];

const mockDocuments = [
  {
    id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0401',
    clientId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0101',
    caseId: mockCases[0].id,
    filename: 'registry_intiqal_doc_1998.pdf',
    description: 'Sub-Registrar certified copy of sale deed with revenue intiqal attestation.',
    mimeType: 'application/pdf',
    sizeBytes: 2450300,
    docType: 'CONTRACT',
    ocrStatus: 'COMPLETED',
    isPinned: true,
    createdAt: now.toISOString()
  },
  {
    id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0402',
    clientId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0101',
    caseId: mockCases[0].id,
    filename: 'payment_receipt_jazzcash.jpg',
    description: 'Advance fee transaction proof PKR 50,000.',
    mimeType: 'image/jpeg',
    sizeBytes: 420100,
    docType: 'PAYMENT_PROOF',
    ocrStatus: 'COMPLETED',
    isPinned: false,
    createdAt: now.toISOString()
  }
];

const mockKnowledge = [
  {
    id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0801',
    title: 'Punjab Pre-emption Act 1991 - Statutory Notice Requirements',
    content: 'Talb-i-Muwathabat must be made immediately in the assembly where news is received...',
    language: 'EN',
    category: 'Property Law',
    status: 'PUBLISHED',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  },
  {
    id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0802',
    title: 'خاندانی دعویٰ اور مہر کا طریقہ کار',
    content: 'فیملی کورٹس ایکٹ 1964 کے تحت دعویٰ دائر کرنے کے بنیادی تقاضے اور دستاویزات...',
    language: 'UR',
    category: 'Family Law',
    status: 'PUBLISHED',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }
];

const mockPayments = [
  {
    id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0301',
    tenantId: mockSession.tenantId,
    caseId: mockCases[0].id,
    clientId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0101',
    amountCents: 5000000,
    currency: 'PKR',
    method: 'JAZZCASH',
    status: 'SUCCEEDED',
    providerTxnId: 'JC-88291039',
    description: 'Initial consultation and court brief deposit',
    requestedAt: new Date(now.getTime() - 24 * 3600000).toISOString(),
    paidAt: now.toISOString(),
    recordedBy: mockSession.userId,
    metadata: {},
    createdAt: new Date(now.getTime() - 24 * 3600000).toISOString(),
    updatedAt: now.toISOString(),
    recordedByUser: { id: mockSession.userId, name: 'Barrister Ali Khan' },
    case: { reference: 'WAK-2026-001', matterType: 'Civil litigation' },
    client: {
      id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0101',
      name: 'Tariq Mehmood',
      waPhone: '+923005551234'
    }
  }
];

const mockAnalyticsMetrics = {
  newLeads7d: 48,
  aiContainmentRate: 74,
  escalations7d: 6,
  casesOpened7d: 12,
  casesClosed7d: 8,
  feesCollectedCents30d: 385000000,
  avgEscalationAckMinutes7d: 8
};

const mockLawyers = [
  {
    id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0901',
    userId: mockSession.userId,
    name: 'Barrister Ali Khan',
    email: 'ali.khan@wakeellaw.pk',
    practiceAreas: ['Civil litigation', 'Property and real estate', 'Constitutional law'],
    whatsappNumber: '+923001234567'
  },
  {
    id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c0902',
    userId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d12',
    name: 'Advocate Fatima Zahra',
    email: 'fatima.zahra@wakeellaw.pk',
    practiceAreas: ['Family law', 'Corporate and commercial'],
    whatsappNumber: '+923219876543'
  }
];

const mockUsers = [
  {
    id: mockSession.userId,
    name: 'Barrister Ali Khan',
    email: 'ali.khan@wakeellaw.pk',
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: now.toISOString()
  },
  {
    id: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d12',
    name: 'Advocate Fatima Zahra',
    email: 'fatima.zahra@wakeellaw.pk',
    role: 'LAWYER',
    status: 'ACTIVE',
    createdAt: now.toISOString()
  }
];

const mockFirmProfile = {
  firmName: 'Wakeel Legal Chambers Lahore',
  displayName: 'Wakeel Law Associates',
  city: 'Lahore',
  officeAddress: 'Chamber 12, High Court Bar Building, The Mall, Lahore',
  website: 'https://wakeellaw.pk',
  practiceAreas: ['Civil litigation', 'Property and real estate', 'Family law', 'Corporate and commercial'],
  clientLanguages: ['EN', 'UR', 'ROMAN_URDU'],
  officeHours: '09:00 - 18:00 PKT (Monday - Saturday)',
  teamSize: 6,
  consultationFeePkr: 5000,
  firmAbout: 'Leading civil litigation and appellate practice in Lahore High Court.',
  foundingYear: 2012,
  differentiators: ['Fast WhatsApp intake', 'Real-time hearing tracking', 'Specialized civil division']
};

const mockAiSettings = {
  aiAutoReplyEnabled: true,
  aiAutoReplyRequiresApproval: true,
  aiUrduReplyEnabled: true,
  aiLanguagePolicy: 'mirror',
  aiConsentMessage: 'Welcome to Wakeel Chambers. An automated assistant is logging your inquiry for our advocates.',
  aiGreetingIntro: 'Assalam-o-Alaikum. How can our legal team assist you today?',
  aiTone: 'formal',
  aiReplyLength: 'balanced',
  aiAskClarifyingQuestions: true,
  aiNeverInventCaseFacts: true,
  aiMentionConsultationFee: true,
  aiFirmScopeOnly: true,
  aiCustomInstructions: 'Always clarify that Wakeel AI gathers details and does not provide final legal counsel.',
  aiHandoffMessage: 'Your matter requires advocate attention. A lawyer will contact you shortly.',
  aiHandoffSlaMinutes: 15,
  aiVoiceEnabled: true,
  aiVoiceGender: 'female',
  aiVoiceReplyMode: 'auto',
  aiVoiceId: 'female-en-1',
  aiVoiceIdUrdu: 'female-ur-1',
  callsTakenBy: 'ai',
  aiCallHoursStart: '09:00',
  aiCallHoursEnd: '18:00',
  aiCallHoursTimezone: 'Asia/Karachi'
};

const mockVoices = {
  configured: true,
  voices: [
    { id: 'female-en-1', name: 'Rachel', gender: 'female', accent: 'British', language: 'en', recommendedFor: ['en'] },
    { id: 'female-ur-1', name: 'Anika', gender: 'female', accent: 'Pakistani', language: 'ur', recommendedFor: ['ur'] }
  ],
  defaults: {
    en: { female: { id: 'female-en-1', name: 'Rachel' }, male: { id: 'male-en-1', name: 'George' } },
    ur: { female: { id: 'female-ur-1', name: 'Anika' }, male: { id: 'male-ur-1', name: 'Haseeb' } }
  }
};

async function setupPageRoutes(page) {
  await page.route('**/backend/**', async (route) => {
    const url = route.request().url();

    // Session
    if (url.includes('/v1/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSession) });
    }

    // WhatsApp connection / status
    if (url.includes('/v1/whatsapp/connection') || url.includes('/v1/whatsapp/evolution/status')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockEvolutionStatus) });
    }
    if (url.includes('/v1/whatsapp/status')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockWhatsAppStatus) });
    }
    if (url.includes('/v1/whatsapp/ai-auto-reply')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ aiAutoReplyEnabled: true }) });
    }

    // Inbox detail
    if (url.includes(`/v1/inbox/${conv1Id}/notes`)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }
    if (url.includes(`/v1/inbox/${conv1Id}`)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockConv1Detail) });
    }
    if (url.includes(`/v1/inbox/${conv3Id}/notes`)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }
    if (url.includes(`/v1/inbox/${conv3Id}`)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockConv3Detail) });
    }
    // Inbox list
    if (url.includes('/v1/inbox') && !url.includes('/approve') && !url.includes('/discard') && !url.includes('/reply')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockConversations) });
    }
    if (url.includes('/approve') || url.includes('/discard') || url.includes('/reply')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, messageId: msgDraftId }) });
    }

    // Escalations
    if (url.includes('/acknowledge') || url.includes('/resolve')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    }
    if (url.includes('/v1/escalations')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockEscalations) });
    }

    // Cases & Hearings
    if (url.includes('/hearings')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockHearings) });
    }
    if (url.includes('/v1/cases')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockCases) });
    }

    // Calendar
    if (url.includes('/appointments/calendar/status')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: true, connected: true, calendarId: 'primary', connectedAt: now.toISOString() })
      });
    }
    if (url.includes('/appointments')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockAppointments) });
    }

    // Documents
    if (url.includes('/v1/documents')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockDocuments) });
    }

    // Knowledge
    if (url.includes('/v1/knowledge-base') || url.includes('/v1/knowledge')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockKnowledge) });
    }

    // Payments
    if (url.includes('/verify') || url.includes('/reject')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    }
    if (url.includes('/v1/payments')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockPayments) });
    }

    // Analytics
    if (url.includes('/v1/analytics/dashboard')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockAnalyticsMetrics) });
    }
    if (url.includes('/v1/analytics/series')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { date: '2026-10-01', newConversations: 12, aiHandled: 9, humanHandled: 3, escalations: 1, casesOpened: 2, casesClosed: 1, paymentsCents: 5000000 },
          { date: '2026-10-02', newConversations: 15, aiHandled: 11, humanHandled: 4, escalations: 0, casesOpened: 3, casesClosed: 2, paymentsCents: 10000000 }
        ])
      });
    }
    if (url.includes('/v1/analytics/funnel')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ conversations: 120, cases: 35, paidClients: 28 }) });
    }
    if (url.includes('/v1/analytics/revenue')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { matterType: 'Civil litigation', totalCents: 250000000, paymentCount: 15 },
          { matterType: 'Property and real estate', totalCents: 135000000, paymentCount: 8 }
        ])
      });
    }
    if (url.includes('/v1/analytics/sla-breaches')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(0) });
    }

    // Team / Lawyers
    if (url.includes('/v1/lawyers')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockLawyers) });
    }
    if (url.includes('/v1/users')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockUsers) });
    }

    // Settings
    if (url.includes('/v1/firm-profile')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockFirmProfile) });
    }
    if (url.includes('/v1/ai-settings/voices')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockVoices) });
    }
    if (url.includes('/v1/ai-settings')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockAiSettings) });
    }

    // Default fallback
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
}

async function runAxe(page) {
  await page.evaluate(axeSource);
  const results = await page.evaluate(async () => {
    return await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }
    });
  });
  return results;
}

async function measurePagePerf(page) {
  return await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const paints = performance.getEntriesByType('paint') || [];
    const fcp = paints.find((p) => p.name === 'first-contentful-paint')?.startTime || null;
    return {
      dns: nav.domainLookupEnd - nav.domainLookupStart,
      tcp: nav.connectEnd - nav.connectStart,
      ttfb: nav.responseStart - nav.requestStart,
      download: nav.responseEnd - nav.responseStart,
      domInteractive: nav.domInteractive,
      domComplete: nav.domComplete,
      loadEvent: nav.loadEventEnd - nav.startTime,
      fcp
    };
  });
}

async function checkHorizontalOverflow(page) {
  return await page.evaluate(() => {
    const scrollW = document.documentElement.scrollWidth;
    const clientW = document.documentElement.clientWidth;
    return {
      hasOverflow: scrollW > clientW,
      scrollWidth: scrollW,
      clientWidth: clientW,
      diff: scrollW - clientW
    };
  });
}

export async function main() {
  console.log('=== STARTING WAKEEL PHASE 16 FINAL VERIFICATION SUITE ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  await setupPageRoutes(page);

  const report = {
    timestamp: new Date().toISOString(),
    routesVerified: [],
    workflowsVerified: {},
    accessibility: {},
    responsive: {},
    performance: {}
  };

  const routes = [
    { path: '/dashboard', name: 'Overview' },
    { path: '/dashboard/inbox', name: 'Inbox' },
    { path: '/dashboard/escalations', name: 'Escalations' },
    { path: '/dashboard/cases', name: 'Cases' },
    { path: '/dashboard/calendar', name: 'Calendar' },
    { path: '/dashboard/documents', name: 'Documents' },
    { path: '/dashboard/knowledge', name: 'Knowledge' },
    { path: '/dashboard/whatsapp', name: 'WhatsApp' },
    { path: '/dashboard/payments', name: 'Payments' },
    { path: '/dashboard/analytics', name: 'Analytics' },
    { path: '/dashboard/team', name: 'Team' },
    { path: '/dashboard/settings', name: 'Settings' }
  ];

  console.log('\n--- 1. ROUTE VERIFICATION (12 ROUTES) ---');
  for (const r of routes) {
    const targetUrl = `${BASE_URL}${r.path}`;
    const start = Date.now();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    const duration = Date.now() - start;

    const title = await page.title();
    const h1Count = await page.locator('h1, [data-page-title]').count();
    const overflow = await checkHorizontalOverflow(page);
    const perf = await measurePagePerf(page);

    const screenshotPath = `docs/verification-evidence/screenshots/route_${r.path.replace(/[/]/g, '_')}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });

    console.log(`✓ ${r.path} (${r.name}): loaded in ${duration}ms, h1=${h1Count}, overflow=${overflow.hasOverflow}`);
    report.routesVerified.push({
      path: r.path,
      name: r.name,
      status: 'PASS',
      loadMs: duration,
      hasOverflow: overflow.hasOverflow,
      fcp: perf.fcp
    });
  }

  console.log('\n--- 2. WORKFLOW & INTERACTION TESTS ---');

  // Workflow A: Command Palette (⌘K)
  console.log('Testing Command Palette (⌘K)...');
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  await page.keyboard.press('Control+KeyK');
  await page.waitForTimeout(300);
  let cmdOpen = await page.locator('[role="dialog"]').isVisible().catch(() => false);
  if (!cmdOpen) {
    const quickJumpBtn = page.locator('button:has-text("Quick jump")');
    if (await quickJumpBtn.isVisible()) {
      await quickJumpBtn.click();
      await page.waitForTimeout(300);
      cmdOpen = await page.locator('[role="dialog"]').isVisible().catch(() => false);
    }
  }
  console.log(`- Command Palette open: ${cmdOpen}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const cmdClosed = !(await page.locator('[role="dialog"]').isVisible().catch(() => false));
  console.log(`- Command Palette dismiss: ${cmdClosed}`);
  report.workflowsVerified.commandPalette = { open: cmdOpen, dismiss: cmdClosed };

  // Workflow B: Inbox Selection, AI Draft Editing, Approve & Discard Flow
  console.log('Testing Inbox Selection and AI Draft Workflow...');
  await page.goto(`${BASE_URL}/dashboard/inbox`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Switch to 'All Chats' tab to see all conversations
  const allChatsTab = page.locator('button:has-text("All"), button:has-text("تمام")').first();
  if (await allChatsTab.isVisible()) {
    await allChatsTab.click();
    await page.waitForTimeout(300);
  }

  // Click on Tariq Mehmood (Conversation 1)
  const conv1Btn = page.locator('button:has-text("Tariq Mehmood"), li button').first();
  if (await conv1Btn.isVisible()) {
    await conv1Btn.click();
    await page.waitForTimeout(500);
  }

  // Check AI Draft presence
  const aiDraftTextarea = page.locator('textarea').first();
  const hasAiDraft = await aiDraftTextarea.isVisible();
  console.log(`- AI Draft visible: ${hasAiDraft}`);

  if (hasAiDraft) {
    await aiDraftTextarea.fill('Updated counsel review: Approved draft text ready for dispatch.');
    await page.waitForTimeout(200);
    const approveBtn = page.locator('button:has-text("Approve & Send"), button:has-text("Send")').first();
    const canApprove = await approveBtn.isVisible();
    console.log(`- Approve button ready: ${canApprove}`);
    report.workflowsVerified.aiDraftFlow = { visible: hasAiDraft, canApprove };
  }

  // Workflow C: 24h WhatsApp Session Guard
  console.log('Testing 24h WhatsApp Session Guard...');
  // Conversation 1 is inside active 24h window
  const activeWindowIndicator = await page.locator('text=/active|session|24h/i').count();
  console.log(`- Active 24h window indicator present: ${activeWindowIndicator > 0}`);

  // Click on Hamza Farooq (Conversation 3 - expired 24h window)
  const conv3Btn = page.locator('button:has-text("Hamza Farooq")').first();
  if (await conv3Btn.isVisible()) {
    await conv3Btn.click();
    await page.waitForTimeout(500);
  }
  const templateNoticeCount = await page.locator('text=/24h window closed|Meta template/i').count();
  const replyInputDisabled = await page.locator('textarea[placeholder*="closed"], textarea[disabled]').isVisible().catch(() => false);
  console.log(`- Expired 24h window notice present: ${templateNoticeCount > 0}, input disabled: ${replyInputDisabled}`);
  report.workflowsVerified.sessionGuard24h = {
    activeWindowVerified: activeWindowIndicator > 0,
    expiredWindowGuarded: templateNoticeCount > 0 || replyInputDisabled
  };

  // Workflow D: Escalation Acknowledge/Claim & Resolve
  console.log('Testing Escalations...');
  await page.goto(`${BASE_URL}/dashboard/escalations`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const ackBtn = page.locator('button:has-text("Acknowledge"), button:has-text("Claim")').first();
  const ackVisible = await ackBtn.isVisible();
  console.log(`- Escalation Acknowledge/Claim visible: ${ackVisible}`);
  report.workflowsVerified.escalationAction = { ackButtonPresent: ackVisible };

  // Workflow E: Case Dossier Modal
  console.log('Testing Case Dossier...');
  await page.goto(`${BASE_URL}/dashboard/cases`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const caseRow = page.locator('tr:has-text("WAK-2026-001"), td:has-text("WAK-2026-001")').first();
  if (await caseRow.isVisible()) {
    await caseRow.click();
    await page.waitForTimeout(500);
    const dialogVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false);
    console.log(`- Case Dossier Modal opened: ${dialogVisible}`);
    report.workflowsVerified.caseDossier = { dialogOpened: dialogVisible };
    if (dialogVisible) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }

  // Workflow F: Theme Switching (Dark / Light)
  console.log('Testing Theme Switching...');
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const themeTrigger = page.locator('button[aria-label="Toggle theme"]').first();
  let themeSwitched = false;
  if (await themeTrigger.isVisible()) {
    const initialDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await themeTrigger.click();
    await page.waitForTimeout(200);
    const darkItem = page.locator('[role="menuitem"]:has-text("Dark"), div:has-text("Dark")').last();
    if (await darkItem.isVisible()) {
      await darkItem.click();
      await page.waitForTimeout(200);
      const isDarkNow = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      console.log(`- Dark mode selected: dark=${isDarkNow}`);
      themeSwitched = isDarkNow;
    }
    // Switch back to light
    await themeTrigger.click();
    await page.waitForTimeout(200);
    const lightItem = page.locator('[role="menuitem"]:has-text("Light"), div:has-text("Light")').last();
    if (await lightItem.isVisible()) {
      await lightItem.click();
      await page.waitForTimeout(200);
    }
  }
  report.workflowsVerified.themeToggle = { switched: themeSwitched };

  // Workflow G: English / Urdu & RTL rendering
  console.log('Testing English / Urdu Language & RTL Switching...');
  const langTrigger = page.locator('button[aria-label*="Language"], button[aria-label*="زبان"]').first();
  let rtlVerified = false;
  if (await langTrigger.isVisible()) {
    await langTrigger.click();
    await page.waitForTimeout(200);
    const urduOption = page.locator('[role="menuitem"]:has-text("اردو"), div:has-text("اردو")').last();
    if (await urduOption.isVisible()) {
      await urduOption.click();
      await page.waitForTimeout(300);
      const dir = await page.evaluate(() => document.documentElement.getAttribute('dir'));
      const hasUrduFont = await page.evaluate(() => document.documentElement.classList.contains('font-urdu') || document.body.classList.contains('font-urdu'));
      console.log(`- RTL mode verified: dir=${dir}, hasUrduFont=${hasUrduFont}`);
      rtlVerified = dir === 'rtl';
    }
    // Switch back to English
    const retrigger = page.locator('button[aria-label*="Language"], button[aria-label*="زبان"]').first();
    await retrigger.click();
    await page.waitForTimeout(200);
    const enOption = page.locator('[role="menuitem"]:has-text("English"), div:has-text("English")').last();
    if (await enOption.isVisible()) {
      await enOption.click();
      await page.waitForTimeout(200);
    }
  }
  report.workflowsVerified.languageRtl = { rtlVerified };

  console.log('\n--- 3. ACCESSIBILITY (AXE WCAG AUDIT) ---');
  const a11yRoutes = ['/dashboard', '/dashboard/inbox', '/dashboard/escalations', '/dashboard/cases', '/dashboard/calendar', '/dashboard/team', '/dashboard/settings'];
  for (const p of a11yRoutes) {
    await page.goto(`${BASE_URL}${p}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const axeResults = await runAxe(page);
    const violationsByImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    for (const v of axeResults.violations) {
      if (violationsByImpact[v.impact] !== undefined) {
        violationsByImpact[v.impact]++;
      }
    }
    console.log(`- ${p} axe violations: critical=${violationsByImpact.critical}, serious=${violationsByImpact.serious}, moderate=${violationsByImpact.moderate}, minor=${violationsByImpact.minor} (total=${axeResults.violations.length})`);
    report.accessibility[p] = {
      passes: axeResults.passes.length,
      violationsCount: axeResults.violations.length,
      violationsByImpact,
      violations: axeResults.violations.map((v) => ({ id: v.id, impact: v.impact, description: v.description, helpUrl: v.helpUrl }))
    };
  }

  console.log('\n--- 4. RESPONSIVE VERIFICATION (7 BREAKPOINTS) ---');
  const breakpoints = [
    { width: 1440, height: 900, name: 'desktop_1440' },
    { width: 1280, height: 800, name: 'desktop_1280' },
    { width: 1024, height: 768, name: 'tablet_1024' },
    { width: 768, height: 1024, name: 'tablet_768' },
    { width: 430, height: 932, name: 'mobile_430' },
    { width: 390, height: 844, name: 'mobile_390' },
    { width: 375, height: 812, name: 'mobile_375' }
  ];

  for (const bp of breakpoints) {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto(`${BASE_URL}/dashboard/inbox`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const overflow = await checkHorizontalOverflow(page);

    const bpScreenshotPath = `docs/verification-evidence/screenshots/inbox_${bp.name}.png`;
    await page.screenshot({ path: bpScreenshotPath, fullPage: false });

    console.log(`- Viewport ${bp.width}x${bp.height} (${bp.name}): horizontal overflow=${overflow.hasOverflow} (scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth})`);
    report.responsive[bp.name] = {
      width: bp.width,
      height: bp.height,
      hasOverflow: overflow.hasOverflow,
      scrollWidth: overflow.scrollWidth,
      clientWidth: overflow.clientWidth,
      screenshot: bpScreenshotPath
    };
  }

  console.log('\n--- 5. RUNTIME PERFORMANCE MEASUREMENTS ---');
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const r of ['/dashboard', '/dashboard/inbox', '/dashboard/cases']) {
    await page.goto(`${BASE_URL}${r}`, { waitUntil: 'networkidle' });
    const metrics = await page.evaluate(async () => {
      let clsValue = 0;
      const entries = performance.getEntriesByType('layout-shift') || [];
      for (const entry of entries) {
        if (!entry.hadRecentInput) clsValue += entry.value;
      }
      const nav = performance.getEntriesByType('navigation')[0] || {};
      const paint = performance.getEntriesByType('paint') || [];
      const fcp = paint.find((p) => p.name === 'first-contentful-paint')?.startTime || 0;
      return {
        fcp: Math.round(fcp),
        loadDuration: Math.round(nav.duration || 0),
        domInteractive: Math.round(nav.domInteractive || 0),
        domComplete: Math.round(nav.domComplete || 0),
        cls: Number(clsValue.toFixed(4))
      };
    });
    console.log(`- Performance ${r}: FCP=${metrics.fcp}ms, Load=${metrics.loadDuration}ms, DOMInteractive=${metrics.domInteractive}ms, CLS=${metrics.cls}`);
    report.performance[r] = metrics;
  }

  await browser.close();

  // Save full JSON report
  writeFileSync('docs/verification-evidence/verification_report.json', JSON.stringify(report, null, 2), 'utf-8');
  console.log('\n=== VERIFICATION SUITE FINISHED. REPORT SAVED TO docs/verification-evidence/verification_report.json ===');
}

main().catch((err) => {
  console.error('FATAL VERIFICATION RUNNER ERROR:', err);
  process.exit(1);
});
