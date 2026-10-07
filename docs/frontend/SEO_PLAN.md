# Wakeel — Frontend SEO & Public Discovery Plan

**Status:** IMPLEMENTED BASELINE & SEO SPECIFICATION  
**Classification:** Metadata Optimization, Structured Data, and Search Engine Strategy  
**Source Code Reference:** `apps/web/src/app/layout.tsx`, `apps/web/src/app/(marketing)/page.tsx`  

---

## 1. Public Surfaces & Search Architecture

Wakeel divides search visibility into two distinct zones:
1. **Public Marketing & Legal Surfaces (Indexed):**
   - Landing Page (`/`): Optimizes for *"AI legal assistant Pakistan"*, *"WhatsApp front desk for law firms"*, *"Pakistani advocate intake software"*.
   - Product Walkthrough (`/demo`): Interactive demonstration.
   - Compliance Pages (`/privacy`, `/terms`, `/data-deletion`): Required for Meta Business Verification and Google OAuth verification.
2. **Dashboard & Operational Workspaces (Strictly Disallowed):**
   - `/dashboard/*` and `/onboarding/*` declare `noindex, nofollow` headers to protect firm confidentiality.

---

## 2. Meta Tags, OpenGraph & Favicons (`RootLayout`)

Exported in `apps/web/src/app/layout.tsx`:
```typescript
export const metadata: Metadata = {
  title: { default: 'Wakeel — AI WhatsApp intake for law firms', template: '%s · Wakeel' },
  description:
    'Multi-tenant platform letting law firms run client intake, communication, and case coordination over WhatsApp — with AI that assists lawyers, never replaces them.',
  applicationName: 'Wakeel',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/icon.png', sizes: '180x180', type: 'image/png' }],
  },
};
```

---

## 3. Structured Data (Schema.org)

The landing page embeds JSON-LD metadata identifying Wakeel as specialized legal technology:
- `@type: "SoftwareApplication"`
- `applicationCategory: "BusinessApplication / Legal"`
- `operatingSystem: "Web, WhatsApp"`
- `inLanguage: ["en", "ur"]`
- `areaServed: "PK (Pakistan)"`
