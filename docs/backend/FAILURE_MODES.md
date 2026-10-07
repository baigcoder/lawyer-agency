# Wakeel — Failure Modes & Degraded Operations Matrix

**Status:** IMPLEMENTED BASELINE & RESILIENCE SPECIFICATION  
**Classification:** Failure Mode Effects Analysis (FMEA), Degradation Paths, and Runbook Triggers  
**Audit Date:** 2026-10-07  

---

## 1. System Failure Matrix

| Component | Failure Mode / Symptom | Blast Radius | Automatic System Mitigation | Manual Runbook Trigger |
|---|---|---|---|---|
| **Evolution API** | Container crash, QR unlinked, or WhatsApp logged out. | Inbound/outbound WhatsApp traffic stops for that instance. | Auto-restart container; mark instance `DISCONNECTED`; alert dashboard with QR reconnect modal. | `docs/ops/RUNBOOKS.md#rb-02-whatsapp-reconnection` |
| **PostgreSQL Pool**| Connection pool exhausted (`max: 20` clients busy). | API queries return HTTP 503 or latency spikes. | NestJS readiness probe fails (`/health/ready`); orchestrator stops sending traffic to unhealthy replicas. | `docs/ops/RUNBOOKS.md#rb-04-db-pool-exhaustion` |
| **Redis** | Redis service down or out-of-memory (`OOM command not allowed`). | Outbox draining halts; background AI jobs pause; HTTP APIs continue functioning. | Outbox events remain safely persisted in PostgreSQL `platform.outbox_events` (zero data loss); BullMQ retries on Redis recovery. | `docs/ops/RUNBOOKS.md#rb-03-redis-failover` |
| **Primary LLM** | OpenAI / Groq outage (500/503/429 rate limit). | AI auto-reply cannot generate response. | System falls back to local heuristic intent parser or transitions conversation to `HUMAN_REQUIRED`. | Check provider status; switch model alias in settings. |
| **ElevenLabs TTS**| API quota exceeded or network failure. | Outbound Urdu voice notes cannot be synthesized. | Degrades gracefully: falls back to sending the message as standard written WhatsApp text. | Re-charge API quota; fallback to local Piper TTS if configured. |
| **Wavoip SIP Trunk**| SIP registration drops or Wavoip SIP proxy unreachable. | Live voice reception cannot answer incoming VoIP calls. | Voice process auto-reconnects SIP trunk; missed calls trigger standard WhatsApp text intake flow. | `docs/ops/RUNBOOKS.md#rb-05-voice-sip-reconnect` |
| **Meta Graph API**| 24-hour session window closed (Error `131047`). | Manual free-form message rejected by Meta. | Frontend blocks message send; informs advocate that approved template is required. | Select pre-approved HSM template from drawer. |
| **Supabase Storage**| Network partition to Supabase bucket. | Document upload / download fails. | Filesystem fallback writes to local encrypted volume (`STORAGE_LOCAL_DIR`); retries upload to bucket. | Verify bucket permissions and API keys. |
| **Google Calendar**| Advocate revokes Google OAuth token. | Calendar two-way sync halts for that lawyer. | Connection marked `REVOKED`; appointments continue booking locally in Wakeel DB; lawyer prompted to re-auth. | Re-authorize Google OAuth in `/dashboard/calendar`. |
