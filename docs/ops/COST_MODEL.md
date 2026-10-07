# Financial Cost Model & Unit Economics — Pakistani Legal SaaS

## 1. Executive Summary & Cost Structure

Wakeel's multi-tenant architecture is engineered for high gross profit margins (>80%) within the macroeconomic reality of the Pakistani legal sector. By leveraging self-hosted local embeddings, high-throughput Groq inference, and intelligent voice audio caching, the variable cost to serve an active law firm is minimized to a fraction of traditional SaaS products.

```
┌────────────────────────────────────────────────────────────────────────┐
│               Monthly Revenue vs Cost per Law Firm (Tier 2)            │
│                                                                        │
│   Revenue: PKR 35,000 (~$125 USD)                                      │
│   ████████████████████████████████████████████████████████████         │
│                                                                        │
│   Cost of Goods Sold (COGS): PKR 5,800 (~$21 USD)                      │
│   ██████████                                                           │
│                                                                        │
│   Gross Margin: ~83.4% (PKR 29,200 Net Profit per Firm)                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Infrastructure & Hosting Base Costs (Fixed)

Hosting costs are amortized across all onboarded law practices:

| Component | Provider / Spec | Monthly Cost (USD) | Monthly Cost (PKR) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Compute** | Hetzner CCX23 (4 vCPU / 16GB RAM) | $48.00 | PKR 13,440 | Supports up to 50 active law firms. |
| **Object Storage** | Supabase Storage / S3 Wasabi (100GB) | $5.00 | PKR 1,400 | Legal document vault and voice archives. |
| **Edge & DNS** | Cloudflare Pro + Domain Registration | $22.00 | PKR 6,160 | DDoS mitigation and SSL acceleration. |
| **Total Base Hosting** | | **$75.00** | **PKR 21,000** | **< PKR 700 / firm / month at 30 firms.** |

---

## 3. Variable Consumption Costs per Law Practice

Analysis for an active mid-tier law chamber handling **1,000 client interactions / month**:

### 3.1 WhatsApp Gateway Charges
- **Baileys QR Mode:** **$0.00** (Uses firm's existing SIM package).
- **Official Meta Cloud API Mode:**
  - 1,000 Service conversations free per month.
  - 200 Proactive utility templates (court hearing reminders) @ $0.005/convo: **$1.00 (~PKR 280)**.

### 3.2 AI Language Model Inference (Groq Llama 3.3 70B)
- Average conversational turn: 600 input tokens, 150 output tokens.
- 5,000 monthly turns across 1,000 client threads:
  - Input: 3.0M tokens @ $0.59 / 1M = $1.77
  - Output: 0.75M tokens @ $0.79 / 1M = $0.59
  - Total Monthly LLM Spend: **$2.36 (~PKR 660)**.

### 3.3 Local Dense Vector Embeddings (`multilingual-e5-small`)
- Running locally in Docker on host CPU: **$0.00** (Zero API egress fees).

### 3.4 Speech Synthesis & Audio Streaming (ElevenLabs & Wavoip)
- **ElevenLabs Turbo v2.5:**
  - Static audio prompts (greetings, disclaimers) cached on disk = 0 characters.
  - Dynamic Urdu turns (~150 chars/turn x 200 dynamic voice notes) = 30,000 chars.
  - Cost: **$5.00 (~PKR 1,400)**.
- **Wavoip SIP Trunk:** Allocated flat license: **$10.00 (~PKR 2,800)**.

### 3.5 Total Variable COGS per Law Firm
- **Total Variable Cost:** **~$18.36 / month (~PKR 5,140 / month)**.

---

## 4. Subscription Pricing Tiers & Unit Economics

| Tier Profile | Target Market | Monthly Fee (PKR) | Est. Cost to Serve | Gross Margin |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Solo Advocate** | Individual High Court advocate, 1 WhatsApp number, text triage only. | **PKR 15,000** (~$54 USD) | PKR 2,800 | **81.3%** |
| **Tier 2: Chamber Practice**| 3–5 Advocates, AI Voice Receptionist, Google Calendar sync, diary reminders. | **PKR 35,000** (~$125 USD) | PKR 5,800 | **83.4%** |
| **Tier 3: Corporate Firm** | 10+ Advocates, multiple WABA numbers, custom practice areas, dedicated SLA. | **PKR 75,000** (~$270 USD) | PKR 11,500 | **84.6%** |

---

## 5. Budget Capping & Spend Guardrails

To prevent run-away AI API bills caused by infinite client loops or malicious spam:
- **`platform.tenants.aiMonthlyBudgetMicros`:** Configurable per-tenant spend cap (default: $25.00 = 25,000,000 micros).
- **Graceful Fallback:** If a firm reaches 100% of its monthly AI budget, conversations automatically switch from `AI_ACTIVE` to `HUMAN_ACTIVE`, notifying the firm staff that manual handling is active until quota reset.
