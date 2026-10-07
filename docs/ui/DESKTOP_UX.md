# Wakeel — Desktop UX & Workstation Ergonomics

**Status:** IMPLEMENTED BASELINE & DESKTOP SPECIFICATION  
**Classification:** Desktop Workstation Optimization, Multi-Column Density, and Keyboard Navigation  
**Target Context:** Senior Advocates and Associates operating from law chambers on 1080p / 1440p monitors  

---

## 1. The Law Chamber Desktop Environment

In the afternoon and evening (3:00 PM – 9:00 PM), Pakistani advocates return to their chambers to review files, prepare arguments, and conduct in-person consultations:
- **Workstations:** Laptops connected to 24–27 inch external monitors, multi-window setups.
- **Cognitive Demands:** Scanning dozens of leads, reviewing uploaded court records, verifying fees, managing team calendars.
- **Speed Requirements:** Fast triage, instant search, zero unnecessary mouse clicks.

---

## 2. Desktop Dual-Pane Layouts

### 2.1 Full-Bleed Priority Inbox
- Dedicated split-pane canvas locks to 100% viewport height (`h-svh`).
- Left list pane (`w-80` to `w-96`) provides continuous visibility of new inbound chats while reading an active matter on the right.
- Right pane provides simultaneous access to the client WhatsApp chat, internal lawyer notes, and active matter details without page reloads.

### 2.2 Overview Command Grid
- 4-column metric grid on `xl` monitors (1280px+).
- Two-column dashboard split: Operational funnel and schedule on the left, urgent escalations and unfulfilled document requests on the right.

---

## 3. Desktop Productivity Standards

1. **Monospace Tabular Alignment:** Case reference codes, dates, and PKR fee amounts align with mathematical precision using `font-mono`.
2. **Context Menus & Direct Actions:** Common actions (change case status, copy phone number, resend invite) execute via single-click dropdowns without requiring full-page navigation.
3. **Multi-Tab Workflows:** All links to cases, clients, and documents support standard middle-click / `Cmd+Click` to open in a new browser tab.
