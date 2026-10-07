# Pakistani Legal Compliance & Ethical Governance Framework

## 1. Statutory & Ethical Hierarchy

Wakeel operates at the intersection of technological automation and the Pakistani judicial system. To ensure that law practices utilizing Wakeel remain in full compliance with bar council ethics, criminal cyber laws, and evidence rules, the platform is architected around four primary legal frameworks:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PAKISTANI LEGAL COMPLIANCE PILLARS                   │
│                                                                        │
│  ┌────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │  Pakistan Bar Council  │  │  Prevention of Electronic Crimes Act │  │
│  │ Canons of Conduct 1976 │  │             (PECA 2016)              │  │
│  │ • Ban on Advertising   │  │ • Section 29: Traffic Data Retention │  │
│  │ • Client Privilege     │  │ • Section 3 & 4: Unauthorized Access │  │
│  └────────────────────────┘  └──────────────────────────────────────┘  │
│                                                                        │
│  ┌────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │   Qanun-e-Shahadat     │  │        State Bank of Pakistan        │  │
│  │      Order 1984        │  │       Payment Rails & Raast          │  │
│  │ • Art 9/12: Privilege  │  │ • Integer Money (Paisa Accuracy)     │  │
│  │ • Art 164: Digital Ev. │  │ • Encrypted Receiving Credentials    │  │
│  └────────────────────────┘  └──────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Pakistan Bar Council (PBC) Canons of Professional Conduct

### 2.1 Rule 134–144: Absolute Prohibition on Legal Advertising & Solicitation
Under the Canons of Professional Conduct adopted by the Pakistan Bar Council, advocates are strictly barred from advertising their services, touting, or soliciting clients directly or indirectly.

**System Architectural Enforcement:**
1. **Exclusion of `MARKETING` Templates:** Wakeel's template engine permanently omits the `MARKETING` category ([D-005](file:///f:/lawyer_agency/docs/decision-log.md)). The system refuses to submit promotional or marketing templates to Meta.
2. **Zero Unsolicited Outbound Messaging:** Proactive outbound WhatsApp messages are restricted to utility alerts (court hearing reminders, appointment confirmations, fee receipts) requested by existing clients.
3. **Mandatory AI Identification (FR-AI-01):** The very first message sent to any WhatsApp user explicitly identifies the assistant as an administrative AI assistant and clarifies that it **does not give legal advice**.

### 2.2 Rule 154–159: Advocate-Client Confidentiality & Professional Privilege
An advocate is ethically bound to preserve client confidences in perpetuity.

**System Architectural Enforcement:**
1. **Zero External AI Egress for Evidentiary Documents (D-005):** Client-submitted documents (CNICs, FIRs, witness voice notes) are classified as Tier 3 (T3). They are embedded locally via `multilingual-e5-small` in Docker and never dispatched to OpenAI, Anthropic, or external cloud LLMs.
2. **Database-Enforced Row-Level Security:** PostgreSQL `FORCE ROW LEVEL SECURITY` guarantees that no advocate, paralegal, or compromised tenant can access another firm's client files.

---

## 3. Prevention of Electronic Crimes Act 2016 (PECA)

### 3.1 Section 29: Mandatory Retention of Traffic Data
Section 29 of PECA 2016 requires digital service providers to retain traffic data for a minimum statutory period (90 days or longer as prescribed by investigation agencies) for cybercrime forensics.

**System Architectural Enforcement:**
- **Immutable Audit Trail (`app.audit_logs`):** Partitioned monthly and retained for **3 continuous years**.
- **Tamper-Proof Grants:** Application user role `app_user` has `REVOKE UPDATE, DELETE` applied, preventing malicious manipulation of digital access trails.

### 3.2 Sections 3 & 4: Unauthorized Access and Data Copying
PECA criminalizes unauthorized access to information systems and unlawful copying of confidential data.
- **Fail-Closed Isolation:** If a session token lacks a valid `tenantId`, PostgreSQL queries resolve to `NULL` rows, blocking unauthorized lateral traversal.
- **Cryptographic Token Protection:** All OAuth tokens, WhatsApp credentials, and bank account numbers are encrypted at rest using **AES-256-GCM**.

---

## 4. Qanun-e-Shahadat Order 1984 (QSO) — Evidentiary Admissibility

### 4.1 Articles 9 & 12: Professional Communication Privilege
Communications made to an advocate in the course and for the purpose of their employment are privileged and cannot be disclosed without the client's express written consent.
- Wakeel enforces data tiering where client case facts require explicit advocate authorization before export.

### 4.2 Article 164: Admissibility of Electronic Records & Digital Audio
Under Article 164 of the QSO, modern digital evidence (WhatsApp voice notes, call recordings, chat transcripts) is admissible in Pakistani courts provided its chain of custody and cryptographic integrity can be certified.

**System Architectural Enforcement:**
- **SHA-256 Prompt Version Hashing:** Every prompt template in `platform.prompt_versions` carries an immutable SHA-256 hash digest.
- **Correlation Trace IDs:** Inbound WhatsApp messages, AI turns, and voice call transcripts are linked via a continuous `correlationId UUID`, providing a verifiable chain of custody for court production.

---

## 5. State Bank of Pakistan (SBP) Financial Regulations

- **Integer Money Invariant:** To prevent rounding loss and dispute in legal fees, all monetary amounts are stored as integer paisas in `app.payments.amountCents`.
- **Encrypted Banking Credentials:** Firm bank accounts, IBANs, and mobile till numbers are encrypted in `app.firm_payment_details` to mitigate electronic payment spoofing and fraud.
