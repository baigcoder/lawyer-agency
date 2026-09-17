import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Inter, Geist_Mono, Noto_Nastaliq_Urdu } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { LanguageScript } from '@/components/language-script';
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
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      // .ico first so legacy consumers that ignore `type` still resolve; modern
      // browsers prefer the SVG and scale it cleanly at any tab density.
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/icon.png', sizes: '180x180', type: 'image/png' }],
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
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
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
        <LanguageScript />
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
