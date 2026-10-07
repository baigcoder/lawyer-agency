# Wakeel — Design Tokens Specification

**Status:** IMPLEMENTED BASELINE & TOKEN DICTIONARY  
**Classification:** Complete Token Catalog (Color, Typography, Radii, Shadows, WhatsApp)  
**Implementation Source:** `apps/web/src/app/globals.css`  

---

## 1. Global Color Tokens (Light & Dark OKLCH)

### 1.1 Canvas & Surface Tokens

| Token Name | Light Value (OKLCH) | Dark Value (OKLCH) | Intended Semantic Usage |
|---|---|---|---|
| `--background` | `oklch(0.99 0.002 250)` | `oklch(0.145 0.005 285)` | Root canvas background (warm clean white / zinc-950). |
| `--foreground` | `oklch(0.15 0.01 260)` | `oklch(0.985 0 0)` | Primary text and headings. |
| `--card` | `oklch(1 0 0)` | `oklch(0.185 0.006 285)` | Elevated surface for cards, dialogs, widgets (pure white / zinc-900). |
| `--card-foreground` | `oklch(0.15 0.01 260)` | `oklch(0.985 0 0)` | Text rendered on top of card surfaces. |
| `--popover` | `oklch(1 0 0)` | `oklch(0.185 0.006 285)` | Menus, dropdowns, tooltips. |
| `--popover-foreground` | `oklch(0.15 0.01 260)` | `oklch(0.985 0 0)` | Text within popovers and menus. |
| `--border` | `oklch(0.91 0.01 260)` | `oklch(1 0 0 / 8%)` | Container boundaries and dividers. |
| `--input` | `oklch(0.91 0.01 260)` | `oklch(1 0 0 / 12%)` | Input field borders. |
| `--ring` | `oklch(0.6 0.19 152 / 0.5)` | `oklch(0.7 0.17 162 / 0.5)` | Keyboard focus rings. |

### 1.2 Brand & Semantic Tokens

| Token Name | Light Value (OKLCH) | Dark Value (OKLCH) | Intended Semantic Usage |
|---|---|---|---|
| `--primary` | `oklch(0.6 0.19 152)` | `oklch(0.7 0.17 162)` | Primary action buttons, active navigation, key brand elements. |
| `--primary-foreground` | `oklch(0.99 0 0)` | `oklch(0.145 0.01 285)` | Text on primary brand buttons. |
| `--secondary` | `oklch(0.96 0.01 260)` | `oklch(0.24 0.006 285)` | Secondary buttons, subtle badges. |
| `--secondary-foreground` | `oklch(0.25 0.02 260)` | `oklch(0.985 0 0)` | Text on secondary buttons. |
| `--muted` | `oklch(0.96 0.01 260)` | `oklch(0.24 0.006 285)` | Inactive backgrounds, skeleton loaders. |
| `--muted-foreground` | `oklch(0.5 0.02 260)` | `oklch(0.65 0.015 285)` | Secondary metadata, timestamps, subtitles. |
| `--accent` | `oklch(0.94 0.03 152)` | `oklch(0.26 0.04 162)` | Soft highlight surfaces, table row selection. |
| `--accent-foreground` | `oklch(0.35 0.08 152)` | `oklch(0.85 0.12 162)` | Text inside accent highlights. |
| `--destructive` | `oklch(0.577 0.245 27.325)`| `oklch(0.704 0.191 22.216)`| Critical alerts, safety escalations, failed deliveries. |

### 1.3 Sidebar Navigation Tokens

| Token Name | Light Value (OKLCH) | Dark Value (OKLCH) | Usage |
|---|---|---|---|
| `--sidebar` | `oklch(0.99 0.002 250)` | `oklch(0.165 0.005 285)` | Sidebar background canvas. |
| `--sidebar-foreground` | `oklch(0.15 0.01 260)` | `oklch(0.985 0 0)` | Sidebar nav labels. |
| `--sidebar-primary` | `oklch(0.6 0.19 152)` | `oklch(0.7 0.17 162)` | Active nav item background / pill. |
| `--sidebar-accent` | `oklch(0.94 0.03 152)` | `oklch(0.26 0.04 162)` | Hover state background. |
| `--sidebar-border` | `oklch(0.91 0.01 260)` | `oklch(1 0 0 / 8%)` | Vertical separator line between sidebar and main. |

---

## 2. WhatsApp Priority Inbox Tokens (`.wa-inbox`)

To achieve true WhatsApp Web fidelity, the inbox features dedicated tokens:

| Token Name | Light Value (Hex) | Dark Value (Hex) | Description |
|---|---|---|---|
| `--wa-list-bg` | `#ffffff` | `#111b21` | Left conversation list background. |
| `--wa-list-hover` | `#f5f6f6` | `#202c33` | Conversation item hover state. |
| `--wa-list-active`| `#f0f2f5` | `#2a3942` | Selected conversation item background. |
| `--wa-header` | `#f0f2f5` | `#202c33` | Top conversation header background. |
| `--wa-chat-bg` | `#efeae2` | `#0b141a` | Chat canvas background (under doodle pattern). |
| `--wa-in` | `#ffffff` | `#202c33` | Inbound client message bubble. |
| `--wa-out` | `#d9fdd3` | `#005c4b` | Outbound firm message bubble (authentic WhatsApp green). |
| `--wa-in-fg` | `#111b21` | `#e9edef` | Text inside inbound bubble. |
| `--wa-out-fg` | `#111b21` | `#e9edef` | Text inside outbound bubble. |
| `--wa-meta` | `#667781` | `#8696a0` | Timestamp and footer metadata inside bubbles. |
| `--wa-unread` | `#25d366` | `#00a884` | Unread count badge green. |
| `--wa-tick` | `#8696a0` | `#8696a0` | Gray delivery tick (sent / delivered). |
| `--wa-tick-read` | `#53bdeb` | `#53bdeb` | Cyan delivery tick (read receipt). |
| `--wa-composer` | `#ffffff` | `#2a3942` | Bottom text composer input area. |
| `--wa-border` | `#e9edef` | `#222d34` | Chat dividers and list separators. |

---

## 3. Border Radii & Metric Tokens

```css
--radius: 0.75rem; /* 12px base radius */
--radius-sm: calc(var(--radius) * 0.6);  /* ~7.2px */
--radius-md: calc(var(--radius) * 0.8);  /* ~9.6px */
--radius-lg: var(--radius);              /* 12px */
--radius-xl: calc(var(--radius) * 1.4);  /* ~16.8px */
--radius-2xl: calc(var(--radius) * 1.8); /* ~21.6px */
--radius-3xl: calc(var(--radius) * 2.2); /* ~26.4px */
--radius-4xl: calc(var(--radius) * 2.6); /* ~31.2px */
```
