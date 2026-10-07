# Data Retention & Lifecycle Management Policy

## 1. Regulatory Context & Retention Balancing

A legal SaaS in Pakistan must balance two competing legal imperatives:
1. **Client Privacy & Data Minimization:** Clients undergoing divorce, domestic abuse, or criminal investigations have a fundamental interest in preventing their private messages and identity documents from lingering on cloud servers indefinitely.
2. **Statutory Evidentiary Preservation:** Under **Section 29 of PECA 2016** and High Court rules, advocates must preserve transaction records, case filings, and authentic client instructions for a minimum statutory period.

Wakeel solves this through a **Tiered Automated Retention Architecture** combining partition dropping, payload scrubbing, and document lifecycle flags.

---

## 2. Table-by-Table Retention Lifecycle Matrix

| Table | Retention Window | Purging Mechanism | Regulatory Rationale |
| :--- | :--- | :--- | :--- |
| **`app.messages`** | **180 Days** (Default)<br>(Configurable via `retentionDaysOverride`) | Partition Drop (`DROP TABLE app.messages_YYYY_MM`) | Conversational chat history pruned; essential legal facts already extracted into `app.cases.intakeData`. |
| **`app.audit_logs`** | **3 Years** (1,095 Days) | Partition Drop (after 36 months) | Mandatory compliance with PECA 2016 Section 29 traffic log preservation. |
| **`app.ai_logs`** | **90 Days** | Partition Drop (after 3 months) | LLM token telemetry and prompt evaluations pruned once billing is reconciled. |
| **`platform.webhook_events`**| **7 Days** | In-place payload nulling (`UPDATE ... SET payload = NULL`) | Raw Meta webhooks containing PII are scrubbed immediately after processing. |
| **`app.documents`** (Unpinned)| **90 Days** post-case closure | Soft-delete (`deletedAt = NOW()`) followed by object purge | Temporary photos/receipts deleted; vital pleadings remain. |
| **`app.documents`** (`isPinned: true`)| **Case Lifetime + 5 Years** | Explicit advocate archival action | Core evidence (Vakalatnamas, Court Orders, Decrees) preserved. |

---

## 3. Automated Partition Dropping vs `DELETE` Fragmentation

To prevent the massive PostgreSQL table bloat and write amplification associated with SQL `DELETE` statements, table pruning is executed at the storage layer via partition dropping:

```sql
-- Executed on the 1st of every month
DO $$
DECLARE
  cutoff_month text := to_char(NOW() - INTERVAL '6 months', 'YYYY_MM');
  msg_table text := 'messages_' || cutoff_month;
  ai_table text := 'ai_logs_' || cutoff_month;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = msg_table) THEN
    EXECUTE format('DROP TABLE app.%I', msg_table);
    RAISE NOTICE 'Dropped expired message partition app.%', msg_table;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = ai_table) THEN
    EXECUTE format('DROP TABLE app.%I', ai_table);
    RAISE NOTICE 'Dropped expired AI log partition app.%', ai_table;
  END IF;
END $$;
```

---

## 4. Webhook Payload Scrubbing Job

Inbound WhatsApp webhooks may contain raw phone numbers, message bodies, or media URLs. Once processed into normalized database entities, the raw payload is sanitized:

```sql
-- Nightly maintenance job
UPDATE platform.webhook_events
SET payload = NULL
WHERE "processedAt" IS NOT NULL
  AND "receivedAt" < NOW() - INTERVAL '7 days'
  AND payload IS NOT NULL;
```

---

## 5. Client Right-to-Erasure Workflow (Data Scrubbing)

If a client invokes their right to erasure or requests the deletion of their WhatsApp contact history:
1. **Verification:** Managing advocate must approve the deletion request in the dashboard (ensuring the case is not active in an adversarial trial where destroying evidence violates the Penal Code).
2. **Anonymization Execution:**
   - Client name replaced with `"Redacted Client [UUID]"`.
   - `waPhone` replaced with one-way SHA-256 hash digest.
   - CNIC field set to `NULL`.
   - Client document files unlinked and deleted from Supabase Storage bucket.
3. **Audit Ledger Preservation:** The audit entry recording the anonymization action is permanently retained in `app.audit_logs`.
