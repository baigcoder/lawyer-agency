# Wakeel — Frontend Accessibility Plan & Roadmap

**Status:** IMPLEMENTED BASELINE & REMEDIATION PLAN  
**Classification:** Accessibility Roadmap, WCAG 2.2 AA Conformance, and Screen Reader Testing  
**Standards Body:** W3C Web Accessibility Initiative (WAI) WCAG 2.2 Level AA  

---

## 1. Actionable Accessibility Remediation Roadmap

Based on the forensic accessibility audit (`docs/ui/ACCESSIBILITY_AUDIT.md`), the following remediation milestones are defined:

| Priority | Milestone / Remediation Target | Component Affected | Implementation Plan |
|---|---|---|---|
| **P0 (Immediate)** | Audio Scrubber Accessible Slider | `components/inbox/voice-note.tsx` | Add `role="slider"`, `aria-label="Voice note audio scrubber"`, `aria-valuemin="0"`, `aria-valuemax`, and arrow key step handlers. |
| **P0 (Immediate)** | Live Region for Incoming Escalations | `components/inbox/inbox-alert-watcher.tsx` | Wrap emergency alerts in `<div role="status" aria-live="assertive">` to announce crises immediately. |
| **P1 (Next)** | Explicit Helper Text Associations | `components/ui/field.tsx` | Connect `FieldDescription` IDs to input `aria-describedby` attributes deterministically. |
| **P1 (Next)** | High-Glare Outdoor Contrast Mode | `globals.css` | Enhance dark mode borders for courtroom glare scenarios (+10% contrast). |
| **P2 (Polish)** | Screen Reader Voice Note Transcripts | `components/inbox/voice-note.tsx` | Ensure Whisper STT text is exposed as accessible transcript text (`<details>` / `<summary>`). |

---

## 2. Automated & Manual Verification Procedures

1. **Automated CI Accessibility Gate:**
   - Integrate `@axe-core/playwright` into frontend CI workflows.
   - Any pull request introducing WCAG Level A or AA violations fails CI automatically.
2. **Manual Screen Reader Testing Matrix:**
   - **macOS / iOS:** VoiceOver on Safari. Verify skip links, dialog traps, and Urdu Nastaliq pronunciation.
   - **Windows:** NVDA / JAWS on Google Chrome. Verify table column headers and audio waveform controls.
