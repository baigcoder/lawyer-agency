import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Inter, Geist_Mono, Noto_Nastaliq_Urdu } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { ThemeScript } from '@/components/theme-script';
import { clerkEnabled } from '@/lib/env';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const urduNastaliq = Noto_Nastaliq_Urdu({
  variable: '--font-urdu-nastaliq',
  subsets: ['arabic'],
});

export const metadata: Metadata = {
  title: { default: 'Wakeel — AI WhatsApp intake for law firms', template: '%s · Wakeel' },
  description:
    'Multi-tenant platform letting law firms run client intake, communication, and case coordination over WhatsApp — with AI that assists lawyers, never replaces them.',
  applicationName: 'Wakeel',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/favicon.ico',
    apple: '/icon.png',
  },
};

/**
 * ClerkProvider is mounted only when keys exist (dev seam D-037); production
 * always has them (env fail-fast). WCAG: skip link is the first focusable
 * element; landmarks live in the route-group layouts.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  const body = (
    <body className={`${inter.variable} ${geistMono.variable} ${urduNastaliq.variable} font-sans antialiased`} suppressHydrationWarning>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Providers>{children}</Providers>
    </body>
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      {clerkEnabled ? (
        <ClerkProvider
          afterSignOutUrl="/"
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInForceRedirectUrl="/dashboard"
          signUpForceRedirectUrl="/dashboard"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
          taskUrls={{
            'choose-organization': '/onboarding',
            'reset-password': '/reset-password',
          }}
        >
          {body}
        </ClerkProvider>
      ) : (
        body
      )}
    </html>
  );
}
