# Wakeel — Typography System

**Status:** IMPLEMENTED BASELINE & TYPOGRAPHY SPECIFICATION  
**Classification:** Typeface Architecture, Multi-Script Stacks, and Typographic Scales  
**Source Code References:** `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`  

---

## 1. Multi-Script Font Stacks

Wakeel utilizes three dedicated Google Fonts loaded via `next/font/google` with zero runtime font shifts:

```typescript
// apps/web/src/app/layout.tsx
const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const urduNastaliq = Noto_Nastaliq_Urdu({
  variable: '--font-urdu-nastaliq',
  subsets: ['arabic'],
});
```

### 1.1 Primary Interface: Inter (`--font-inter`)
- **Usage:** All Latin interface elements, navigation items, buttons, form labels, and English legal text.
- **Characteristics:** Neutral, highly legible x-height, distinct letterforms optimized for complex software dashboards.

### 1.2 Operational Monospace: Geist Mono (`--font-geist-mono`)
- **Usage:** Case reference identifiers (`CR-2026-0812`), timestamps, monetary amounts (`PKR 25,000`), phone numbers (`+92 300 1234567`), and IBANs.
- **Characteristics:** Fixed character widths ensuring tabular numbers align vertically in tables and financial ledgers.

### 1.3 National Urdu Script: Noto Nastaliq Urdu (`--font-urdu-nastaliq`)
- **Usage:** Urdu navigation labels, marketing headings, client chat bubbles, and Pakistani legal terms.
- **CSS Declaration in `globals.css`:**
  ```css
  .font-urdu {
    font-family: var(--font-urdu-nastaliq), "Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", serif;
    line-height: 2.1;
  }
  ```

---

## 2. The Nastaliq 2.1 Line-Height Mandate

### The Typography Problem
The Nastaliq calligraphic style is characterized by sloping, cascading words where characters sit on varying baselines with extensive vertical ascenders and downward descenders. Furthermore, Urdu legal texts frequently carry diacritical marks (*a’raab* / اعراب) like *zer*, *zabar*, *pesh*, and *tashdeed*.

When rendered using standard Latin line-heights (1.4–1.5), the top and bottom diacritics are clipped by container boundaries, creating an unprofessional, broken aesthetic.

### The Wakeel Solution
1. **Mandatory 2.1 Line-Height:** Every container displaying Urdu text applies the `.font-urdu` utility class with `line-height: 2.1`.
2. **Dynamic Script Tagging:** Chat bubbles in the Priority Inbox automatically detect whether an inbound message contains Arabic/Urdu unicode ranges (`[\u0600-\u06FF]`). If detected, the bubble is automatically tagged with `font-urdu dir="rtl"` to guarantee graceful rendering.

---

## 3. Typographic Scale & Hierarchy

| Token | Size (px / rem) | Line Height | Tracking | Usage in Legal Dashboard |
|---|---|---|---|---|
| `display-1` | 36px (2.25rem) | 44px (2.75rem) | -0.04em | Landing page hero banner. |
| `h1` | 24px (1.5rem) | 32px (2.0rem) | -0.03em | Primary page headers (`PageHeader` title). |
| `h2` | 20px (1.25rem) | 28px (1.75rem) | -0.02em | Card titles, modal headers, major sections. |
| `h3` | 16px (1.0rem) | 24px (1.5rem) | -0.01em | Sub-sections, widget titles, table section heads. |
| `body-base` | 14px (0.875rem) | 20px (1.25rem) | normal | Standard body text, form inputs, table data. |
| `body-chat` | 15px (0.9375rem)| 22px (1.375rem) | normal | WhatsApp message text bubbles (English/Roman). |
| `urdu-chat` | 16px (1.0rem)   | 33.6px (2.1em)  | normal | WhatsApp message text bubbles (Urdu Nastaliq). |
| `caption` | 12px (0.75rem)  | 16px (1.0rem)   | +0.02em | Timestamps, table column headers, helper labels. |
| `mono-code`| 13px (0.8125rem)| 18px (1.125rem) | 0.0em   | Case numbers, CNIC digits, phone numbers. |
