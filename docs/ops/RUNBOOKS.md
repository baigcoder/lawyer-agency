# Operations Runbooks — SRE & On-Call Procedures

This document provides definitive, step-by-step operational runbooks (RB-01 through RB-08) for engineers maintaining the Wakeel production infrastructure.

---

## RB-01: Database Migration Failure & Recovery

### Symptoms
- Startup container `migrate` exits with non-zero exit code (`status: 1`).
- Application containers (`api`, `worker`, `voice`) refuse to start, blocked on health dependencies.
- Sentry alerts trigger: `PrismaClientInitializationError: P3006 / P3018`.

### Remediation Steps
1. **Inspect Migration Logs:**
   ```bash
   docker compose -f docker-compose.prod.yml logs migrate
   ```
2. **Identify Failed Migration:** Note the failing migration folder in `apps/api/prisma/migrations/`.
3. **Connect to PostgreSQL as Superuser:**
   ```bash
   docker exec -it lawyer_agency-postgres-1 psql -U postgres -d lawyer_agency
   ```
4. **Inspect Migration History Table:**
   ```sql
   SELECT id, migration_name, started_at, finished_at, rolled_back_at 
   FROM "_prisma_migrations" 
   ORDER BY started_at DESC LIMIT 5;
   ```
5. **Resolve Lock or Inconsistency:**
   - If migration failed halfway, inspect the failing SQL statement.
   - If a table or index already exists, manually align schema state.
   - Mark the failed migration as rolled back in the Prisma ledger:
     ```sql
     UPDATE "_prisma_migrations" 
     SET rolled_back_at = now() 
     WHERE migration_name = '<failing_migration_name>';
     ```
6. **Author Compensatory Forward Migration:** Author `0031_fix_...` and redeploy.
7. **Rerun Migrator:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d migrate
   ```

---

## RB-02: WhatsApp Disconnection & Re-Pairing (Evolution API)

### Symptoms
- Advocates report WhatsApp messages are not being received or sent.
- Dashboard shows connection stage `DISCONNECTED` or `lastError: "Connection Closed"`.
- Sentry captures `EvolutionApiError: Session not connected`.

### Remediation Steps
1. **Check Evolution API Gateway Status:**
   ```bash
   docker compose -f docker-compose.prod.yml ps evolution-api
   docker logs --tail 100 lawyer_agency-evolution-api-1
   ```
2. **Query Tenant Session State via REST:**
   ```bash
   curl -s -H "apikey: ${EVOLUTION_API_KEY}" \
     http://localhost:8080/instance/connectionState/firm-alpha | jq .
   ```
3. **If Session is in `close` State (Logged Out):**
   - Reset the session via Evolution REST API:
     ```bash
     curl -X DELETE -H "apikey: ${EVOLUTION_API_KEY}" \
       http://localhost:8080/instance/logout/firm-alpha
     ```
   - Re-request QR code from the Wakeel dashboard settings or curl:
     ```bash
     curl -s -H "apikey: ${EVOLUTION_API_KEY}" \
       http://localhost:8080/instance/connect/firm-alpha | jq .base64
     ```
   - Instruct the firm managing partner to open WhatsApp on their smartphone -> **Linked Devices** -> **Scan QR Code**.
4. **Verify Re-Connection:**
   - Confirm state transitions to `open`.
   - Send test WhatsApp ping to the firm number.

---

## RB-03: Monthly Partition Maintenance & Default Partition Overflow

### Symptoms
- Prometheus alert fires: `PostgresDefaultPartitionRowsDetected > 0`.
- Unhandled rows are falling into `app.messages_default`, `app.audit_logs_default`, or `app.ai_logs_default`.

### Remediation Steps
1. **Identify Unpartitioned Row Dates:**
   ```bash
   docker exec -it lawyer_agency-postgres-1 psql -U postgres -d lawyer_agency -c \
     "SELECT min(\"createdAt\"), max(\"createdAt\"), count(*) FROM app.messages_default;"
   ```
2. **Execute Automated Partition Pre-Creation:**
   ```bash
   docker exec -it lawyer_agency-postgres-1 psql -U postgres -d lawyer_agency -f /maintain-partitions.sql
   ```
3. **Migrate Straggler Rows Out of Default Partition:**
   - Detach default partition:
     ```sql
     ALTER TABLE app.messages DETACH PARTITION app.messages_default;
     ```
   - Insert rows into newly created child partition:
     ```sql
     INSERT INTO app.messages SELECT * FROM app.messages_default;
     TRUNCATE app.messages_default;
     ```
   - Re-attach default partition:
     ```sql
     ALTER TABLE app.messages ATTACH PARTITION app.messages_default DEFAULT;
     ```

---

## RB-04: Voice Worker Restart & Audio Port Recovery

### Symptoms
- Inbound WhatsApp phone calls ring continuously without the AI Receptionist answering.
- Docker logs show `EADDRINUSE: 5060` or WebRTC ICE timeout.

### Remediation Steps
1. **Check Voice Container Process & UDP Port Binding:**
   ```bash
   docker logs --tail 50 lawyer_agency-voice-1
   netstat -ulnp | grep -E '5060|40000'
   ```
2. **If Ports Are Hung by Zombie Processes:**
   ```bash
   docker compose -f docker-compose.prod.yml stop voice
   # Find any hung host process holding port 5060
   fuser -k 5060/udp || true
   fuser -k 5060/tcp || true
   ```
3. **Restart Voice Container:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d voice
   ```
