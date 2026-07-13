// components/layout/AppShell.tsx — providers + shell + nav
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUI } from '@/stores/ui';
import { GammaMark } from '@/components/brand/GammaMark';
import { TickerTape } from './TickerTape';

type IconProps = { className?: string };

const iconDefaults = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function IconGrid({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconLayers({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className} aria-hidden="true">
      <path d="M12 3.5 21 8l-9 4.5L3 8l9-4.5Z" />
      <path d="m3 12.5 9 4.5 9-4.5" />
      <path d="m3 16.5 9 4.5 9-4.5" />
    </svg>
  );
}

function IconTarget({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconPulse({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className} aria-hidden="true">
      <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />
    </svg>
  );
}

function IconSun({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" />
    </svg>
  );
}

function IconMoon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className} aria-hidden="true">
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
    </svg>
  );
}

function IconBook({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className} aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5Z" />
      <path d="M4 18a2.5 2.5 0 0 1 2.5-2.5H20" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: '/dashboard/', label: 'Dashboard', Icon: IconGrid },
  { href: '/positions/', label: 'Positions', Icon: IconLayers },
  { href: '/options/', label: 'Options', Icon: IconTarget },
  { href: '/models/', label: 'Models', Icon: IconPulse },
];

function normalizePath(p: string) {
  const stripped = p.replace(/\/+$/, '');
  return stripped === '' ? '/' : stripped;
}

function isNavActive(pathname: string, href: string) {
  const path = normalizePath(pathname);
  const target = normalizePath(href);
  return path === target || path.startsWith(`${target}/`);
}

function MarketStatusPill() {
  // Market hours derive from the clock; compute only after mount so the
  // static-export HTML and first client render match.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] bg-[var(--color-bg-elevated)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-tertiary)]" aria-hidden="true" />
        Market —
      </span>
    );
  }

  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  const isOpen = day >= 1 && day <= 5 && hour >= 13 && hour < 21; // 9:30-4 ET approx

  return (
    <span
      className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-[0.12em]"
      style={{
        backgroundColor: isOpen ? 'var(--color-bull-soft)' : 'var(--color-bg-elevated)',
        color: isOpen ? 'var(--color-bull)' : 'var(--color-text-tertiary)',
      }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: isOpen ? 'var(--color-bull)' : 'var(--color-text-tertiary)' }}
        aria-hidden="true"
      />
      {isOpen ? 'Market open' : 'Market closed'}
    </span>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useUI();

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      {theme === 'dark' ? <IconSun /> : <IconMoon />}
    </button>
  );
}

function LearningModeToggle() {
  const { learningMode, toggleLearningMode } = useUI();

  return (
    <button
      onClick={toggleLearningMode}
      className="min-w-11 min-h-11 flex items-center justify-center rounded-lg transition-colors"
      style={{
        color: learningMode ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        backgroundColor: learningMode ? 'var(--color-accent-dim)' : 'transparent',
      }}
      aria-label={learningMode ? 'Disable learning mode' : 'Enable learning mode'}
      title="Learning Mode — shows tooltips for jargon"
    >
      <IconBook />
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const saved = localStorage.getItem('mg-ui');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.state?.theme) {
          document.documentElement.setAttribute('data-theme', parsed.state.theme);
        }
      } catch {}
    }
  }, []);

  // The marketing landing page ships its own header, footer, and compliance
  // text — render it without the app chrome.
  if (normalizePath(pathname) === '/') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      {/* TopBar — blurred, translucent, hairline-bordered */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-md"
        style={{
          borderColor: 'var(--color-border-subtle)',
          backgroundColor: 'color-mix(in srgb, var(--color-bg-base) 65%, transparent)',
        }}
      >
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <GammaMark size={28} />
              <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">
                Maple<span style={{ color: 'var(--color-accent)' }}>Gamma</span>
              </span>
            </Link>
            <MarketStatusPill />
          </div>
          <div className="flex items-center gap-1">
            <LearningModeToggle />
            <ThemeToggle />
          </div>
        </div>
        {/* Live index strip */}
        <div className="border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div className="max-w-[1400px] mx-auto px-4">
            <TickerTape />
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-[1400px] mx-auto w-full">
        {/* SideNav */}
        <nav className="hidden md:flex flex-col w-56 shrink-0 border-r p-3 gap-1" style={{ borderColor: 'var(--color-border-subtle)' }}>
          {NAV_ITEMS.map((item) => {
            const isActive = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-11"
                style={{
                  backgroundColor: isActive ? 'var(--color-bg-elevated)' : 'transparent',
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                }}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  />
                )}
                <item.Icon className={isActive ? 'text-[var(--color-accent)]' : undefined} />
                {item.label}
              </Link>
            );
          })}

          {/* Disclaimer */}
          <div className="mt-auto pt-4 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">
              Not financial advice. Data may be delayed. Past performance does not guarantee future results.
            </p>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 md:p-6">
          {children}

          {/* Compliance footer — general disclaimer, position-disclosure policy, Quebec notice */}
          <footer className="mt-8 pt-4 pb-16 md:pb-4 border-t text-[11px] leading-relaxed text-[var(--color-text-tertiary)]" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <p className="mb-2">
              MapleGamma provides general market information and simulated (paper-trading) results for
              educational purposes only. Nothing on this site is investment advice or a recommendation,
              and nothing is tailored to any person&apos;s circumstances. The site operator may hold positions
              in securities discussed; current Interactive Brokers holdings are disclosed on pages where
              those securities appear. Past performance — real or simulated — does not guarantee future results.
            </p>
            <p>
              <strong>Quebec notice:</strong> this service is not directed at, or intended for use by, residents
              of Quebec. <span lang="fr">Avis&nbsp;: ce service ne s&apos;adresse pas aux résidents du Québec.
              L&apos;information fournie est de nature générale et ne constitue pas un conseil en placement ni
              une recommandation.</span>
            </p>
          </footer>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t backdrop-blur-md flex justify-around py-2 px-4"
        style={{
          borderColor: 'var(--color-border-subtle)',
          backgroundColor: 'color-mix(in srgb, var(--color-bg-base) 75%, transparent)',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 text-[11px] min-w-11 min-h-11 justify-center"
              style={{ color: isActive ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}
            >
              <item.Icon />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
