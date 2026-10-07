# Wakeel — Mobile UX & Courthall Ergonomics

**Status:** IMPLEMENTED BASELINE & MOBILE SPECIFICATION  
**Classification:** Smartphone Optimization, Touch Targets, and Field Usage Standards  
**Target Context:** Advocates on mobile devices in District & Sessions Courts, High Court bar rooms, and in transit  

---

## 1. The Real-World Courthall Context

Advocates in Pakistan spend their mornings (8:30 AM – 1:30 PM) physically present in courtrooms and bar associations:
- **Environment:** Noisy bar rooms, poor cellular reception (intermittent 3G/4G), crowded corridors.
- **Form Factor:** 100% smartphone usage during these hours. Advocates do not carry laptops into courtroom hearings.
- **Critical Tasks:** Check cause list reminders, respond to emergency client escalations, verify fee transfers, and review new intake briefs between courtroom calls.

---

## 2. Touch Targets & Ergonomic Standards

1. **Strict 44×44px Hit Boxes:** Every button, tab pill, close icon, and message trigger adheres to minimum 44×44px touch targets.
2. **One-Thumb Operation:** Critical triage controls (Acknowledge Escalation, Approve Draft, Return to Inbox) anchor within the bottom ergonomic thumb zone.
3. **No Precision Hover Dependencies:** Hover-revealed buttons (e.g. inline delete or edit actions) are always accessible on mobile via explicit three-dot overflow menus (`MoreVertical`).

---

## 3. Priority Inbox Mobile Experience

```text
SCREEN 1: Mobile Conversation List
┌───────────────────────────────────────┐
│ [≡] Wakeel Inbox               [🔍]   │
├───────────────────────────────────────┤
│ [All] [Needs Human (2)] [AI Active]   │
├───────────────────────────────────────┤
│ (MR) Malik Rashid            10:45 AM │
│      Bail hearing documents...   (1)  │
│                                       │
│ (FK) Fatima Khan             09:30 AM │
│      Khula consultation fee...        │
└───────────────────────────────────────┘
                   │
                   │ [Tap Conversation]
                   ▼
SCREEN 2: Mobile Conversation Thread
┌───────────────────────────────────────┐
│ [◄ Back] Malik Rashid          [⋮]    │
├───────────────────────────────────────┤
│ ┌───────────────────────────────────┐ │
│ │ ⚠️ HANDOFF BRIEF: POLICE ARREST    │ │
│ │ Client's brother detained at...   │ │
│ └───────────────────────────────────┘ │
│                                       │
│ [Client]: Assalam o alaikum wakeel sb │
│                                       │
│ ┌───────────────────────────────────┐ │
│ │ ▶ ılılı 0:45 Voice Note           │ │
│ └───────────────────────────────────┘ │
├───────────────────────────────────────┤
│ [ Type reply...                 ] [➤] │
└───────────────────────────────────────┘
```

- **Seamless Transitions:** Tapping a thread smoothly transitions the viewport into the detail view.
- **Prominent Back Navigation:** The header features an accessible `ArrowLeft` button returning immediately to the list queue.
- **Audio Routing:** The voice note player handles mobile audio playback smoothly without interrupting background phone calls.
