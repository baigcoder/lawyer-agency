import type { Metadata } from 'next';
import { MarketingFooter } from '@/components/marketing-footer';
import { env } from '@/lib/env';

const LAST_UPDATED = '2026-08-15';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Wakeel collects, uses, and protects data.',
};

export default function PrivacyPage() {
  return (
    <>
      <main id="main" className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="mb-6 text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Last updated: {LAST_UPDATED}
        </p>

      <section className="space-y-4 text-sm leading-7">
        <p>
          Wakeel (“we”, “us”, “our”) is a multi-tenant platform operated by{' '}
          <strong>{env.NEXT_PUBLIC_LEGAL_BUSINESS_NAME}</strong>, registered in Pakistan. This Privacy
          Policy explains how we collect, use, store, and protect personal data when law firms use
          Wakeel to communicate with their clients over WhatsApp.
        </p>

        <h2 className="mt-8 text-lg font-semibold">1. Data we process</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Client messages:</strong> WhatsApp messages, voice notes, and media (documents,
            CNICs, FIRs, notices) sent by clients to a law firm’s WhatsApp number.
          </li>
          <li>
            <strong>Contact information:</strong> WhatsApp phone numbers and display names provided
            by Meta’s webhook payloads.
          </li>
          <li>
            <strong>Firm user data:</strong> Names, email addresses, and role information of lawyers
            and staff using the dashboard.
          </li>
          <li>
            <strong>Case data:</strong> Intake answers, appointment details, payment references, and
            notes added by firm staff.
          </li>
          <li>
            <strong>Technical logs:</strong> Correlation IDs, API request metadata, and AI pipeline
            logs used for debugging and audit. We do not send full message content to third-party
            AI providers by default (see our T1/T2/T3 data posture).
          </li>
        </ul>

        <h2 className="mt-8 text-lg font-semibold">2. How we use data</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>To route WhatsApp messages to the correct law firm and case file.</li>
          <li>To help firm staff triage, summarize, and respond to client inquiries.</li>
          <li>To send appointment reminders, document requests, and payment receipts via WhatsApp.</li>
          <li>To maintain audit trails required for legal practice compliance.</li>
        </ul>

        <h2 className="mt-8 text-lg font-semibold">3. AI and automated decision-making</h2>
        <p>
          Wakeel uses AI to classify intent, extract structured intake data, draft suggested replies,
          and identify urgent escalations. The AI <strong>does not provide legal advice</strong>.
          Legal judgment and final replies are always made by licensed lawyers or authorised firm
          staff.
        </p>

        <h2 className="mt-8 text-lg font-semibold">4. Data sharing</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Each law firm’s data is isolated at the database layer using row-level security. Firm A
            cannot access Firm B’s data.
          </li>
          <li>
            We share data only with service providers needed to operate the platform (e.g. hosting,
            AI inference) under strict processing agreements.
          </li>
          <li>We do not sell personal data or use it for advertising.</li>
        </ul>

        <h2 className="mt-8 text-lg font-semibold">5. Data retention and deletion</h2>
        <p>
          Firm data is retained for the lifetime of the firm’s subscription plus a 90-day export
          window, after which it is hard-deleted. Platform audit logs are retained for 7 years.
          Firms and their clients may request data deletion by emailing{' '}
          <a href={`mailto:${env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL}`} className="text-primary underline">
            {env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>

        <h2 className="mt-8 text-lg font-semibold">6. Security</h2>
        <p>
          WhatsApp Business access tokens are encrypted at rest using AES-256-GCM. All dashboard and
          API traffic is served over HTTPS. Database access is enforced through Row Level Security
          (RLS) and application roles.
        </p>

        <h2 className="mt-8 text-lg font-semibold">7. Legal basis and Pakistani law</h2>
        <p>
          We process data on behalf of law firms, who are the data controllers for their client
          data. Our processing is designed to align with Pakistan’s Prevention of Electronic Crimes
          Act 2016 (PECA 2016) and the draft Personal Data Protection Bill.
        </p>

        <h2 className="mt-8 text-lg font-semibold">8. Contact us</h2>
        <p>
          For privacy questions or deletion requests, contact{' '}
          <a href={`mailto:${env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL}`} className="text-primary underline">
            {env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
      </main>
      <MarketingFooter />
    </>
  );
}
