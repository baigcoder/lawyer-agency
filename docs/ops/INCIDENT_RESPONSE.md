# Incident Response Plan — Classification, Escalation & Post-Mortem

## 1. Incident Severity Classification Framework

Incidents are classified based on legal risk, security boundaries, and operational impact on law firms:

| Severity | Definition & Trigger Examples | Initial Response SLA | Update Cadence | Target Resolution |
| :--- | :--- | :--- | :--- | :--- |
| **P1 — Critical** | • Cross-tenant data leak or RLS security breach.<br>• Complete system outage across all law practices.<br>• Emergency legal escalation dropped (domestic violence / suicide threat SLA > 15 mins breached).<br>• Meta WABA ban or WhatsApp gateway dead. | **< 15 minutes** | Every 30 mins | < 2 hours |
| **P2 — Major** | • Voice AI receptionist dropping calls.<br>• Payment webhooks failing (JazzCash/Easypaisa).<br>• LLM inference latency > 5,000ms causing chat timeouts.<br>• Single law firm isolated outage. | **< 30 minutes** | Every 60 mins | < 6 hours |
| **P3 — Minor** | • Dashboard UI styling defect or minor table sort bug.<br>• Single message delivery retry after temporary network drop.<br>• Non-urgent report export failure. | **< 4 hours** | Daily | Next release cycle |
| **P4 — Low** | • Typo in documentation or minor cosmetic flaw.<br>• Feature request or non-critical enhancement. | **< 24 hours** | Weekly | Backlog |

---

## 2. On-Call Roles & Escalation Chain

```
                   INCIDENT DETECTED (Sentry / Prometheus / Advocate Report)
                                              │
                                              ▼
                                 Automated Pager Alert
                           (WhatsApp Emergency SMS / Phone Call)
                                              │
                                              ▼
                                   On-Call Primary Engineer
                                 (Assumes Incident Commander)
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                                                   ▼
            Technical Lead (TL)                             Communications Lead (CL)
      • Diagnoses root cause                          • Drafts status updates to firms
      • Executes code / DB fix                        • Manages Bar Council notifications
      • Verifies deployment                           • Coordinates customer support
```

---

## 3. Forensic Investigation & Evidence Preservation

When investigating security anomalies or unauthorized access in compliance with **Section 29 of PECA 2016**:

### 3.1 Lock Down Forensic Logs
1. Immediately query append-only audit trail:
   ```sql
   SELECT "createdAt", "actorType", "actorId", action, "entityType", "entityId", ip, metadata
   FROM app.audit_logs
   WHERE "createdAt" >= NOW() - INTERVAL '6 hours'
   ORDER BY "createdAt" DESC;
   ```
2. Export Sentry issue events and correlation traces:
   ```bash
   docker logs --since 6h lawyer_agency-api-1 > /tmp/forensics_api.log
   docker logs --since 6h lawyer_agency-worker-1 > /tmp/forensics_worker.log
   ```
3. Archive evidence snapshot in encrypted storage with SHA-256 hash digest.

---

## 4. Post-Mortem & Root Cause Analysis Template

Every P1 and P2 incident mandates a blameless post-mortem published within 48 hours:

```markdown
# Incident Post-Mortem: [INC-XXXX] [Title]

## Executive Summary
- **Date / Time:** 2026-10-15 14:00 PKT - 15:30 PKT (Duration: 90 mins)
- **Severity:** P1 Critical
- **Lead Investigator:** [Name]
- **Customer Impact:** 12 law firms experienced delayed WhatsApp intake responses. 0 records compromised.

## Timeline (PKT / UTC+5)
- **14:00:** Deployment 1.4.2 introduced migration lock.
- **14:08:** Outbox queue backlog reached 1,200 events.
- **14:15:** Sentry alert fired; On-call engineer paged.
- **14:22:** Incident Commander declared P1.
- **14:40:** Identified deadlocked transaction on app.appointments.
- **15:05:** Applied hotfix unlocking table.
- **15:30:** Outbox drained completely; service restored to normal.

## Root Cause Analysis (5 Whys)
1. *Why did intake stop?* The outbox dispatcher worker stopped processing events.
2. *Why did it stop?* It encountered an unhandled lock timeout on appointments.
3. *Why was appointments locked?* A concurrent GIST exclusion check collided with a manual table reindex.
...

## Corrective & Preventive Action Items
| Action Item | Owner | Target Date | Status |
| :--- | :--- | :--- | :--- |
| Add statement_timeout = 5000ms to UoW transactions | [Engineer] | 2026-10-18 | IN_PROGRESS |
| Add Prometheus alert for outbox lag > 500 | [DevOps] | 2026-10-17 | DONE |
```
