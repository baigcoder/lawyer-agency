# Phase 7 — AI Agent Pipeline

**Status:** delivered & verified 2026-08-12  
**Scope:** master router, intake/FAQ/case-update agents, escalation detector, model routing + budget guard, async domain-event worker, RAG retrieval port with dev stub.

---

## 1. Goal & Definition of Done

**Goal:** an AI pipeline that reads every inbound WhatsApp message, classifies intent, detects safety/urgency escalations, extracts structured intake data, answers FAQ from the knowledge base (with citations), summarizes case updates, and drafts replies — without ever giving legal advice.

**Done when (all verified, evidence §6):**
- [x] `message.inbound.received` outbox event triggers the AI worker
- [x] Escalation detector runs before response generation (safety-first)
- [x] Master router picks intent and detects language (EN/UR heuristic + LLM)
- [x] Intake agent extracts fields and upserts `intake_sessions`
- [x] FAQ agent uses the `Retriever` port, returns citations, declines when no relevant KB chunk
- [x] Case-update agent drafts acknowledgment + summary
- [x] Model router chooses provider/model per agent, respects tenant allowlist, enforces monthly budget cap
- [x] Every LLM call logged to `ai_logs` with cost/latency/tokens/data tier
- [x] AI publishes `ai.escalation.triggered` and `ai.intake.completed` outbox events
- [x] Replies sent via `SendService` only when not escalated/conversation not closed
- [x] Full `tsc --noEmit` clean, 40/40 tests, ESLint clean

## 2. Key Decisions

### D-052 — LLM client as a vendor port
A single `AiClient` port with a provider factory keeps vendor wire shapes isolated. OpenAI is implemented with native `fetch` (no SDK dependency); Anthropic and Google are registered stubs ready for implementation. Structured output uses JSON mode + zod validation at the boundary.

### D-053 — Prompt registry via `platform.prompt_versions`
Agents load the active prompt for their agent name; a hard-coded default keeps the pipeline runnable before the registry is populated. Prompts are rendered with simple `{{variable}}` substitution.

### D-054 — Master router classifies intent + language
A lightweight router call decides which agent handles the message and detects language. Budget exhaustion forces `HUMAN_HANDOFF` immediately.

### D-055 — Data tiering enforced by default
All AI calls in Phase 7 operate on T2 (message body, redacted excerpts) or lower. T3 (documents, IDs, full transcripts) is never passed to the LLM by default; the Documents module owns T3 access (D-005).

### D-056 — Model routing + budget guard
A catalog maps `provider/model` to per-1k-token pricing. The router picks the agent's default if allowed, otherwise the cheapest allowed model. `checkBudget` sums current-month `ai_logs.costMicros` against `Tenant.aiMonthlyBudgetMicros`; exceeded budget triggers a fallback (cheapest model or human handoff).

### D-057 — Escalation triggers before generation
The escalation detector runs first. If triggered, the conversation moves to `HUMAN_REQUIRED`, an `escalations` row is created, `ai.escalation.triggered` is published, and no AI reply is sent. A keyword fallback runs when budget is exhausted to preserve safety.

### D-058 — Citations as structured `{kbId, chunkId, title}`
FAQ agent returns citations in the exact shape stored on `messages.citations`. Phase 8 will populate the KB chunks used here.

### D-059 — RAG retrieval is a port with dev stub
`Retriever` lives in the RAG module. Phase 7 ships a keyword-search stub so the agent pipeline is end-to-end testable; Phase 8 replaces it with pgvector similarity search without changing the AI module contract.

## 3. What was built

```
modules/ai/
├── domain/types.ts                     # AgentIntent, AgentResult, Citation, EscalationSignal, RouterDecision
├── application/
│   ├── ports.ts                        # AiClient, PromptRepository, ModelRouter, Retriever ports
│   ├── agents/
│   │   ├── master-router.service.ts    # intent + language detection
│   │   ├── intake.agent.ts             # structured extraction + reply
│   │   ├── faq.agent.ts                # RAG-grounded FAQ + citations
│   │   └── case-update.agent.ts        # case summary + acknowledgment
│   ├── escalation-detector.service.ts  # safety/urgency scan
│   └── ai-orchestrator.service.ts      # loads context, runs detectors/agents, persists, sends, emits events
├── infrastructure/
│   ├── openai.adapter.ts               # fetch-based OpenAI client
│   ├── anthropic.adapter.ts            # stub
│   ├── google.adapter.ts               # stub
│   ├── ai-client.factory.ts            # provider selector
│   ├── prompt.repository.ts            # load active prompt + renderTemplate
│   ├── model-router.service.ts         # choose model + budget check
│   └── ai-logger.service.ts            # write ai_logs
├── interface/
│   └── ai.processor.ts                 # BullMQ worker on domain-events queue (message.inbound.received)
└── ai.module.ts                        # dynamic role-aware registration
modules/rag/
├── application/retriever.port.ts       # Retriever contract
└── infrastructure/simple-retriever.ts  # keyword-search dev stub
common/events/domain-events.ts          # +ai.escalation.triggered, +ai.intake.completed
prisma/migrations/0005_intake_session_unique
.env.example                            # +AI_DEFAULT_PROVIDER, AI_DEFAULT_MODEL
```

## 4. Security & Data Posture

- No T3 data reaches the LLM in this phase.
- Every LLM call is logged with cost and data tier; prompt logs (Phase 7+) will be T2-redacted only.
- Escalation detector runs before any reply generation.
- Budget exhaustion degrades to keyword scan / human handoff rather than failing open.

## 5. Boundary Observations

- AI module imports `SendService` from WhatsApp (exported application service) and `Retriever` from RAG (exported port). No internals imported.
- RAG module is consumed by AI but remains independent; its stub implementation can be swapped in Phase 8.
- `AiClient` port keeps the rest of the pipeline vendor-agnostic.

## 6. Verification Evidence (this environment)

- `tsc --noEmit` clean · **40/40 tests** · ESLint clean
- `npm run build` clean; server boots and listens successfully
- Unit tests cover: master router (intent + Urdu detection + budget handoff), escalation detector (LLM flag + keyword fallback), orchestrator (intake reply, escalation suppression, outbox events)
- **Not verified here (no Docker):** real LLM calls, RAG vector retrieval, end-to-end outbox → worker → reply flow. First integration run: `docker compose up -d && prisma migrate deploy`.

## 7. Next Work

**Phase 8** — RAG knowledge base (chunking/embedding pipeline, tenant-scoped vector retrieval, KB management UI/API).
