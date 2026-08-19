import type { Metadata } from 'next';
import { MarketingFooter } from '@/components/marketing-footer';
import { env } from '@/lib/env';

const LAST_UPDATED = '2026-08-15';

export const metadata: Metadata = {
  title: 'Data Deletion',
  description: 'How to request deletion of your data from Wakeel.',
};

export default function DataDeletionPage() {
  return (
    <>
      <main id="main" className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="mb-6 text-3xl font-bold tracking-tight">Data Deletion</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Last updated: {LAST_UPDATED}
        </p>

        <section className="space-y-4 text-sm leading-7">
        <p>
          Wakeel respects your right to control your data. This page explains how law firms,
          individual users, and end clients can request deletion of personal data from our platform.
        </p>

        <h2 className="mt-8 text-lg font-semibold">For law firms (tenant administrators)</h2>
        <p>
          If your firm wishes to close its Wakeel account and delete all associated data, email us
          at{' '}
          <a href={`mailto:${env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL}`} className="text-primary underline">
            {env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL}
          </a>{' '}
          from your registered firm email address. Include:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your firm’s legal name</li>
          <li>The email address associated with the Wakeel account</li>
          <li>Your WhatsApp Business phone number connected to Wakeel</li>
          <li>Confirmation that you want the account closed and data deleted</li>
        </ul>
        <p>
          We will confirm receipt within 48 hours. Your data will be exported (if requested) and then
          permanently deleted within 90 days, except where we are required by law to retain it
          longer.
        </p>

        <h2 className="mt-8 text-lg font-semibold">For firm staff users</h2>
        <p>
          If you are a lawyer or staff member and want your user account removed from a firm’s
          Wakeel workspace, contact your firm administrator. They can deactivate your access from
          the dashboard. If the administrator is unresponsive, you may also email us at the address
          above with proof of your association to the firm.
        </p>

        <h2 className="mt-8 text-lg font-semibold">For clients (end users messaging a law firm)</h2>
        <p>
          If you are a client who has messaged a law firm through WhatsApp and want your messages
          or documents deleted, contact the law firm directly — they are the data controller for
          your case information. You may also ask the firm to forward your deletion request to us,
          and we will process it within 30 days.
        </p>

        <h2 className="mt-8 text-lg font-semibold">What we delete</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Firm profile, users, roles, and permissions</li>
          <li>Client contacts, conversations, and messages</li>
          <li>Documents, intake sessions, appointments, and payment records</li>
          <li>WhatsApp account connection tokens and template records</li>
        </ul>

        <h2 className="mt-8 text-lg font-semibold">What we keep</h2>
        <p>
          Platform audit logs (who accessed what and when) may be retained for up to 7 years for
          security, fraud prevention, and legal compliance. These logs do not include message
          content or client documents.
        </p>

        <h2 className="mt-8 text-lg font-semibold">Meta platform data</h2>
        <p>
          If you connected Wakeel through Meta/Facebook, you can also remove the app from your
          Facebook Business Integrations at any time:{' '}
          <a
            href="https://www.facebook.com/settings?tab=applications"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Facebook Business Integrations
          </a>
          . Removing the integration stops future data sharing but does not delete historical data
          already stored in Wakeel; use the email process above for full deletion.
        </p>
      </section>
      </main>
      <MarketingFooter />
    </>
  );
}
