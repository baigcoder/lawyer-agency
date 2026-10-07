# Wakeel — Component Inventory

**Status:** FORENSIC REPOSITORY INVENTORY  
**Classification:** Complete Catalog of UI Primitives, Domain Molecules, and Operational Widgets  
**Location:** `apps/web/src/components/`  

---

## 1. UI Primitives (`apps/web/src/components/ui/`)

| Component | Basis / Library | Exported Tokens / Variants | Forensic Observations |
|---|---|---|---|
| `avatar.tsx` | Custom | Avatar, AvatarImage, AvatarFallback | Clean initials rendering with circular mask. |
| `badge.tsx` | Custom CVA | `default`, `secondary`, `destructive`, `outline` | Status indicators and urgency pills. |
| `button.tsx` | `@base-ui/react/button` | `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`; sizes: `xs`, `sm`, `default`, `lg`, `icon*` | Full Base UI `render` prop support. Focus rings standard. |
| `card.tsx` | Custom HTML | Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter | Elevated card container (`--card`). |
| `checkbox.tsx` | Custom | Checkbox | Checkbox control with primary brand check. |
| `dialog.tsx` | `@base-ui/react/dialog` | Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose | Accessible modal dialog with backdrop blur and zoom animations. |
| `dropdown-menu.tsx` | `@base-ui/react/menu` | DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator | Floating menus and selection popovers. |
| `field.tsx` | Custom | Field, FieldLabel, FieldDescription, FieldError | Form wrapper displaying label and Zod validation errors. |
| `input.tsx` | Custom `<input>` | Standard HTML input styling | Styled border, ring on focus, invalid states. |
| `label.tsx` | Custom `<label>` | Label | Accessible form label with font-medium. |
| `select.tsx` | `@base-ui/react/select` | Select, SelectTrigger, SelectValue, SelectContent, SelectItem | Styled select picker. |
| `separator.tsx` | Custom `<hr>` | Separator (horizontal / vertical) | Border-border division lines. |
| `skeleton.tsx` | Custom `<div>` | Skeleton | Pulsing animated loading placeholder. |
| `sonner.tsx` | `sonner` | Toaster | Rich toast notifications. |
| `switch.tsx` | `@base-ui/react/switch` | Switch | Accessible thumb toggle switch. |
| `table.tsx` | Semantic HTML `<table>` | Table, TableHeader, TableBody, TableHead, TableRow, TableCell | Dense operational tabular view. |
| `tabs.tsx` | `@base-ui/react/tabs` | Tabs, TabsList, TabsTrigger, TabsContent | Accessible tab navigation. |
| `textarea.tsx` | Custom `<textarea>` | Textarea | Styled multiline text input. |

---

## 2. Domain & Application Components (`apps/web/src/components/`)

| Component | File Path | Purpose & Key Features |
|---|---|---|
| `ai-settings-card.tsx` | `components/ai-settings-card.tsx` | AI prompt assumptions, tone selection, ElevenLabs voice preview, intro generator. |
| `calendar-connection-card.tsx` | `components/calendar-connection-card.tsx` | Google Calendar OAuth link, sync trigger, active connected email display. |
| `clerk-user-menu.tsx` | `components/clerk-user-menu.tsx` | User profile avatar and sign-out trigger for Clerk authenticated sessions. |
| `dashboard-nav.tsx` | `components/dashboard-nav.tsx` | Main navigation list with active route pills, permission filtering, badges. |
| `document-manager.tsx` | `components/document-manager.tsx` | Client document table, file uploader, RAG pin toggle, download action. |
| `document-requests-card.tsx` | `components/document-requests-card.tsx` | Active document requests issued to clients over WhatsApp with status badges. |
| `firm-profile-form.tsx` | `components/firm-profile-form.tsx` | Form for editing firm legal name, city, address, practice areas, office hours. |
| `forbidden-state.tsx` | `components/forbidden-state.tsx` | Access denied error state when a user lacks route permissions. |
| `header-whatsapp-status.tsx` | `components/header-whatsapp-status.tsx` | Top header indicator displaying live WhatsApp connection health. |
| `language-toggle.tsx` | `components/language-toggle.tsx` | One-click language switcher between English and Urdu. |
| `metric-card.tsx` | `components/metric-card.tsx` | KPI stat card with icon tile, value, label, and trend indicator. |
| `mobile-nav.tsx` | `components/mobile-nav.tsx` | Responsive hamburger sheet drawer for mobile screen sizes. |
| `owner-profile-card.tsx` | `components/owner-profile-card.tsx` | Senior partner credentials, Bar council registration number, featured cases. |
| `page-header.tsx` | `components/page-header.tsx` | Standardized page title header with icon, heading, and description. |
| `payment-receiving-details-card.tsx` | `components/payment-receiving-details-card.tsx` | Configuration card for firm bank account (IBAN), JazzCash, and Easypaisa details. |
| `theme-toggle.tsx` | `components/theme-toggle.tsx` | Smooth dark/light mode toggle with sun/moon icon. |
| `user-menu.tsx` | `components/user-menu.tsx` | Contextual user menu wrapper handling both Clerk and dev seam modes. |
| `whatsapp-connection-card.tsx` | `components/whatsapp-connection-card.tsx` | Evolution API connection card showing QR code, instance health, reconnect actions. |
| `whatsapp-phone-mockup.tsx` | `components/whatsapp-phone-mockup.tsx` | Realistic mobile device mockup demonstrating Urdu WhatsApp client conversation. |

---

## 3. Specialized Subsystem Components

### 3.1 Priority Inbox (`components/inbox/`)
- `conversation-list.tsx`: Searchable left-hand conversation queue with unread badges, timestamps, matter tags.
- `conversation-detail.tsx`: Split-pane right-side thread viewer with message bubbles, action tray, lawyer notes drawer.
- `voice-note.tsx`: Audio player with interactive waveform scrubber, play/pause controls, duration counters.
- `wa-format.ts`: Utilities for authentic WhatsApp formatting, timestamps, day divider checks, avatar colors.

### 3.2 Overview Widgets (`components/overview/`)
- `ai-controls.tsx`: Quick toggles for AI Auto-Reply, Draft Approval Mode, Urdu replies.
- `sla-banner.tsx`: Warning banner alerting advocates to approaching or breached safety SLAs.
- `funnel-strip.tsx`: 4-stage funnel visualization (Lead → Qualified → Booked → Retained).
- `today-schedule.tsx`: Consolidated daily agenda combining court hearings and consultations.
- `escalation-preview.tsx`: Quick list of open safety escalations requiring attention.

### 3.3 Escalations (`components/escalations/`)
- `handoff-brief-view.tsx`: Structured briefing card displaying trigger reason, client facts, and recommended next action.
