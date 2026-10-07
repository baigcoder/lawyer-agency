# Wakeel — Empty States Specification

**Status:** IMPLEMENTED BASELINE & ENHANCEMENT SPECIFICATION  
**Classification:** Zero-Data Views, First-Run Screens, and Educational Guidance  
**Target Quality Bar:** Actionable, Dignified, Lawyer-Centric  

---

## 1. Empty State Design Anatomy

In legal operations software, an empty state must never be a dead end, a generic illustration, or a flippant message. It must answer three questions:
1. **What belongs here?** (Clear legal context).
2. **Why is it currently empty?** (System status explanation).
3. **What is the next operational action?** (Direct action button or guidance).

```text
┌────────────────────────────────────────────────────────┐
│                      [ ICON TILE ]                     │
│               (Primary tinted emerald glyph)           │
│                                                        │
│                    Primary Heading                     │
│              (e.g., "No open safety escalations")      │
│                                                        │
│                 Explanatory Subtitle                   │
│       (Clear explanation of system conditions)         │
│                                                        │
│               [ PRIMARY ACTION BUTTON ]                │
│         (e.g., "Open Priority Inbox" / "New Case")     │
└────────────────────────────────────────────────────────┘
```

---

## 2. Page-by-Page Empty State Matrix

### 2.1 Escalations Queue (`/dashboard/escalations`)
- **Status When Empty:** **Positive / Optimal State**
- **Heading:** `"All clear — no open safety escalations"`
- **Urdu:** `"تمام معاملات تسلی بخش ہیں — کوئی ہنگامی صورتحال نہیں"`
- **Body:** `"Client conversations are proceeding through standard automated intake. Any domestic violence, arrest, or urgent court deadlines will trigger instant alerts here."`
- **Action:** `"Review Priority Inbox"` (Link to `/dashboard/inbox`).

### 2.2 Priority Inbox (`/dashboard/inbox`)
- **Left Pane (No Conversations):**
  - Heading: `"No conversations match this filter"`
  - Body: `"Switch filter tabs or share your connected WhatsApp number with prospective clients to begin intake."`
- **Right Pane (No Thread Selected):**
  - Heading: `"Select a conversation to begin review"`
  - Body: `"Choose a thread from the queue on the left to read client messages, inspect voice notes, and review structured intake briefs."`

### 2.3 Legal Matters Table (`/dashboard/cases`)
- **Heading:** `"No legal matters in this view"`
- **Body:** `"Matters are created automatically when client intake qualifies a prospective case, or manually by converting an active WhatsApp conversation."`
- **Action:** `"Convert from Inbox"` (Link to `/dashboard/inbox`).

### 2.4 Consultation Calendar (`/dashboard/calendar`)
- **Heading:** `"No consultations scheduled for this period"`
- **Body:** `"Available consultation slots are automatically offered to qualified clients on WhatsApp. You can also manually book a meeting."`
- **Action:** `"Book Consultation"` (Triggers booking dialog).

### 2.5 Document Repository (`/dashboard/documents`)
- **Heading:** `"No documents uploaded"`
- **Body:** `"Documents sent by clients over WhatsApp appear here automatically once downloaded. You can also upload case petitions, fard copies, or FIRs manually."`
- **Action:** `"Upload Document"` (Triggers file picker).

### 2.6 Knowledge Base (`/dashboard/knowledge`)
- **Heading:** `"Your firm knowledge base is empty"`
- **Body:** `"Add answers to common client questions (fees, office timings, required documents) to ground the AI receptionist in your firm's verified policies."`
- **Action:** `"Create First FAQ Entry"` (Opens authoring form).

### 2.7 Payments & Fee Collection (`/dashboard/payments`)
- **Heading:** `"No fee records found"`
- **Body:** `"Request consultation fees or retainer payments from active clients directly from the inbox or appointment calendar."`
- **Action:** `"Configure Bank & Wallet Details"` (Opens settings card).
