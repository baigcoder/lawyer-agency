import { z } from 'zod';

/**
 * Frontend environment, validated at import time (fail-fast, same standard
 * as the backend). NEXT_PUBLIC_* vars are inlined at build time — they must
 * never carry secrets.
 */
const envSchema = z.object({
  NEXT_PUBLIC_API_BASE: z.string().default('/backend'),
  // Clerk is optional in development only (dev seam, D-037) — the dashboard
  // renders with a banner and the API is exercised via the dev tenant header.
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  // Development seam only: sent as x-tenant-id when Clerk is disabled.
  NEXT_PUBLIC_DEV_TENANT_ID: z.string().optional(),
  // Legal page contact details (privacy/terms/data-deletion). Public env so
  // they're inlined at build; fall back to sensible defaults when unset.
  NEXT_PUBLIC_LEGAL_BUSINESS_NAME: z.string().default('Wakeel Technologies (Pvt) Ltd'),
  NEXT_PUBLIC_LEGAL_CONTACT_EMAIL: z.string().email().default('privacy@wakeel.pk'),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_DEV_TENANT_ID: process.env.NEXT_PUBLIC_DEV_TENANT_ID,
  NEXT_PUBLIC_LEGAL_BUSINESS_NAME: process.env.NEXT_PUBLIC_LEGAL_BUSINESS_NAME,
  NEXT_PUBLIC_LEGAL_CONTACT_EMAIL: process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL,
});

export const clerkEnabled = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== undefined;
