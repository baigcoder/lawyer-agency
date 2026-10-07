# Wakeel — Frontend Route Map

**Status:** IMPLEMENTED BASELINE & ROUTE INVENTORY  
**Classification:** Complete Next.js 16 App Router Sitemap & Route Specifications  
**Audit Date:** 2026-10-07  

---

## 1. Route Map Matrix

| Route Path | File Location | Layout Wrapper | Auth / Permission Gate | Target Persona | Primary Purpose |
|---|---|---|---|---|---|
| `/` | `app/(marketing)/page.tsx` | RootLayout | Public | Prospective Law Firms | Bilingual landing page with phone mockup and pilot CTA. |
| `/demo` | `app/(marketing)/demo/page.tsx` | RootLayout | Public | Prospective Law Firms | Interactive product walkthrough and demo dashboard. |
| `/sign-in[[...sign-in]]` | `app/(auth)/sign-in/[[...sign-in]]/page.tsx` | RootLayout | Public (Clerk) | Law Firm Staff | Clerk user authentication sign-in screen. |
| `/sign-up[[...sign-up]]` | `app/(auth)/sign-up/[[...sign-up]]/page.tsx` | RootLayout | Public (Clerk) | Law Firm Partners | New firm registration and account creation. |
| `/reset-password` | `app/(auth)/reset-password/[[...reset-password]]/page.tsx` | RootLayout | Public / Temp Auth | Invited Staff | Password reset flow for team members joining via temporary passwords. |
| `/onboarding` | `app/onboarding/page.tsx` | RootLayout | Auth Required | Firm Managing Partner | 4-step initial firm provisioning wizard. |
| `/dashboard` | `app/(dashboard)/dashboard/page.tsx` | DashboardLayout | `firm-profile:read` | All Firm Users | Command center overview with metrics, schedule, and AI controls. |
| `/dashboard/inbox` | `app/(dashboard)/dashboard/inbox/page.tsx` | DashboardLayout (`inboxMode`) | `inbox:read` | Advocates, Clerks | Full-screen WhatsApp Web priority triage console. |
| `/dashboard/escalations`| `app/(dashboard)/dashboard/escalations/page.tsx`| DashboardLayout | `inbox:read` | Advocates, Partners | Urgent safety escalation queue with structured handoff briefs. |
| `/dashboard/cases` | `app/(dashboard)/dashboard/cases/page.tsx` | DashboardLayout | `cases:read` | Advocates, Clerks | Active legal matters ledger and status transitions. |
| `/dashboard/documents` | `app/(dashboard)/dashboard/documents/page.tsx` | DashboardLayout | `cases:write` | Advocates, Partners | Client court document management and RAG indexing. |
| `/dashboard/knowledge` | `app/(dashboard)/dashboard/knowledge/page.tsx` | DashboardLayout | `knowledge-base:read`| Advocates, Partners | Verified FAQ authoring and publishing console. |
| `/dashboard/calendar` | `app/(dashboard)/dashboard/calendar/page.tsx` | DashboardLayout | `appointments:read` | Advocates, Staff | Consultation schedule, Google Calendar sync, meeting bookings. |
| `/dashboard/team` | `app/(dashboard)/dashboard/team/page.tsx` | DashboardLayout | `users:read` | Managing Partners | Firm roster, Clerk invitations, lawyer weekly availability schedules. |
| `/dashboard/whatsapp` | `app/(dashboard)/dashboard/whatsapp/page.tsx` | DashboardLayout | `whatsapp:read` | Managing Partners | Official WhatsApp Business API setup and Evolution instance health. |
| `/dashboard/payments` | `app/(dashboard)/dashboard/payments/page.tsx` | DashboardLayout | `payments:read` | Partners, Clerks | Pakistan fee collection ledger, screenshot proofs, PDF receipts. |
| `/dashboard/analytics`| `app/(dashboard)/dashboard/analytics/page.tsx`| DashboardLayout | `analytics:read` | Managing Partners | Conversion funnels, practice area revenue, and AI volume reporting. |
| `/dashboard/settings` | `app/(dashboard)/dashboard/settings/page.tsx` | DashboardLayout | `anyOf` (Admin) | Managing Partners | Firm profile, AI assumptions, voice receptionist, notifications. |
| `/dashboard/setup` | `app/(dashboard)/dashboard/setup/page.tsx` | DashboardLayout | `users:manage` | Managing Partners | 3-step setup hub with QR connection and test inbound simulator. |
| `/privacy` | `app/privacy/page.tsx` | RootLayout | Public | General Public | Privacy policy compliant with PECA 2016 and draft PDPB. |
| `/terms` | `app/terms/page.tsx` | RootLayout | Public | General Public | Terms of service and attorney-client relationship boundaries. |
| `/data-deletion` | `app/data-deletion/page.tsx` | RootLayout | Public | WhatsApp Users | Meta-mandated data deletion instructions for WhatsApp users. |
