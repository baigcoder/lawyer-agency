# Wakeel — Transactional Outbox Pattern

**Status:** IMPLEMENTED BASELINE & SPECIFICATION  
**Classification:** Event Reliability, Dual-Write Prevention, and Atomic State Emission  
**Source Code References:** `apps/api/src/common/events/outbox-writer.ts`, `apps/api/src/common/queue/outbox-dispatcher.processor.ts`  

---

## 1. The Dual-Write Problem in Legal Software

Directly publishing events to message queues (BullMQ/Redis) inside an active database transaction is an anti-pattern:
- If the Redis publish succeeds but the database transaction rolls back (e.g. unique constraint violation), the system emits phantom events, notifying clients about appointments that were never saved.
- If the database commits but Redis is momentarily unreachable, the event is permanently lost, dropping critical court hearing reminders.

### The Wakeel Guarantee
State transitions and event emissions must be **atomic**. They occur in the exact same PostgreSQL transaction or not at all.

---

## 2. Outbox Table Schema & Persistence (`platform.outbox_events`)

```prisma
model OutboxEvent {
  id          String            @id @default(uuid()) @db.Uuid
  tenantId    String            @db.Uuid
  type        String            @db.VarChar(100)
  payload     Json              @db.JsonB
  status      OutboxEventStatus @default(PENDING)
  retryCount  Int               @default(0)
  createdAt   DateTime          @default(now()) @db.Timestamptz(6)
  publishedAt DateTime?         @db.Timestamptz(6)

  @@index([status, createdAt])
  @@schema("platform")
}
```

---

## 3. Atomic Appending (`OutboxWriter.append`)

Application services never talk to BullMQ directly. They call `OutboxWriter.append(tx, ...)`:

```typescript
@Injectable()
export class OutboxWriter {
  async append(
    tx: DbTx,
    tenantId: string,
    type: DomainEventType,
    payload: unknown,
  ): Promise<void> {
    const validated = domainEventPayloads[type].parse(payload);
    await tx.outboxEvent.create({
      data: { tenantId, type, payload: validated },
    });
  }
}
```

---

## 4. Polling & Dispatcher Mechanics (`OutboxDispatcherProcessor`)

Every 2 seconds, the `OutboxScheduler` ticks the `OUTBOX` queue:
1. **Batch Claim with `SKIP LOCKED`:**
   ```sql
   SELECT id FROM platform.outbox_events
   WHERE status = 'PENDING'
   ORDER BY "createdAt" ASC
   LIMIT 100
   FOR UPDATE SKIP LOCKED;
   ```
   `FOR UPDATE SKIP LOCKED` guarantees that multiple concurrent worker processes drain events in parallel without lock contention or duplicate claims.
2. **Deterministic BullMQ Deduplication:** The BullMQ job ID is set to `event.id`:
   ```typescript
   await this.domainEventsQueue.add(event.type, event, { jobId: event.id });
   ```
   Redis enforces that an event cannot be enqueued more than once.
3. **Status Update:** The outbox row updates to `PUBLISHED` with `publishedAt = now()`.
