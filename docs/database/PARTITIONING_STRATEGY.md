# Database Partitioning Strategy — High-Throughput Unbounded Tables

## 1. Architectural Motivation

In a high-velocity legal operations platform handling real-time WhatsApp conversations, automated AI agent loops, and statutory audit compliance, three specific tables grow monotonically without application-level bounds:

1. **`app.messages`:** Inbound and outbound WhatsApp messages, multimedia attachments, location payloads, and citations. At scale (Phase 1 §7 target: 50 law firms, ~640,000 interactions/day), this table accumulates tens of millions of rows monthly.
2. **`app.audit_logs`:** Forensic, append-only security logs capturing every sensitive case view, document download, and financial transaction for Bar Council compliance.
3. **`app.ai_logs`:** Telemetry capturing prompt tokens, completion tokens, latency, cost attribution, and queue wait times for every model inference.

Without partitioning, monolithic tables of this scale experience severe query performance degradation, table bloat, autovacuum starvation, and prohibitive disk I/O costs during routine retention purging.

To solve this, Wakeel implements **Monthly Declarative RANGE Partitioning** keyed by `"createdAt"` ([0003_partitions_and_vector](file:///f:/lawyer_agency/apps/api/prisma/migrations/0003_partitions_and_vector/migration.sql)).

---

## 2. Partition Architecture & Implementation

```
                                  app.messages
                          (Partitioned Parent by RANGE)
                                       │
        ┌───────────────┬──────────────┼──────────────┬──────────────┐
        ▼               ▼              ▼              ▼              ▼
  messages_2026_09 messages_2026_10 messages_2026_11 messages_2026_12 messages_default
   [Sep 1 - Oct 1)  [Oct 1 - Nov 1)  [Nov 1 - Dec 1)  [Dec 1 - Jan 1)  (Catch-all)
```

### 2.1 Composite Primary Key Invariant

PostgreSQL declarative partitioning enforces a strict architectural constraint: **any unique constraint or primary key on a partitioned table must include the partition key column**.

Consequently, Prisma 7 and PostgreSQL schema definitions declare composite primary keys:
```prisma
model Message {
  id        String   @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  // ... other fields
  @@id([id, createdAt])
}
```

### 2.2 Table Creation DDL Template

Executed during migration `0003_partitions_and_vector`:
```sql
-- 1. Create partitioned parent table
CREATE TABLE app.messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "conversationId" uuid NOT NULL,
  direction app."MessageDirection" NOT NULL,
  "senderType" app."SenderType" NOT NULL,
  "senderUserId" uuid,
  wamid text,
  "contentType" app."ContentType" DEFAULT 'TEXT'::app."ContentType" NOT NULL,
  body text,
  "languageDetected" app."Language" DEFAULT 'UNKNOWN'::app."Language" NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  "templateName" text,
  "deliveryStatus" app."DeliveryStatus" DEFAULT 'QUEUED'::app."DeliveryStatus" NOT NULL,
  citations jsonb DEFAULT '[]'::jsonb NOT NULL,
  "correlationId" uuid,
  "createdAt" timestamptz(6) DEFAULT now() NOT NULL
) PARTITION BY RANGE ("createdAt");

-- 2. Create monthly range partitions
CREATE TABLE app.messages_2026_10 
  PARTITION OF app.messages 
  FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');

-- 3. Safety-net default partition
CREATE TABLE app.messages_default 
  PARTITION OF app.messages DEFAULT;

-- 4. Composite primary key
ALTER TABLE app.messages ADD PRIMARY KEY (id, "createdAt");
```

---

## 3. Propagation of Indexes & Constraints

Indexes defined on the parent partitioned table automatically propagate down to all attached child partitions:

1. **`app.messages`:**
   - Primary Key: `(id, "createdAt")`
   - Tenant Timeline Index: `("tenantId", "createdAt")`
   - Conversation Timeline Index: `("conversationId", "createdAt")`
   - Meta Message ID Index: `(wamid)`
2. **`app.audit_logs`:**
   - Primary Key: `(id, "createdAt")`
   - Tenant Timeline Index: `("tenantId", "createdAt")`
   - Resource Target Index: `("tenantId", "entityType", "entityId")`
3. **`app.ai_logs`:**
   - Primary Key: `(id, "createdAt")`
   - Tenant Timeline Index: `("tenantId", "createdAt")`
   - Correlation Trace Index: `("correlationId")`

---

## 4. Query Partition Pruning

PostgreSQL query planner utilizes **static and run-time partition pruning**. When application queries supply a `createdAt` predicate, the query engine scans solely the matching child partitions and bypasses all others:

```sql
-- Scans ONLY messages_2026_10; skips all past and future partitions:
SELECT * FROM app.messages 
WHERE "conversationId" = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
  AND "createdAt" >= '2026-10-01' 
  AND "createdAt" < '2026-10-31';
```

---

## 5. Automated Partition Maintenance Lifecycle

### 5.1 Pre-Creation Window
To prevent insert failures into the catch-all `_default` partition, the system pre-provisions **6 future months of partitions**.

### 5.2 Monthly Cron Job (`infra/scripts/maintain-partitions.sql`)
Executed on the 1st of every month via pg_cron or systemd timer:
```sql
DO $$
DECLARE
  tables text[] := ARRAY['messages', 'audit_logs', 'ai_logs'];
  tbl text;
  future_month date;
  part_name text;
  start_bound text;
  end_bound text;
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    FOR i IN 1..6 LOOP
      future_month := (date_trunc('month', now()) + (i || ' months')::interval)::date;
      part_name := tbl || '_' || to_char(future_month, 'YYYY_MM');
      start_bound := future_month::text;
      end_bound := (future_month + interval '1 month')::date::text;
      
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE n.nspname = 'app' AND c.relname = part_name
      ) THEN
        EXECUTE format(
          'CREATE TABLE app.%I PARTITION OF app.%I FOR VALUES FROM (%L) TO (%L)',
          part_name, tbl, start_bound, end_bound
        );
        RAISE NOTICE 'Created partition app.%', part_name;
      END IF;
    END LOOP;
  END LOOP;
END $$;
```

### 5.3 Retention Purging via `DROP TABLE`
Traditional `DELETE FROM app.messages WHERE "createdAt" < ...` causes catastrophic write amplification, WAL generation, and table fragmentation. Under the partitioning model, data retention is instantaneous and zero-cost:
```sql
-- Instantaneous retention purge of expired partition (e.g., older than 180 days)
DROP TABLE app.messages_2026_03;
DROP TABLE app.audit_logs_2026_03;
DROP TABLE app.ai_logs_2026_03;
```

### 5.4 Monitoring the `_default` Partition
The `_default` partition must remain empty. If rows appear in `_default`, it indicates future partition pre-creation failed. Prometheus alerting fires if:
```sql
SELECT count(*) FROM app.messages_default; -- Alert if count > 0
```
