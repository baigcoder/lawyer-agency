# Wakeel — AI Interaction Patterns & Guardrails UI

**Status:** IMPLEMENTED BASELINE & SPECIFICATION  
**Classification:** AI Interaction Design, Ethical Disclosures, Citations, and Advocate Controls  
**Source Code References:** `apps/api/src/modules/ai/`, `apps/web/src/components/ai-settings-card.tsx`, `apps/web/src/components/overview/ai-controls.tsx`  

---

## 1. Ethical Transparency: Mandatory First Disclosure

The first interaction between Wakeel and a client must establish that the client is interacting with an automated assistant:

### Implementation
- Stored on `Conversation.firstDisclosureSent` (Boolean).
- **Urdu Text:**  
  `"السلام علیکم۔ میں [فرم کا نام] کا خودکار معاون ہوں۔ میں وکیل نہیں ہوں اور قانونی مشورہ نہیں دے سکتا۔ میں آپ کے وکیل کے مشورے کے لیے بنیادی تفصیلات اکٹھی کر رہا ہوں۔"`
- **English Text:**  
  `"Hello. I am the automated intake assistant for [Firm Name]. I am not an advocate and cannot give legal advice. I will collect your details for our lawyers to review."`
- The disclosure is sent exactly once per conversation lifecycle and logged in `app.messages`.

---

## 2. Knowledge-Grounded FAQ & Citations

Wakeel never hallucinates legal processes:
- **Retrieval-Augmented Generation (RAG):** When a client asks a procedural question (e.g., *"Family court me khula lene ka kya tareeqa hai?"*), the `FaqAgent` queries the tenant's published knowledge base (`app.knowledge_base` with `status: PUBLISHED`) and the built-in Pakistan process pack (`pakistan-process`).
- **Citation Metadata:** Message records store citations in `Message.citations` as `[{ kbId, chunkId, title }]`.
- **Dashboard Inspection:** In the Priority Inbox, advocates can hover over the AI bubble to view exact KB citations that informed the automated reply.
- **Fail-Closed on Missing Knowledge:** If vector similarity falls below threshold, the AI does not speculate. It politely explains that the query requires lawyer review and transitions to `HUMAN_REQUIRED`.

---

## 3. Human-in-the-Loop Controls on the Dashboard

### 3.1 AI Auto-Reply Master Switch (`aiAutoReplyEnabled`)
- Rendered prominently in `AiControls` on the Overview page and in Settings.
- When toggled off: Incoming WhatsApp messages skip the AI orchestrator event and transition directly to `HUMAN_REQUIRED` with an unread badge.

### 3.2 Draft Review Mode (`aiAutoReplyRequiresApproval`)
- When enabled by the managing partner, AI responses are not dispatched directly to WhatsApp.
- Responses are saved as `QUEUED` messages with `pendingApproval: true`.
- In the Priority Inbox, advocates review the proposed draft, make edits if necessary, and click "Approve & Send".

### 3.3 Prompt Assumptions & Tone Controls (`AiSettingsCard`)
Advocates customize the AI's persona without modifying raw code:
- **Tone Selection:** Formal, Warm, or Highly Concise.
- **Assumptions Injected into Prompts:**
  - *"Never invent facts not stated by the client."*
  - *"Always ask for the city if not specified."*
  - *"Never quote firm fees unless found in verified KB."*
