# Wakeel — AI Orchestration Pipeline & Multi-Agent Architecture

**Status:** IMPLEMENTED BASELINE & PIPELINE SPECIFICATION  
**Classification:** Multi-Agent Pipeline, Fast Heuristic Routing, and Model Governance  
**Source Code References:** `apps/api/src/modules/ai/application/ai-orchestrator.service.ts`, `apps/api/src/modules/ai/application/agents/`  

---

## 1. Fast Heuristic Pipeline Flow (D-121)

To achieve sub-second response times and control LLM inference costs, Wakeel avoids running three serial LLM calls on every message. It implements **fast heuristic routing**:

```text
Inbound WhatsApp Message
          │
          ▼
1. FAST SAFETY SCAN (Regex Keywords) ──► MATCH? ──► HALT! (Trigger Escalation, Alert Lawyer)
          │ (No Match)
          ▼
2. LANGUAGE & SCRIPT DETECTION (EN / UR / ROMAN_UR)
          │
          ▼
3. FAST HEURISTIC INTENT SCAN
   ├── GREETING? ──────► Greeting Generator (Skip Router LLM!)
   ├── CONTINUING? ────► Intake Agent (Skip Router LLM!)
   └── COMPLEX? ───────► Master Router LLM (Small Fast Model)
          │
          ▼
4. SPECIALIZED AGENT EXECUTION
   ├── Intake Agent (Single-question fact collection)
   ├── FAQ Agent (Parallel pgvector RAG + Verified KB Citations)
   └── Case Update Agent (Read-only case status lookup)
          │
          ▼
5. SCRIPT MIRRORING & OUTBOUND DISPATCH (via Evolution WhatsApp Transport)
```

---

## 2. Specialized Agent Roster

### 2.1 Master Router (`master-router.service.ts`)
- Small, cost-effective classifier model (`groq` / `gpt-oss-20b`).
- Classifies intent into `GREETING`, `INTAKE`, `FAQ`, `CASE_UPDATE`, or `HUMAN_ESCALATION`.

### 2.2 Intake Agent (`intake.agent.ts`)
- Governed by single-question intake progression.
- Extracts disclosed facts (client name, city, opponent name, matter category, urgency) into `IntakeSession`.
- Formats the next single question in the client's mirrored language.

### 2.3 FAQ Agent (`faq.agent.ts`)
- Queries `app.kb_chunks` and Pakistan process packs using semantic embeddings.
- Synthesizes grounded answers citing verified knowledge base sources.
- If no matching chunk achieves sufficient similarity, gracefully admits: *"Yeh maamla advocate sb se mashwaray ka mutaqazi hai"* and transitions to human review.

### 2.4 Handoff Brief Agent (`handoff-brief.agent.ts`, D-123)
- Generates a 2–4 sentence neutral situation summary after an emergency escalation occurs.
- Persisted on `app.escalations(handoffBrief)` so the advocate can review the core facts at a glance.

---

## 3. Model Governance & Cost Controls (D-006, D-056)

- **Tiered Model Routing:** Small models for routing and intent extraction; mid-tier models for conversational agents; strong models for legal summarization.
- **Monthly Budget Caps:** Each tenant possesses a configurable monthly LLM token budget. If the cap is approached, the system gracefully falls back to deterministic rule-based replies and manual handoff.
- **Audit Logging:** Every AI execution logs input/output tokens, provider latency (ms), and cost in USD micros (`app.ai_logs`).
