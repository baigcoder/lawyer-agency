# Wakeel — BullMQ Queue Architecture & Asynchronous Processing

**Status:** IMPLEMENTED BASELINE & SPECIFICATION  
**Classification:** Asynchronous Job Processing, Queue Topologies, Concurrency, and Dead Letter Queues  
**Engine Baseline:** BullMQ v5, Redis 7 (Standalone / Cluster), NestJS `@nestjs/bullmq`  
**Runtime Role:** `API_ROLE=worker`  

---

## 1. Queue Topology Overview

Asynchronous processing in Wakeel is partitioned across dedicated, isolated BullMQ queues:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            BULLMQ QUEUE ROSTER                              │
├────────────────────┬─────────────┬─────────────┬────────────────────────────┤
│ Queue Name         │ Concurrency │ Rate Limit  │ Primary Responsibilities   │
├────────────────────┼─────────────┼─────────────┼────────────────────────────┤
│ `outbox`           │ 1           │ None        │ Ticks every 2s; claims     │
│                    │             │             │ PENDING outbox events via  │
│                    │             │             │ FOR UPDATE SKIP LOCKED.    │
├────────────────────┼─────────────┼─────────────┼────────────────────────────┤
│ `domain-events`    │ 10          │ None        │ Consumes published outbox  │
│                    │             │             │ events; fans out to all    │
│                    │             │             │ registered domain handlers.│
├────────────────────┼─────────────┼─────────────┼────────────────────────────┤
│ `ai-jobs`          │ 5           │ Token-aware │ Executes intent routing,   │
│                    │             │             │ LLM generation, RAG, and   │
│                    │             │             │ prompt logging.            │
├────────────────────┼─────────────┼─────────────┼────────────────────────────┤
│ `whatsapp-media`   │ 3           │ None        │ Downloads voice note .ogg, │
│                    │             │             │ extracts STT transcripts,  │
│                    │             │             │ downloads PDF/image files. │
├────────────────────┼─────────────┼─────────────┼────────────────────────────┤
│ `notifications`    │ 5           │ None        │ Web Push VAPID alerts,     │
│                    │             │             │ email digests, escalation  │
│                    │             │             │ SLA breach monitor loop.   │
├────────────────────┼─────────────┼─────────────┼────────────────────────────┤
│ `document-indexing`│ 2           │ None        │ PDF text extraction,       │
│                    │             │             │ chunking, and pgvector HNSW│
│                    │             │             │ embedding generation.      │
└────────────────────┴─────────────┴─────────────┴────────────────────────────┘
```

---

## 2. Job Retry Policies & Exponential Backoff

Jobs default to exponential backoff to handle transient network blips (e.g. Meta API rate limits or ElevenLabs audio generation delays):

```typescript
export const defaultJobOptions: JobsOptions = {
  attempts: 4,
  backoff: {
    type: 'exponential',
    delay: 1000, // 1s, 2s, 4s, 8s
  },
  removeOnComplete: {
    age: 3600 * 24, // Keep completed job metadata for 24 hours
    count: 1000,
  },
  removeOnFail: false, // Never auto-delete failed jobs — preserve for DLQ inspection!
};
```

---

## 3. Dead Letter Queue (DLQ) & Failure Inspection

- When a job exhausts all 4 attempts without success, BullMQ marks it as `FAILED`.
- Because `removeOnFail: false`, the failed job remains intact with its full stack trace and input payload.
- Sentry captures all unhandled job rejections via the global NestJS BullMQ error listener.
- Operators can inspect and re-drive failed jobs via CLI or administrative scripts.
