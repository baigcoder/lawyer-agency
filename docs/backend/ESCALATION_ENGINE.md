# Wakeel — Escalation Engine & Safety Triage Architecture

**Status:** IMPLEMENTED BASELINE & SAFETY POLICY  
**Classification:** Emergency Legal Triage, Deterministic Bypasses, and SLA Monitoring  
**Source Code References:** `apps/api/src/modules/ai/application/escalation-detector.service.ts`, `apps/api/src/modules/ai/application/escalation-keywords.ts`, `apps/api/src/modules/notifications/application/escalation-sla.monitor.ts`  

---

## 1. Safety Philosophy & Deterministic Bypasses (D-009)

In legal technology, relying purely on probabilistic LLMs to detect crises is an unacceptable risk. If an LLM misinterprets a suicide threat or an active arrest as a routine enquiry, the consequences can be fatal or legally catastrophic.

### The Wakeel Safety Rule
All inbound messages pass through a **deterministic regex keyword scanner** before any generative LLM is invoked:
- **100% Red-Team Recall Gate:** If safety trigger patterns match, the generative AI pipeline is **completely bypassed**.
- The assistant immediately replies with a fixed emergency disclosure and crisis helpline numbers.
- A high-priority escalation is opened on the firm's dashboard.

---

## 2. Trigger Classifications & Multilingual Regex Matchers

Supported across English, Urdu (Arabic script), and Roman Urdu:

| Trigger Category | Sample Pattern Keywords (EN / UR / Roman Urdu) | Default SLA Target | Immediate Automated Action |
|---|---|:---:|---|
| **Domestic Violence (DV)** | `"maar peet"`, `"violence"`, `"tashaddud"`, `"husband beat"`, `"dhamki de raha hai"`, `"jan ka khatra"` | 15 Minutes | Halts bot, alerts partner, provides National Crisis Helpline (1099 / 15). |
| **Police Arrest / Custody** | `"arrest"`, `"thana"`, `"police pakar"`, `"FIR darj"`, `"lockup"`, `"baghair warrant"` | 15 Minutes | Halts bot, alerts criminal defense advocate, flags active detention. |
| **Self-Harm / Suicide** | `"khudkushi"`, `"suicide"`, `"marna chahta hoon"`, `"end my life"`, `"zindagi khatam"` | Immediate (0m) | Halts bot, returns mental health emergency hotline (042-35761999). |
| **Urgent Court Deadline** | `"kal peshi"`, `"parson date"`, `"hearing tomorrow"`, `"24 ghante"`, `"stay order kharij"` | 30 Minutes | Flags matter urgency to `CRITICAL`, creates immediate lawyer task. |

---

## 3. Structured Lawyer Handoff Brief (D-123)

Upon escalation, `HandoffBriefAgent` compiles a structured briefing stored on `app.escalations(handoffBrief)`:
```json
{
  "triggerReason": "POLICE_ARREST",
  "situation": "Client reports brother was detained without warrant by Gulberg police station this evening. Tomorrow morning remand hearing expected.",
  "clientFacts": {
    "accusedName": "Tariq Mahmood",
    "policeStation": "Gulberg, Lahore",
    "offenceAlleged": "Section 489-F PPC"
  },
  "openItems": ["Vakalatnama required", "Bail petition drafting", "FIR copy collection"],
  "recommendedAction": "Contact client immediately to arrange pre-court chamber consultation."
}
```

---

## 4. SLA Monitoring BullMQ Worker (`escalation-sla.monitor.ts`)

- A scheduled BullMQ job (`escalation-sla-monitor`) runs every 60 seconds on the `notifications` queue.
- Queries `app.escalations` for records where `status = 'OPEN'` and `slaExpiresAt < now()`.
- Emits `escalation.sla_breached` domain events, triggering elevated dashboard audio chimes and red warning banners (`SlaBanner`) on the firm overview.
