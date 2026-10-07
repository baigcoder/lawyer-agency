# Wakeel — Chat Patterns & Message Canvas Specification

**Status:** IMPLEMENTED BASELINE & VISUAL SPECIFICATION  
**Classification:** Chat Bubble Geometry, Canvas Rendering, Media Audio, and Composer Standards  
**Source Code References:** `apps/web/src/components/inbox/conversation-detail.tsx`, `apps/web/src/components/inbox/voice-note.tsx`, `apps/web/src/app/globals.css`  

---

## 1. The WhatsApp Canvas (`.wa-thread`)

The thread canvas faithfully replicates WhatsApp Web's iconic subtle background:

```css
.wa-thread {
  background-color: var(--wa-chat-bg);
  background-image:
    radial-gradient(circle at 18% 22%, color-mix(in srgb, var(--wa-meta) 14%, transparent) 0 1.1px, transparent 1.6px),
    radial-gradient(circle at 72% 68%, color-mix(in srgb, var(--wa-meta) 11%, transparent) 0 1px, transparent 1.5px),
    radial-gradient(circle at 40% 80%, color-mix(in srgb, var(--wa-meta) 8%, transparent) 0 0.8px, transparent 1.3px);
  background-size: 28px 28px, 36px 36px, 22px 22px;
}
```

---

## 2. Message Bubble Geometry & Script Rendering

### 2.1 Bubble Tiers & Colors
- **Inbound (Client):**
  - Light: `#ffffff` (`--wa-in`) | Dark: `#202c33`
  - Text: `#111b21` (`--wa-in-fg`) | Dark: `#e9edef`
  - Alignment: Start edge (left in LTR, right in RTL).
- **Outbound (Firm Advocate / AI):**
  - Light: `#d9fdd3` (`--wa-out`) | Dark: `#005c4b`
  - Text: `#111b21` (`--wa-out-fg`) | Dark: `#e9edef`
  - Alignment: End edge (right in LTR, left in RTL).

### 2.2 Script Detection & Dynamic Line Heights
Each message bubble evaluates its textual content:
- If Arabic/Urdu unicode characters (`\u0600-\u06FF`) are present, the text receives `.font-urdu` with `line-height: 2.1` to prevent diacritic clipping.
- If English or Roman Urdu, standard Latin typography (`Inter`, `line-height: 1.4`) applies.

### 2.3 Delivery Ticks Component (`DeliveryTicks`)
Rendered at the trailing bottom corner of all outbound bubbles:
- **`QUEUED`:** Muted clock icon (`Clock`).
- **`SENT`:** Single gray check (`Check` in `#8696a0`).
- **`DELIVERED`:** Double gray check (`CheckCheck` in `#8696a0`).
- **`READ`:** Double cyan check (`CheckCheck` in `#53bdeb`).
- **`FAILED`:** Red exclamation badge with failure explanation tooltip.

---

## 3. Audio Voice Notes Player (`voice-note.tsx`)

Given that over 40% of legal queries in Pakistan originate as WhatsApp voice notes, Wakeel includes a bespoke audio playback interface:
- **Play / Pause Button:** Circular button toggling HTML5 audio stream playback.
- **Waveform Canvas:** Visual representation of audio peaks.
- **Duration Counter:** Shows remaining playback time (`0:42 / 1:15`).
- **STT Transcript Dropdown:** Below the player, advocates can expand the Whisper transcription (English / Urdu translation).

---

## 4. Message Composer & 24-Hour Window Countdown

- **Textarea Composer:** Expandable input with emoji support and quick canned response templates.
- **24-Hour Window Badge:**
  - When open: Displays remaining window hours (e.g. `"Window open: 18h remaining"`).
  - When closed: Input is disabled; displays warning: `"24h session window closed. Proactive replies require an approved Meta template."`