4. **Verify Wavoip SIP Registration:**
   ```bash
   docker logs -f lawyer_agency-voice-1 | grep -i "sip"
   # Look for: "[Wavoip] Successfully registered with sipv2.wavoip.com"
   ```

---

## RB-05: Failed Outbox Drain & Redis Backpressure

### Symptoms
- Webhook events are received, but downstream BullMQ jobs are delayed.
- `SELECT count(*) FROM platform.outbox_events WHERE publishedAt IS NULL` grows > 5,000.

### Remediation Steps
1. **Check Redis Memory & CPU:**
   ```bash
   docker exec -it lawyer_agency-redis-1 redis-cli info memory
   docker exec -it lawyer_agency-redis-1 redis-cli info cpu
   ```
2. **Check Outbox Dispatcher Worker:**
   ```bash
   docker logs --tail 50 lawyer_agency-api-1 | grep -i "outbox"
   ```
3. **If Outbox Dispatcher Is Stalled:**
   - Restart API container:
     ```bash
     docker compose -f docker-compose.prod.yml restart api
     ```
   - Trigger manual outbox drain script:
     ```bash
     docker exec -it lawyer_agency-api-1 npx ts-node scripts/drain-outbox.ts
     ```

---

## RB-06: Redis Cache & Queue Flush Recovery

### Symptoms
- Redis container crashed or ran out of memory (`OOM command not allowed`).
- BullMQ queue corruption.

### Remediation Steps
1. **Inspect Redis Container Memory Cap:** Ensure container has sufficient swap/memory limits.
2. **Flush Corrupted Ephemeral Caches:**
   ```bash
   # Connect to Redis CLI
   docker exec -it lawyer_agency-redis-1 redis-cli
   # Inspect active BullMQ queues
   KEYS "bull:*"
   ```
3. **Clean Stalled BullMQ Jobs:**
   ```bash
   docker exec -it lawyer_agency-worker-1 npx ts-node scripts/clean-stalled-queues.ts
   ```
4. **Restart Worker Fleet:**
   ```bash
   docker compose -f docker-compose.prod.yml restart worker
   ```

---

## RB-07: Tenant Onboarding & Firm Provisioning

### Objective
Manually onboard a new law firm practice onto Wakeel.

### Execution Steps
1. **Obtain Firm Credentials:**
   - Firm Name: "Qureshi Legal Associates"
   - Slug: `qureshi-legal`
   - Managing Partner Email: `tariq@qureshilegal.pk`
   - Practice Areas: `Civil, Family, Criminal`
2. **Execute Provisioning Script:**
   ```bash
   docker exec -it lawyer_agency-api-1 npx ts-node scripts/provision-tenant.ts \
     --name "Qureshi Legal Associates" \
     --slug "qureshi-legal" \
     --email "tariq@qureshilegal.pk" \
     --trial-days 14
   ```
3. **Generate Evolution WhatsApp Instance:**
   ```bash
   curl -X POST -H "apikey: ${EVOLUTION_API_KEY}" \
     http://localhost:8080/instance/create \
     -H "Content-Type: application/json" \
     -d '{"instanceName":"qureshi-legal","token":"sec_qureshi","qrcode":true}'
   ```
4. **Deliver Dashboard Access:** Send magic invite link via Clerk to `tariq@qureshilegal.pk`.

---

## RB-08: Emergency AI Kill Switch

### Scenario
An LLM model update causes hallucinations, inappropriate legal statements, or loops. Immediate suspension of AI auto-replies is required.

### Remediation Steps
1. **Global AI Auto-Reply Kill Switch (All Tenants):**
   ```bash
   # Connect to PostgreSQL
   docker exec -it lawyer_agency-postgres-1 psql -U postgres -d lawyer_agency -c \
     "UPDATE app.conversations SET state = 'HUMAN_ACTIVE' WHERE state = 'AI_ACTIVE';"
   ```
2. **Per-Tenant AI Kill Switch:**
   - In the dashboard, advocate toggles "AI Assistant Active" to **OFF** in Firm Settings.
   - Or via SQL:
     ```sql
     UPDATE platform.tenants 
     SET settings = jsonb_set(settings, '{aiAutoReplyEnabled}', 'false'::jsonb) 
     WHERE slug = 'qureshi-legal';
     ```
3. **Verify:** Inbound client messages route directly to human inbox without triggering LLM inference.
