# Wakeel Product Experience Redesign — Audit & Direction

Status: Phase 1 output (audit + direction). Implementation notes and QA findings
live in `REDESIGN_EXECUTION_REPORT.md`.

> The brief referenced `docs/ui/PHASE_NEXT_LEVEL_VISUAL_REDESIGN.md`; that file does
> not exist in the repository. This audit was made against the code, with the
> Phase 16 documents read as claims to verify, not as ground truth.

## 1. Documentation vs implementation

| Phase 16 claim | What the code actually does |
|---|---|
| "Graphite + emerald, no random accents" | `--ai-color*` / `--chat-ai-*` tokens are **indigo (hue 265)**; analytics legend uses `bg-sky-400` and `bg-violet-400`; inbox avatars use an 8-colour rainbow (`wa-format.ts`). |
| "Editorial typography" | One family (Inter) for everything; `--font-heading` = Inter. No display face; hero is a 6xl bold sans poster. |
| "Unmistakable AI vs human messages" | AI/chat tokens are defined in `globals.css` but **used by zero components** (dead tokens). AI draft "Approve & Send" uses a **Sparkles** icon. |
| "Mobile sheet navigation" | Mobile nav is a centred `Dialog` (modal box) listing 13 items with no grouping; no persistent mobile destinations. |
| "Live telemetry indicator" | Sidebar shows a permanently pulsing green "Live Telemetry" dot not wired to anything. |
| "Breadcrumbs" | `Chamber › Whatsapp` — English-only, built by capitalising the URL slug. |
| "WCAG 2.2 AA" | Inbox/escalations/cases use `text-[9px]`/`text-[10px]` for meaningful metadata (19 occurrences across pages); `py-0.2` (not a Tailwind class) in list badges. |
| Bilingual product | Cases page has **1** `t()` call, Escalations **3**, Analytics **6** — Urdu mode leaves most of these workspaces in English. Demo page is entirely hard-coded English. |
| Nav "single source" | Two parallel nav definitions: `components/dashboard-nav.tsx` (4 groups) and `lib/dashboard-nav.ts` (different 4 groups, used by mobile + command menu) — desktop and mobile disagree on grouping. |

Other bugs found while auditing:
- `globals.css` scrollbar: `oklch(var(--foreground) / 12%)` wraps an `oklch()` value in `oklch()` → invalid, thumb never renders.
- `Card` applies `hover:shadow-md` to **every** card, so static information panels "lift" on hover and look clickable.
- Demo copy still sells the removed "pilot bridge" and "25 client slots" (Baileys pilot was removed — Evolution API is the sole transport).

## 2. Route audit (P0 broken · P1 major · P2 meaningful · P3 polish)

| Route | Findings |
|---|---|
| `/` | **P1** Hero is phone mockup + handoff card side-by-side — the transformation (message → matter) is implied, not shown. **P1** Section rhythm is heading → paragraph → 3 cards, repeated 4×. **P2** No display typography; generic SaaS read. **P2** Trust strip = three icon+text items centred (template pattern). |
| `/demo` | **P1** Static, non-interactive, hard-coded English, stale pilot copy; does not show Inbox/Escalation/Dossier/AI-draft — the things a lawyer needs to see. **P1** No visual continuity with the hero. |
| `/dashboard` | **P1** 10+ equal-weight cards; no answer to "what needs attention now". Critical (SLA breach) and informational (guardrails list) have the same visual weight. **P2** Static guardrail list on the overview every day is noise for returning users. |
| Shell / sidebar | **P1** Mobile nav modal with ungrouped list; two nav sources. **P2** Fake telemetry dot; "PRO" badge with no meaning; breadcrumb slug. |
| `/dashboard/inbox` | **P1** 9–10px metadata; rainbow avatars; Sparkles on the approval action; English-only strings in list + empty state. **P2** Constant `animate-pulse` on every needs-human row dilutes urgency. |
| `/dashboard/escalations` | **P1** Mostly untranslated. **P2** Tiny type in SLA chips. |
| `/dashboard/cases` | **P1** Mostly untranslated; CRM-style table, matter reference not the primary identifier. |
| `/dashboard/calendar` | **P2** Hearing info not scannable as court/bench/matter. |
| `/dashboard/payments` | **P2** Amounts not mono/tabular-aligned throughout. |
| `/dashboard/analytics` | **P1** Off-palette sky/violet series. **P2** Charts not framed as questions. |
| `/dashboard/team`, `/settings` | **P3** Coherent but generic; fine to inherit system changes. |
| Empty/loading/error | **P2** Ad-hoc per page (spinner here, skeleton there, raw `error.message` elsewhere). |

## 3. Design direction — "Chambers"

Wakeel's visual language is built from the artefacts of a Pakistani chamber, not
from SaaS tropes:

- **Paper & graphite.** Warm paper canvas in light mode, deep warm graphite in
  dark. Four surface levels (canvas → surface‑1 → surface‑2 → surface‑3)
  separated by tone + hairline border, not glow.
- **Emerald = Wakeel / verified / action.** Amber = attention/pending/review.
  Red = critical. Everything else is graphite. AI is *not* a colour — AI output
  is graphite with a dashed "draft" frame and a provenance label, because AI in
  Wakeel is controlled, not magical.
- **The docket line.** Mono, uppercase, tracked metadata
  (`WK-1042 · LHC LAHORE · CIVIL`) is the recurring signature — matter IDs,
  timestamps, SLA and money are always set in it.
- **Chambers Signal.** One priority vocabulary used everywhere: `critical ·
  urgent · attention · routine · info`, drawn as a coloured rule + label, never
  as a rainbow badge. The same signal appears in the hero, the demo, the
  overview, inbox rows and the sidebar.
- **Matter Formation.** The hero artefact shows a WhatsApp message being turned
  into a docketed matter in seven product states; the demo opens on the same
  matter (`WK-1042`, Ahmed Raza, Lahore) so the visitor moves *deeper into the
  same product*.
- **Approval Gate.** Any AI-drafted outbound is framed as a gate: dashed
  border, "Draft — awaiting lawyer approval", and a solid "Approve & send"
  button — the only filled action in the panel.

### Typography

| Role | Face | Why |
|---|---|---|
| Editorial display (hero, marketing section titles, dossier titles) | **Instrument Serif** 400 (+italic) | One weight → tiny payload; high-contrast serif gives legal authority without Times-style pastiche. Used sparingly, never in dense UI. |
| Interface | **Inter** (existing) | Already loaded; excellent at 12–14px; tabular figures available. Swapping to another grotesk would cost bytes for no user benefit. |
| Docket / numbers / system state | **Geist Mono** (existing) | Matter IDs, timestamps, PKR, SLA. |
| Urdu | **Noto Nastaliq Urdu** (existing) | Display sizes get explicit leading (Nastaliq needs ~1.6–2.2). Serif display is never applied to Urdu; RTL headings fall back to Nastaliq. |

Net change: **+1 font (one weight)**. No new JS dependencies; motion is CSS only.

### Motion

| Tier | Duration | Use |
|---|---|---|
| micro | 140ms | hover, press, focus |
| ui | 220ms | tab/selection change, drawers |
| story | 420–600ms | marketing reveals, Matter Frame state changes |

All motion is opacity/transform; the Matter Frame sequence pauses on hover/focus
and renders its final state statically under `prefers-reduced-motion`.

### Density

Marketing = editorial pacing (large vertical rhythm, max 2 ideas per screen).
Application = 13px base UI text, 32px rows, 12px minimum for any meaningful
metadata (the 9–10px sizes are removed).
