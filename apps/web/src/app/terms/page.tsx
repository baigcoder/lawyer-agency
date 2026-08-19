import type { Metadata } from 'next';
import { MarketingFooter } from '@/components/marketing-footer';
import { env } from '@/lib/env';

const LAST_UPDATED = '2026-08-15';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms governing use of the Wakeel platform.',
};

export default function TermsPage() {
  return (
    <>
      <main id="main" className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="mb-6 text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Last updated: {LAST_UPDATED}
        </p>

      <section className="space-y-4 text-sm leading-7">
        <p>
          These Terms of Service (“Terms”) govern access to and use of the Wakeel platform
          (“Service”), provided by <strong>{env.NEXT_PUBLIC_LEGAL_BUSINESS_NAME}</strong> (“Provider”), a
          company registered in Pakistan.
        </p>

        <h2 className="mt-8 text-lg font-semibold">1. Description of service</h2>
        <p>
          Wakeel is a software platform that helps law firms manage client intake, communication,
          appointments, documents, and payments through WhatsApp. The Service includes an AI
          assistant that triages and summarises client messages; it does not provide legal advice.
        </p>

        <h2 className="mt-8 text-lg font-semibold">2. Eligibility</h2>
        <p>
          The Service is intended for licensed law firms, lawyers, and their authorised staff. By
          signing up, you represent that you are a legally registered business or practising lawyer
          and that you have authority to bind your firm to these Terms.
        </p>

        <h2 className="mt-8 text-lg font-semibold">3. WhatsApp and Meta terms</h2>
        <p>
          Use of WhatsApp messaging features is subject to Meta’s WhatsApp Business Terms of Service
          and Messaging Policy. Firms must obtain proper opt-in where required, use only approved
          message templates outside the 24-hour session window, and comply with Meta’s commerce and
          quality policies.
        </p>

        <h2 className="mt-8 text-lg font-semibold">4. AI disclaimer</h2>
        <p>
          Wakeel’s AI assists with intake, classification, summarisation, and drafting suggested
          replies. It <strong>does not provide legal advice</strong> and must not be relied upon as a
          substitute for a licensed lawyer. The firm is solely responsible for all legal advice,
          opinions, and communications sent to clients.
        </p>

        <h2 className="mt-8 text-lg font-semibold">5. Data and confidentiality</h2>
        <p>
          Provider processes firm and client data in accordance with the Wakeel Privacy Policy. Each
          firm’s data is logically isolated from other firms. Provider will maintain commercially
          reasonable administrative, physical, and technical safeguards to protect data.
        </p>

        <h2 className="mt-8 text-lg font-semibold">6. Acceptable use</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>You will not use the Service for spam, harassment, or unsolicited marketing.</li>
          <li>You will not attempt to reverse engineer, scrape, or abuse the platform.</li>
          <li>You will comply with all applicable Pakistani laws, including PECA 2016.</li>
        </ul>

        <h2 className="mt-8 text-lg font-semibold">7. Payments and subscriptions</h2>
        <p>
          Subscription fees, messaging costs, and payment processor fees are billed as described in
          the firm’s subscription plan. WhatsApp messaging costs are charged directly by Meta; the
          firm is responsible for its own Meta billing account.
        </p>

        <h2 className="mt-8 text-lg font-semibold">8. Termination</h2>
        <p>
          Either party may terminate the subscription with notice. Upon termination, the firm has a
          90-day export window, after which data is hard-deleted subject to applicable legal
          retention obligations.
        </p>

        <h2 className="mt-8 text-lg font-semibold">9. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Provider’s liability is limited to the amount paid
          by the firm in the 12 months preceding the claim. Provider is not liable for the firm’s
          legal advice or client outcomes.
        </p>

        <h2 className="mt-8 text-lg font-semibold">10. Governing law</h2>
        <p>
          These Terms are governed by the laws of the Islamic Republic of Pakistan. Disputes shall
          be resolved in the courts of Lahore, Pakistan.
        </p>

        <h2 className="mt-8 text-lg font-semibold">11. Contact</h2>
        <p>
          For questions about these Terms, contact{' '}
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
