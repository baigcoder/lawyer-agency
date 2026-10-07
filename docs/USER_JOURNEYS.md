# Wakeel — User Journeys

**Status:** IMPLEMENTED BASELINE & LIFECYCLE SPECIFICATION  
**Classification:** End-to-End User Journeys and Operational Flows  
**Cross-References:** `docs/phases/phase-01-product-requirements.md`, `docs/decision-log.md` (D-109 to D-125)

---

## Journey 1: Client WhatsApp Intake & Consultation Booking

**Actor:** Prospective Client (Litigant)  
**Channel:** WhatsApp  
**Language:** Urdu / Roman Urdu / English  

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant WA as WhatsApp Transport (Evolution)
    participant Orchestrator as AI Orchestrator
    participant Intake as Intake Agent
    participant Slots as Slot Finder
    participant DB as Postgres (RLS App)
    actor Lawyer

    Client->>WA: "Assalam o alaikum, mujhe property transfer ke baare me poochna hai"
    WA->>Orchestrator: Inbound Webhook (Normalized T2 Text)
    Orchestrator->>Orchestrator: Detect Language (ROMAN_UR) & Run Fast Route
    Orchestrator-->>Client: First Disclosure: "Walaikum Assalam. Main Wakeel ka automated assistant hoon..."
    Orchestrator->>Intake: Process Intake Turn
    Intake-->>Client: "Yeh property kis shehar me waqe hai aur kya registry aapke naam hai?"
    Client->>WA: "Lahore me hai, registry abhi transfer honi hai"
    Intake->>DB: Save Intake Facts (City: Lahore, Category: Property)
    Intake->>Slots: Get Available Lawyer Consultation Slots
    Slots-->>Client: "Advocate Malik Rashid ke paas yeh waqt dastiyab hain:\n1) Kal 3:00 PM\n2) Parson 11:00 AM\nReplay with 1 or 2 to book."
    Client->>WA: "1"
    Orchestrator->>DB: Create Appointment (PENDING/CONFIRMED)
    Orchestrator->>Lawyer: Google Calendar Sync + Push Notification
    Orchestrator-->>Client: Confirmation sent with office address and instructions
```

---

## Journey 2: Emergency Safety Escalation & Lawyer Handoff

**Actor:** Distressed Client in Crisis  
**Trigger:** Keyword match (Domestic Violence, Active Police Custody/FIR, Threat of Self-Harm, Immediate Court Deadline ≤48h)  

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant WA as WhatsApp Transport
    participant Safety as Escalation Scanner (Regex)
    participant DB as Postgres (RLS App)
    participant Dispatcher as Notification Dispatcher
    actor Lawyer

    Client->>WA: "Police mere bhai ko baghair warrant le gayi hai, kal subah peshi hai madad karein"
    WA->>Safety: Evaluate Inbound Message
    Safety->>Safety: Trigger Match: ARREST + URGENT_DEADLINE
    Note over Safety: Generative AI Pipeline Bypassed Completely
    Safety->>DB: Create Escalation (Trigger: POLICE_ARREST, Status: OPEN)
    Safety->>DB: Transition Conversation to HUMAN_REQUIRED
    Safety->>DB: Generate Structured Handoff Brief
    Safety->>Dispatcher: Publish escalation.created event
    Dispatcher->>Lawyer: High-Priority Dashboard Alert + Web Push + Audio Ping
    Safety-->>Client: "Aapka paighaam foran on-duty advocate ko pohancha diya gaya hai. Hum jald raabta karenge. Emergency helpline: 15."
    Lawyer->>DB: Inspects Handoff Brief in Dashboard Inbox
    Lawyer->>DB: Acknowledge Escalation & Sends Direct WhatsApp Reply
```

---

## Journey 3: Fee Collection, Screenshot Verification & PDF Receipt

**Actor:** Client & Law Firm Managing Partner / Clerk  
**Context:** Consultation Fee or Retainer Payment via JazzCash / Easypaisa / Bank Transfer  

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant WA as WhatsApp Transport
    participant DB as Postgres (RLS App)
    participant Worker as Background Worker
    actor Lawyer

    Lawyer->>DB: Click "Request Fee" on Client / Appointment (PKR 5,000)
    Worker->>WA: Send Fee Instructions (Bank Title, IBAN, JazzCash Till Number)
    Client->>WA: Transfers funds and uploads WhatsApp Screenshot proof
    WA->>DB: Inbound Image stored in encrypted storage (T3)
    WA->>DB: Transition Payment status to PENDING
    Lawyer->>DB: Inspects Screenshot in Dashboard /payments or Inbox
    Lawyer->>DB: Clicks "Verify & Issue Receipt"
    DB->>Worker: Trigger payment.succeeded Domain Event
    Worker->>Worker: Render Branded PDF Receipt + Appointment Confirmation PDF
    Worker->>WA: Send PDF Receipt + Karachi-Time Meeting Details to Client
    Worker->>Lawyer: Send Email Receipt Copy to Firm Owner
```

---

## Journey 4: Firm Onboarding, QR Pairing & Simulated Test

**Actor:** Law Firm Managing Partner  
**Surface:** Next.js Dashboard (`/onboarding` & `/dashboard/setup`)  

1. **Clerk Signup & Org Creation:** Partner signs up with email, creates organization `"Malik & Associates Legal Consultants"`.
2. **Onboarding Wizard (`/onboarding`):**
   - Step 1: Legal name, city (Lahore), office address, team size.
   - Step 2: Practice areas (Civil Litigation, Family Law, Property/Real Estate).
   - Step 3: Supported languages (`EN`, `UR`, `ROMAN_URDU`), office hours (9:00 AM – 6:00 PM).
   - Step 4: Admin confirmation.
3. **Setup Hub (`/dashboard/setup`):**
   - Step 1: Profile review and verification.
   - Step 2: Connect WhatsApp: Displays real-time Evolution API QR code. Advocate scans QR with firm WhatsApp phone. Socket transitions to `connected`.
   - Step 3: Interactive Simulated AI Test: Advocate sends a pretend client message directly from the UI (`"Mujhe talaq aur khula ke mutalliq maloomat chahiye"`). Full AI pipeline processes the message and renders the live generated reply in the UI sandbox.
4. **Go-Live:** Firm connects with clients with zero Meta verification roadblocks.
