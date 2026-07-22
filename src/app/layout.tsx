// app/layout.tsx — root layout
import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Instrument_Serif, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { AppShell } from '@/components/layout/AppShell';
import { FeedbackBubble } from '@/components/feature/feedback/FeedbackBubble';

// Self-hosted at build time with size-adjusted fallbacks — the previous Google
// Fonts <link> caused a visible swap reflow (layout shift) on narrow viewports.
const fontSans = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});
const fontDisplay = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
});
const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

const SITE = 'https://maplegamma.com';
const DESCRIPTION =
  'Institutional-grade gamma exposure, options flow, and AI market conviction — GEX, DEX, and VEX in one terminal.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'MapleGamma — Options Intelligence',
    template: '%s | MapleGamma',
  },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'MapleGamma',
    url: '/',
    title: 'MapleGamma — Options Intelligence',
    description: DESCRIPTION,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'MapleGamma — Options Intelligence' }],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MapleGamma — Options Intelligence',
    description: DESCRIPTION,
    images: ['/og.png'],
  },
};

// Organization + WebSite structured data (site-wide).
const ORG_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'MapleGamma',
  url: SITE,
  logo: `${SITE}/icon.svg`,
};
const SITE_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'MapleGamma',
  url: SITE,
  description: DESCRIPTION,
};

export const viewport: Viewport = {
  themeColor: '#09090B',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_LD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_LD) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var saved = localStorage.getItem('mg-ui');
                var theme = 'dark';
                var density = 'comfortable';
                try {
                  if (saved) {
                    var s = JSON.parse(saved).state;
                    theme = s.theme || 'dark';
                    density = s.density || 'comfortable';
                  }
                } catch(e) {}
                document.documentElement.setAttribute('data-theme', theme);
                document.documentElement.setAttribute('data-density', density);
              })();
            `,
          }}
        />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
          <FeedbackBubble />
        </Providers>
      </body>
    </html>
  );
}
