# Wakeel — Product Vision

**Status:** IMPLEMENTED BASELINE & OPERATIONAL ROADMAP  
**Classification:** Core Product Strategy & Vision Document  
**Target Market:** Law Firms, Advocates, and Legal Practices in Pakistan (Karachi, Lahore, Islamabad, Rawalpindi, Peshawar, Quetta, Multan, Faisalabad)  

---

## 1. Executive Summary

**Wakeel** (وکيل) is the **WhatsApp front desk and operational operating system for Pakistani law firms**.

Wakeel is not a generic AI chatbot, an experimental toy, or a consumer legal-advice bot. It is an enterprise-grade, multi-tenant B2B platform that turns WhatsApp—the primary communication channel in Pakistan—into an automated, compliant, and dignified front desk for advocates and law practices.

### The Problem in Pakistani Legal Practice
1. **Unstructured Client Communication:** Prospective and existing clients contact lawyers at all hours via personal WhatsApp numbers, sending unorganized voice notes, blurry phone photos of court documents (fard, challan, FIR, summons, nikahnama), and fragmented messages.
2. **Lawyer Burnout & Triage Failure:** Advocates spend hours answering repetitive basic questions (fees, office location, consultation timings, vakalatnama requirements) instead of doing legal research, court appearances, and client advocacy.
3. **Lost Retainers and Consultation Fees:** Enquiries slip through the cracks without structured intake. Lawyers often provide informal advice without securing consultation fees upfront or scheduling proper appointments.
4. **Court Diary & Hearing Chaos:** Pakistan's court system (Civil Courts, District & Sessions Courts, High Courts, Supreme Court) operates on strict morning cause lists and physical hearings. Missed client reminders and unscheduled meetings conflict directly with morning court hours.
5. **Language & Literacy Realities:** Clients communicate in Urdu (both Arabic script and Roman Urdu) and English, frequently mixing them within a single thread, and heavily rely on WhatsApp voice notes.

### The Wakeel Solution
Wakeel provides a dedicated WhatsApp presence for the firm that:
- **Intakes clients gracefully** through automated question flows in the client's chosen language (English, Urdu, or Roman Urdu).
- **Enforces strict legal ethical boundaries:** AI explicitly discloses its automated nature on the first turn, never provides legal conclusions or guarantees, and only answers general procedural questions grounded in the firm's verified knowledge base.
- **Transcribes and responds to voice notes** seamlessly via specialized STT/TTS models.
- **Takes phone calls autonomously:** Via WhatsApp Cloud Calling WebRTC or QR/Wavoip live audio, answering calls using an AI receptionist.
- **Collects fees and verifies receipts:** Shares bank and wallet payment details (JazzCash, Easypaisa, Meezan/HBL bank accounts), prompts clients for payment screenshots, and issues branded PDF receipts with appointment confirmations upon lawyer verification.
- **Schedules consultations:** Checks advocate availability against Pakistan public holidays and court commitments, and synchronizes with Google Calendar.
- **Escalates urgent emergencies instantly:** Implements hard deterministic triggers for family violence, active arrests, immediate court deadlines (≤48h), and suicide/self-harm, bypassing automation and generating structured **Lawyer Handoff Briefs**.
- **Equips legal staff with a high-density, trustworthy web dashboard:** Enabling partners, associates, and clerks to manage cases, court hearings, document requests, clients, and WhatsApp communications in real time.

---

## 2. Market Context & Pakistani Legal Framework

### 2.1 The Jurisdiction and Professional Standards
The legal profession in Pakistan is governed by the **Legal Practitioners and Bar Councils Act 1973** and the **Pakistan Legal Practitioners and Bar Councils Rules 1976**. Rule 134–144 strictly regulates attorney conduct, client confidentiality, and prohibits misleading advertising. 

Wakeel is built deliberately around these constraints:
- **No Unauthorized Practice of Law (UPL):** Wakeel assists the lawyer; it does not practice law. Every communication from the automated receptionist identifies itself as an assistant (`"میں وکیل نہیں ہوں..." / "I am an automated assistant..."`), collecting background information for human advocate review.
- **Advocate-Client Privilege & Confidentiality:** Client disclosures and documents must remain confidential. In Wakeel's data architecture, Tier 3 client documents (FIRs, sale deeds, NIC copies) are stored in tenant-isolated encrypted storage and are **never** passed to external third-party public LLMs.
- **Data Protection Compliance:** Built in anticipation of the **Personal Data Protection Bill (PDPB)** and compliant with the **Prevention of Electronic Crimes Act 2016 (PECA)**.

### 2.2 Communication Realities in Pakistan
- WhatsApp penetration in Pakistan exceeds 80% among smartphone users.
- Over 65% of legal consumer queries are typed in Roman Urdu (`"mera property ka masla hai..."`) or sent as WhatsApp audio notes.
- Advocates cannot force Pakistani litigants to use a separate client portal, download an app, or fill out web forms. The client remains exclusively on WhatsApp, while the law firm operates from a desktop/tablet command center.

---

## 3. Product Mission, Vision, and Objectives

### 3.1 Mission
To elevate the administrative efficiency and professional stature of Pakistani law firms by automating client front-desk intake, scheduling, and fee collection over WhatsApp while upholding the highest standards of legal ethics, tenant privacy, and client care.

### 3.2 Vision
To become the definitive legal operating system for South Asian legal practices, serving as the trusted conduit between millions of citizens seeking legal recourse and the advocates sworn to represent them.

### 3.3 Strategic 3-Year Objectives
| Horizon | Milestone | Target Metrics |
|---|---|---|
| **Horizon 1 (Current)** | Production stability for pilot and official WhatsApp firms; sub-500ms webhook ingest; zero RLS data leaks; reliable Roman Urdu/Urdu voice note handling. | 99.9% uptime, 100% deterministic safety recall, <1.2s median AI response time. |
| **Horizon 2 (Scale)** | Native Cause List integration with Lahore High Court (LHC) and Sindh High Court (SHC); automated case tracking and cause-list scraping; automated filing checklist packs. | 500+ active Pakistani law firms; 250,000+ monthly intakes processed. |
| **Horizon 3 (Ecosystem)** | End-to-end legal billing with automated e-stamp verification; biometric KYC integrations for NADRA e-Sahulat; automated vakalatnama generation with digital signature capture. | Regional expansion into GCC Pakistani diaspora practices (Dubai, Riyadh, Doha). |

---

## 4. Architectural Tenets & Operating Values

1. **Lawyer in Control (Human-in-the-Loop):** The platform empowers advocates. The firm owner controls auto-reply toggles, draft approvals, fee amounts, and escalation rules.
2. **Deterministic Safety over Generative Fluency:** When a client mentions domestic violence, arrest, child custody urgency, or self-harm, Wakeel halts generative replies immediately, alerts the on-duty advocate, and provides emergency contact instructions.
3. **Database-Enforced Tenant Isolation:** Multi-tenancy is enforced at the database engine level via PostgreSQL Row-Level Security (`FORCE RLS`) with transaction-bound session parameters, not application-level `WHERE tenant_id = ...` clauses.
4. **Mirror-the-Client Language Discipline:** If the client writes in Urdu, Wakeel replies in Urdu. If the client types Roman Urdu, Wakeel replies in clear Roman Urdu. If they speak English, Wakeel speaks English.
5. **No Visual Gimmicks:** The advocate's dashboard is designed as high-density, calm, and respectful legal technology—rooted in typography, fast data access, clear statuses, and keyboard efficiency.
