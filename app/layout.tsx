import type { Metadata } from "next";
import Link from "next/link";
import { Providers } from "./providers";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "MapleGamma — The only options intelligence platform built for Canadian markets",
  description: "The only options intelligence platform built for Canadian markets. Quant-grade market intelligence for retail investors.",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/positions", label: "Positions" },
  { href: "/options", label: "Options" },
  { href: "/screener", label: "Screener" },
  { href: "/research", label: "Research" },
  { href: "/models", label: "Models" },
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('mg-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-dvh font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-on-accent"
        >
          Skip to content
        </a>
        <Providers>
          <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <span aria-hidden className="text-brand">◆</span>
                MapleGamma
              </Link>
              <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
                {NAV.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="relative inline-flex h-11 items-center rounded-md px-3 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
              <div className="ml-auto">
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main id="main" className="mx-auto max-w-[1400px] px-4 py-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
