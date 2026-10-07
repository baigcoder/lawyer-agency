# Wakeel — Product Glossary

**Status:** IMPLEMENTED BASELINE & DOMAIN REFERENCE  
**Classification:** Legal, Operational, and Technical Terminology Catalog  

---

## 1. Pakistani Legal & Judicial Terminology

| Term | Urdu Script | Definition in Practice |
|---|---|---|
| **Wakeel (وکيل)** | وکيل | Advocate, Attorney, or Legal Counsel licensed by a Provincial Bar Council (e.g., Punjab Bar Council, Sindh Bar Council) or the Pakistan Bar Council. |
| **Munshi (منشی)** | منشی | Senior law clerk or court filing assistant. Manages court cause lists, physical case files, hearing dates, and court fee stamps. |
| **Vakalatnama** | وکالت نامہ | Power of attorney authorizing an advocate to represent a client in court proceedings before a judge or magistrate. |
| **Cause List** | پيشي فہرست | Daily schedule of cases published by courts (High Court, District Courts) detailing judge benches, case serial numbers, and hearing rooms. |
| **Fard (فرد)** | فرد ملکيت | Official certified land record excerpt issued by the Land Records Authority (Arazi Record Center / Patwari) establishing title or possession. |
| **FIR** | ایف آئی آر | First Information Report registered at a police station (*thana*) under Section 154 of the Code of Criminal Procedure 1898. |
| **Zamanat (ضمانت)** | ضمانت | Bail application (Pre-arrest / Protective / Post-arrest bail) filed under Sections 497/498 CrPC to prevent or secure release from detention. |
| **Khula (خلع)** | خلع | Dissolution of marriage initiated by the wife under Muslim family laws, adjudicated in Family Court. |
| **Challan** | چالان | Official police investigation report submitted to the magistrate under Section 173 CrPC. |
| **Stay Order** | حکم امتناعی | Injunction granted by a civil court under Order 39 Rules 1 & 2 CPC restraining a party from taking specific actions. |
| **Nikahnama** | نکاح نامہ | Islamic marriage contract registered under the Muslim Family Laws Ordinance 1961. |

---

## 2. Technical & Architectural Terminology

| Term | Context | Definition |
|---|---|---|
| **RLS (Row-Level Security)** | Database Security | PostgreSQL security engine enforcing row-level visibility filters. In Wakeel, every tenant query is isolated via `FORCE ROW LEVEL SECURITY`. |
| **GUC (Grand Unified Configuration)** | Postgres Session | Transaction-scoped session parameter (e.g., `app.tenant_id`) set via `SELECT set_config('app.tenant_id', $1, true)` inside the Unit of Work. |
| **Unit of Work (UoW)** | Persistence Layer | NestJS abstraction (`UnitOfWork.withTenant`) guaranteeing all database reads/writes execute inside a transaction bound to the active tenant GUC. |
| **Transactional Outbox** | Event Architecture | Design pattern where domain events are committed to `platform.outbox_events` in the same transaction as state changes, then drained by BullMQ. |
| **T1 / T2 / T3 Data Posture** | AI Data Privacy | Three-tier data classification: T1 (Metadata/IDs), T2 (Sanitized intake text sent to LLMs), T3 (Sensitive court records/audio never sent to public LLMs). |
| **Handoff Brief** | AI Operations | Structured lawyer brief generated on escalation detailing client facts, trigger reason, open items, and recommended next action. |

---

## 3. WhatsApp & Transport Terminology

| Term | Context | Definition |
|---|---|---|
| **24-Hour Session Window** | WhatsApp Policy | Meta rule allowing free-form messaging only within 24 hours of the client's last message. Proactive messages outside the window require approved templates. |
| **Evolution API** | WhatsApp Transport | Self-hosted microservice providing a REST API and webhook gateway for managing both Baileys QR instances and official Meta Cloud API instances. |
| **Baileys** | WhatsApp Protocol | Open-source TypeScript implementation of the WhatsApp multi-device web protocol, used for QR pairing without Meta business verification. |
| **WABA** | Meta WhatsApp | WhatsApp Business Account registered through Meta Business Manager for official Cloud API messaging. |
| **Wavoip** | Voice Transport | Cloud SIP relay service connecting WhatsApp VoIP calls to standard SIP trunks (`sipv2.wavoip.com`), enabling the AI voice receptionist. |
| **Roman Urdu** | Language Policy | Urdu written using the Latin/English alphabet (`"mera case court me pending hai"`). Supported natively by Wakeel's language classifiers. |
