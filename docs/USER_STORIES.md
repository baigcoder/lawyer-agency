# Wakeel — User Stories & Acceptance Criteria

**Status:** IMPLEMENTED BASELINE & ACCEPTANCE SPECIFICATION  
**Classification:** Functional User Stories across all Product Modules  
**Target Quality Bar:** Strict Verification Standards & Testable Assertions  

---

## 1. Module: WhatsApp Intake & Messaging

### US-INT-01: Automated AI Disclosure & Language Mirroring
- **As a** prospective client reaching out to a law firm on WhatsApp,
- **I want** to immediately know that I am speaking to an automated assistant and have it reply in my chosen language (English, Urdu, or Roman Urdu),
- **So that** I understand the nature of the conversation and can explain my situation comfortably.
- **Acceptance Criteria:**
  - *Given* a new conversation without prior messages,
  - *When* the client sends their first message in Urdu script,
  - *Then* the system records `firstDisclosureSent = true`, prepends the firm's AI disclosure in Nastaliq Urdu, and continues intake in Urdu.
  - *Given* a message written in Roman Urdu,
  - *Then* the language classifier outputs `ROMAN_UR` and system replies are formatted in Roman Urdu.

### US-INT-02: Single-Question Intake Progression
- **As a** prospective client,
- **I want** the intake assistant to ask me one focused question at a time,
- **So that** I do not feel overwhelmed by long questionnaires on my phone.
- **Acceptance Criteria:**
  - The intake agent extracts disclosed facts and identifies the next missing required field (matter type, city, opponent name, urgency).
  - Every outbound turn asks exactly one question until sufficient intake qualification criteria are satisfied.

---

## 2. Module: Triage & Escalation Engine

### US-ESC-01: Deterministic Safety Keyword Escalation
- **As a** firm managing partner,
- **I want** emergency legal situations (domestic violence, arrest, self-harm, court deadline ≤48h) to bypass generative AI immediately,
- **So that** vulnerable clients receive emergency contact instructions and my on-duty advocates are notified instantly.
- **Acceptance Criteria:**
  - *Given* an inbound message containing safety keywords (e.g., *"arrest"*, *"thana"*, *"tashaddud"*, *"marna chahta hoon"*),
  - *When* the regex scanner evaluates the payload,
  - *Then* the generative LLM is never invoked; an `app.escalations` record is created; status transitions to `OPEN`; conversation state becomes `HUMAN_REQUIRED`; and an immediate outbox notification event is published.

### US-ESC-02: Structured Lawyer Handoff Brief
- **As an** advocate responding to an escalated conversation,
- **I want** to see a concise structured summary of the situation on my dashboard,
- **So that** I do not waste time scrolling through dozens of WhatsApp chat bubbles.
- **Acceptance Criteria:**
  - The dashboard displays the trigger reason, client-stated facts, extracted urgency, and recommended next action in `HandoffBriefView`.

---

## 3. Module: Consultations & Calendar Sync

### US-CAL-01: Numbered Slot Selection on WhatsApp
- **As a** qualified client,
- **I want** to receive up to 3 available consultation time slots and book by replying with a number,
- **So that** I can schedule my lawyer meeting friction-free on WhatsApp.
- **Acceptance Criteria:**
  - *When* intake qualifies the client, `SlotFinderService` queries `app.lawyer_availability`, filters out existing `PENDING`/`CONFIRMED` appointments and official Pakistan public holidays, and offers up to 3 numbered options.
  - Replying with `"1"`, `"2"`, or `"3"` executes `AppointmentsService.book` and locks the slot.

### US-CAL-02: Google Calendar Integration
- **As an** associate advocate,
- **I want** client bookings in Wakeel to appear on my personal Google Calendar,
- **So that** my court schedule and client consultations remain in sync.
- **Acceptance Criteria:**
  - When an appointment is confirmed, Wakeel updates the advocate's Google Calendar via OAuth API (`GoogleCalendarService`).
  - Rescheduling or cancellation in Wakeel updates or deletes the Google event accordingly.

---

## 4. Module: Pakistan Fee Collection & PDF Receipts

### US-PAY-01: Direct Bank & Wallet Instructions
- **As an** advocate,
- **I want** to send firm JazzCash, Easypaisa, or bank account details to a client with one click,
- **So that** the client can pay the consultation fee without requiring a credit card or complex payment portal.
- **Acceptance Criteria:**
  - Fee prompt delivers account title, IBAN, bank name, and wallet till numbers stored encrypted in `app.firm_payment_details`.

### US-PAY-02: Screenshot Verification & Automated PDF Receipt
- **As a** firm managing partner,
- **I want** to verify a client's payment screenshot and automatically issue an official WhatsApp PDF receipt,
- **So that** the client receives proof of payment and our firm maintains clean bookkeeping.
- **Acceptance Criteria:**
  - Clicking "Verify Payment" in dashboard triggers `PaymentReceiptHandler`.
  - The worker compiles a branded PDF receipt, links appointment details if present, and dispatches the PDF to the client's WhatsApp.

---

## 5. Module: Case & Court Diary Management

### US-CAS-01: Lead-to-Case Conversion
- **As a** lawyer reviewing an intake conversation,
- **I want** to convert the conversation into an official firm case matter with one click,
- **So that** all gathered intake facts and documents transfer directly into active casework.
- **Acceptance Criteria:**
  - The inbox conversation menu provides a `"Convert to case"` action.
  - Submitting generates an `app.cases` record with a unique reference (`CR-YYYY-XXXX`), matter type, assigned lawyer, and status `ENGAGED`.

### US-CAS-02: Court Hearing Reminders
- **As a** court clerk (*Munshi*),
- **I want** to log the next court hearing date and courtroom for a case,
- **So that** automated reminders notify both our advocates and the client 24 hours prior.
- **Acceptance Criteria:**
  - Clerk logs hearing date and court name in `CourtHearing`.
  - A scheduled BullMQ job (`hearing-reminder`) sends dashboard push alerts and an in-window WhatsApp reminder ~24 hours before the hearing.
