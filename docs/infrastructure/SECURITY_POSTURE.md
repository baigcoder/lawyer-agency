# Infrastructure Security Posture — Defense-in-Depth Architecture

## 1. Threat Landscape & Legal Context in Pakistan

Operating a multi-tenant legal platform in Pakistan entails high-stakes confidentiality obligations under the **Pakistan Bar Council Canons of Professional Conduct** and the **Prevention of Electronic Crimes Act 2016 (PECA)**. Law firms handle sensitive civil disputes, property litigations, family khula filings, and criminal FIRs. Opposing parties or state adversaries may actively attempt digital espionage, cross-tenant data extraction, or message spoofing.

Wakeel adopts a **Zero-Trust, Defense-in-Depth** security posture where no single architectural boundary is relied upon exclusively.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Layer 1: Network Edge                           │
│     • UFW Firewall (Deny Inbound) • Let's Encrypt TLS 1.3              │
│     • NGINX Rate Limiting • Fail2ban Brute-Force Shield               │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Layer 2: Application Perimeter                    │
│     • Clerk JWT Verification (JWKS) • Same-Origin Proxying (Zero CORS) │
│     • Zod Input Boundary Validation • Webhook HMAC Signature Check     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Layer 3: Cryptography & Secrets                     │
│     • AES-256-GCM for All OAuth & Bank Credentials at Rest             │
│     • 64-Hex Master Key in Memory Only • Scoped Ephemeral Tokens       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Layer 4: Database Kernel Isolation                   │
│     • Non-Owner Runtime Role (app_user NOBYPASSRLS)                    │
│     • PostgreSQL FORCE ROW LEVEL SECURITY (app.tenant_id GUC)          │
│     • Append-Only Audit Logs (REVOKE UPDATE, DELETE)                   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Layer 5: AI Data Classification                    │
│     • T1/T2/T3 Tiered Pipeline • T3 Never Egresses to Remote LLMs      │
│     • In-Cluster 384-Dim Embeddings • PII Regex Scrubbing (CNIC/Phone) │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Six-Tier Defense-in-Depth Specifications

### 2.1 Layer 1: Network Edge & Host Hardening
- **Minimal Surface Exposure:** Only ports `80`, `443`, `5060` (SIP), and `40000-40031` (WebRTC) accept public internet packets. PostgreSQL (`5432`), Redis (`6379`), and local embeddings (`8081`) bind exclusively to private Docker networks.
- **DDoS & Rate Limiting:** NGINX implements leaky-bucket rate limiting (`limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s`).
- **Fail2ban Integration:** Automatically bans IP addresses exhibiting repeated HTTP 401/403 bursts or SSH authentication failures.

### 2.2 Layer 2: Authentication & Application Boundaries
- **Cryptographic JWT Validation:** Clerk authentication tokens are validated against Clerk's remote JSON Web Key Set (`CLERK_JWKS_URL`) using RS256 signatures.
- **Tenant Claim Verification:** Middleware checks that the authenticated user's `org_id` claim strictly matches `platform.tenants.clerkOrgId`.
- **Zero CORS:** With all traffic proxied through same-origin `/backend/*`, browser cross-origin script exploitation is fundamentally neutralized.
- **Webhook Authenticity:** Inbound WhatsApp webhooks must present valid HMAC-SHA256 signatures (`x-hub-signature-256` matching `META_APP_SECRET` or Evolution API tokens).

### 2.3 Layer 3: Cryptography at Rest (AES-256-GCM)
All persistent credentials that could compromise firm communications are encrypted before writing to PostgreSQL using authenticated AES-256-GCM:
- Meta System User Access Tokens (`whatsapp_accounts.accessTokenEnc`)
- Baileys Session Keys (`pilot_sessions.sessionCredsEnc`)
- Google Calendar Refresh Tokens (`lawyer_calendars.googleRefreshTokenEnc`)
- Firm Bank Account & JazzCash Details (`firm_payment_details.detailsEnc`)

Decryption keys are derived exclusively from the 64-hex-char `MASTER_ENCRYPTION_KEY` held in runtime environment memory.

### 2.4 Layer 4: Kernel-Level Tenant Isolation
- **Non-Privileged Database User:** Application queries run under `app_user`, which explicitly lacks the `BYPASSRLS` superuser attribute.
- **`FORCE ROW LEVEL SECURITY`:** Table owners and standard roles alike are subject to RLS policies.
- **Fail-Closed Default:** If `app.tenant_id` is missing or invalid, PostgreSQL returns zero records. Application code cannot leak cross-tenant rows even in the event of an SQL injection flaw.

### 2.5 Layer 5: Tamper-Proof Audit Compliance
Under Section 29 of PECA 2016, digital service providers must maintain authentic traffic data:
- `REVOKE UPDATE, DELETE ON app.audit_logs FROM app_user;`
- Audit records cannot be altered or removed by application compromises or disgruntled staff.

### 2.6 Layer 6: AI Sovereign Privacy Boundaries
Per Decision [D-005](file:///f:/lawyer_agency/docs/decision-log.md):
- **T1 (Public Metadata):** Firm addresses, published fee tariffs -> Public LLMs permitted.
- **T2 (Scrubbed Case Facts):** Canonical English extraction, handoff briefs -> Commercial LLM APIs allowed only with PII redaction.
- **T3 (Client Legal Evidences):** CNIC scans, FIR PDFs, bail orders, witness audio -> **Zero external transmission**. Embeddings generated locally; OCR extracted in-cluster.
