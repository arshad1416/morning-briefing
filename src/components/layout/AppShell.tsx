// components/layout/AppShell.tsx — providers + shell + nav
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUI } from '@/stores/ui';
import { useMe } from '@/lib/auth/useMe';
import { trialDaysLeft } from '@/lib/auth/api';
import { GammaMark } from '@/components/brand/GammaMark';
import { TickerTape } from './TickerTape';
import { LayoutEditToggle } from './LayoutEditToggle';

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

function IconUser({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

function IconFunnel({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className} aria-hidden="true">
      <path d="M3.5 5h17l-6.5 7.5V19l-4 2v-8.5L3.5 5Z" />
    </svg>
  );
}

function IconNews({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className} aria-hidden="true">
      <path d="M4 5h13v14H6a2 2 0 0 1-2-2V5Z" />
      <path d="M17 8h3v9a2 2 0 0 1-2 2" />
      <path d="M7 9h7M7 12.5h7M7 16h4" />
    </svg>
  );
}

function IconCandles({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className} aria-hidden="true">
      <path d="M7 4v3M7 15v5M17 4v5M17 17v3" />
      <rect x="5" y="7" width="4" height="8" rx="1" />
      <rect x="15" y="9" width="4" height="8" rx="1" />
    </svg>
  );
}

function IconArchive({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className} aria-hidden="true">
      <rect x="3.5" y="4" width="17" height="4.5" rx="1" />
      <path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5" />
      <path d="M10 12.5h4" />
    </svg>
  );
}

function IconDial({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className} aria-hidden="true">
      <path d="M5 19a8 8 0 1 1 14 0" />
      <path d="M12 13l3.5-3.5" />
      <circle cx="12" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconMore({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className} aria-hidden="true">
      <circle cx="5" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SessionButton() {
  const { data: me, isLoading } = useMe();

  // Render nothing until the session check resolves — the prerendered HTML and
  // the first client render agree (both loading), so no hydration mismatch.
  if (isLoading) return <span className="h-11 w-11 shrink-0" aria-hidden="true" />;

  if (me) {
    const ent = me.entitlement;
    const trialing = ent.tier === 'trial' && ent.status === 'active' && !!ent.trialEndsAt;
    const days = trialing ? trialDaysLeft(ent.trialEndsAt) : 0;
    return (
      <>
        {trialing && (
          <Link
            href="/account/"
            className="hidden sm:inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}
            title="Your 7-day free trial of the full desk — pick a plan to keep it"
          >
            Trial · {days} day{days === 1 ? '' : 's'} left
          </Link>
        )}
        <Link
          href="/account/"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:w-auto sm:gap-2 sm:px-3"
          title={me.email}
        >
          <IconUser />
          <span className="hidden sm:inline">Account</span>
        </Link>
      </>
    );
  }

  return (
    <Link
      href="/login/"
      className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2.5 text-xs font-semibold transition hover:bg-[var(--color-accent-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] min-[360px]:px-3.5 min-[360px]:text-sm"
      style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
    >
      Sign in
    </Link>
  );
}

const MOBILE_PRIMARY_ITEMS = [
  { href: '/dashboard/', label: 'Dashboard', Icon: IconGrid },
  { href: '/positions/', label: 'Positions', Icon: IconLayers },
  { href: '/options/', label: 'Options', Icon: IconTarget },
  { href: '/screener/', label: 'Screener', Icon: IconFunnel },
];

const MOBILE_MORE_CORE_ITEMS = [
  { href: '/research/', label: 'Research', Icon: IconNews },
  { href: '/charts/', label: 'Charts', Icon: IconCandles },
  // Labelled to match the destination's own <h1> and page title ("Prediction
  // Engine"). "Models" appeared nowhere on the page and read like a settings
  // screen where you pick a model.
  { href: '/models/', label: 'Prediction Engine', Icon: IconPulse },
];

const NAV_ITEMS = [...MOBILE_PRIMARY_ITEMS, ...MOBILE_MORE_CORE_ITEMS];

// Deep-dive pages surfaced in the sidebar only — the mobile bottom nav stays
// at the seven primary destinations.
const SECONDARY_NAV_ITEMS = [
  { href: '/predictions/', label: 'Engine Tuning', Icon: IconDial },
  { href: '/archive/', label: 'Archive', Icon: IconArchive },
];

const MOBILE_MORE_ITEMS = [...MOBILE_MORE_CORE_ITEMS, ...SECONDARY_NAV_ITEMS];

function normalizePath(p: string) {
  const stripped = p.replace(/\/+$/, '');
  return stripped === '' ? '/' : stripped;
}

function isNavActive(pathname: string, href: string) {
  const path = normalizePath(pathname);
  const target = normalizePath(href);
  return path === target || path.startsWith(`${target}/`);
}

const PILL_CAVEAT =
  'Rough guide to US market hours, based on the standard 9:30am-4pm ET session. It does not know about market holidays or early closes, so on a holiday it will show open all day.';

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
      <span className="hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] bg-[var(--color-bg-elevated)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-tertiary)]" aria-hidden="true" />
        Checking…
      </span>
    );
  }

  // BUG FIX: this used to derive market hours from a fixed 13:00-21:00 UTC
  // window ("9:30-4 ET approx"), which isn't DST-aware — UTC has no concept
  // of ET's own EST/EDT offset shift, so the fixed window drifted by up to
  // 90 minutes around the March/November clock changes (claiming "open" up
  // to 90 minutes early in EST, or staying "open" an hour late in EDT).
  // Asking Intl for the wall-clock time in America/New_York instead lets
  // the IANA tz database handle EST/EDT for us, so the window always lines
  // up with the real 9:30am-4:00pm ET session. Market holidays and early
  // closes remain unknown — see PILL_CAVEAT.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekday = part('weekday');
  const minutesET = Number(part('hour')) * 60 + Number(part('minute'));
  const isWeekday = weekday !== 'Sat' && weekday !== 'Sun';
  const isOpen = isWeekday && minutesET >= 9 * 60 + 30 && minutesET < 16 * 60;

  return (
    <span
      className="hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-[0.12em]"
      style={{
        backgroundColor: isOpen ? 'var(--color-bull-soft)' : 'var(--color-bg-elevated)',
        color: isOpen ? 'var(--color-bull)' : 'var(--color-text-tertiary)',
      }}
      // Says WHICH market (the tape below it also carries Toronto and the
      // Canadian dollar). The DST drift this comment used to warn about is
      // fixed above (real ET wall-clock time via Intl, not a fixed UTC
      // window) — the one caveat left is that holidays and early closes
      // aren't known, so on those days it still shows open all day.
      title={PILL_CAVEAT}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: isOpen ? 'var(--color-bull)' : 'var(--color-text-tertiary)' }}
        aria-hidden="true"
      />
      {isOpen ? 'US market open' : 'US market closed'}
      {/* A native `title` only reaches a mouse. The visible words are flatly
          confident, so the caveat is repeated for screen readers, where it
          costs no layout. */}
      <span className="sr-only"> — {PILL_CAVEAT}</span>
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
      className="min-w-11 min-h-11 flex items-center justify-center rounded-lg px-2 transition-colors"
      style={{
        color: learningMode ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        backgroundColor: learningMode ? 'var(--color-accent-dim)' : 'transparent',
      }}
      aria-label={
        learningMode
          ? 'Turn off Learning Mode — plain-English explanations'
          : 'Turn on Learning Mode — plain-English explanations'
      }
      title="Learning Mode — explains the finance terms on the page in plain English. Hover, tap or tab to any underlined term."
    >
      <IconBook />
      {/* The icon alone is undiscoverable for the beginners this exists for,
          so it carries a visible word wherever there is room. Hidden on the
          narrowest widths, where the header is already tight. */}
      <span className="ml-1.5 hidden text-xs font-medium sm:inline">
        {learningMode ? 'Explain: on' : 'Explain'}
      </span>
    </button>
  );
}

function MobileNavigation({ pathname }: { pathname: string }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef(true);
  const moreIsActive = MOBILE_MORE_ITEMS.some((item) => isNavActive(pathname, item.href));

  useEffect(() => {
    restoreFocusRef.current = false;
    setMoreOpen(false);
  }, [pathname]);

  const closeMore = (restoreFocus = true) => {
    restoreFocusRef.current = restoreFocus;
    setMoreOpen(false);
  };

  const toggleMore = () => {
    if (moreOpen) {
      closeMore();
      return;
    }
    restoreFocusRef.current = true;
    setMoreOpen(true);
  };

  useEffect(() => {
    if (!moreOpen) return;

    const sheet = sheetRef.current;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheet?.querySelector<HTMLElement>('[data-sheet-autofocus]')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        restoreFocusRef.current = true;
        setMoreOpen(false);
        return;
      }

      if (event.key !== 'Tab' || !sheet) return;
      const focusable = Array.from(
        sheet.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      ).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (restoreFocusRef.current) trigger?.focus();
    };
  }, [moreOpen]);

  return (
    <>
      {moreOpen && (
        <>
          <button
            type="button"
            aria-label="Close More menu"
            className="fixed inset-0 z-[70] cursor-default bg-black/55 md:hidden"
            onClick={() => closeMore()}
          />
          <div
            id="mobile-more-sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-more-title"
            className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[80] max-h-[70vh] overflow-y-auto rounded-t-2xl border-t p-4 shadow-2xl md:hidden"
            style={{
              borderColor: 'var(--color-border-default)',
              backgroundColor: 'var(--color-bg-surface)',
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="mobile-more-title" className="text-base font-semibold text-[var(--color-text-primary)]">
                More destinations
              </h2>
              <button
                type="button"
                data-sheet-autofocus
                aria-label="Close More menu"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-2xl leading-none text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                onClick={() => closeMore()}
              >
                ×
              </button>
            </div>
            <div className="grid gap-1">
              {MOBILE_MORE_ITEMS.map((item) => {
                const isActive = isNavActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => closeMore(false)}
                    className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                    style={{
                      backgroundColor: isActive ? 'var(--color-bg-elevated)' : 'transparent',
                      color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    }}
                  >
                    <item.Icon className={isActive ? 'text-[var(--color-accent)]' : undefined} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      <nav
        aria-label="Mobile navigation"
        aria-hidden={moreOpen ? true : undefined}
        inert={moreOpen}
        className="fixed inset-x-0 bottom-0 z-[60] border-t px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
        style={{
          borderColor: 'var(--color-border-subtle)',
          backgroundColor: 'color-mix(in srgb, var(--color-bg-base) 82%, transparent)',
        }}
      >
        <div className="grid grid-cols-5 items-stretch">
          {MOBILE_PRIMARY_ITEMS.map((item) => {
            const isActive = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className="flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                style={{ color: isActive ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}
              >
                <item.Icon />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            ref={triggerRef}
            type="button"
            aria-expanded={moreOpen}
            aria-controls={moreOpen ? 'mobile-more-sheet' : undefined}
            aria-current={moreIsActive ? 'page' : undefined}
            className="flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            style={{ color: moreIsActive || moreOpen ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}
            onClick={toggleMore}
          >
            <IconMore />
            More
          </button>
        </div>
      </nav>
    </>
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
        if (parsed.state?.density) {
          document.documentElement.setAttribute('data-density', parsed.state.density);
        }
      } catch {}
    }
  }, []);

  // The marketing landing and the auth pages ship their own chrome —
  // render them without the app shell.
  const bare = ['/', '/login', '/signup'].includes(normalizePath(pathname));
  if (bare) {
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
        <div className="mx-auto flex h-14 max-w-[1400px] 2xl:max-w-[1720px] items-center justify-between gap-1 px-2 min-[360px]:px-3 sm:gap-4 sm:px-4">
          <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-4">
            <Link
              href="/"
              aria-label="MapleGamma home"
              className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <GammaMark size={28} />
              <span className="hidden text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)] sm:inline">
                Maple<span style={{ color: 'var(--color-accent)' }}>Gamma</span>
              </span>
            </Link>
            <MarketStatusPill />
          </div>
          <div className="flex shrink-0 items-center gap-0 sm:gap-1.5">
            <LayoutEditToggle />
            <LearningModeToggle />
            <ThemeToggle />
            <SessionButton />
          </div>
        </div>
        {/* Live index strip */}
        <div className="border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div className="max-w-[1400px] 2xl:max-w-[1720px] mx-auto px-4">
            <TickerTape />
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-[1400px] 2xl:max-w-[1720px] mx-auto w-full">
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

          {/* Deep dives */}
          <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
            {SECONDARY_NAV_ITEMS.map((item) => {
              const isActive = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors min-h-10"
                  style={{
                    backgroundColor: isActive ? 'var(--color-bg-elevated)' : 'transparent',
                    color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
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
          </div>

          {/* Disclaimer */}
          <div className="mt-auto pt-4 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">
              Not financial advice. All strategy results shown are practice trades made with fake money.
              Data may be delayed, and past performance does not guarantee future results.
            </p>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 md:p-6">
          {children}

          {/* Compliance footer — general disclaimer, position-disclosure policy, Quebec notice */}
          <footer className="mt-8 border-t pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] text-[11px] leading-relaxed text-[var(--color-text-tertiary)] md:pb-4" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <p className="mb-2">
              MapleGamma provides general market information and practice-trading results — trades placed with
              fake money, known as paper trading — for educational purposes only. Nothing on this site is
              investment advice or a recommendation, and nothing is tailored to any person&apos;s circumstances.
              Every trading result shown here is simulated: the person who runs this site puts no real money
              into any of the strategies, securities (shares, ETFs, options) or other assets discussed.
              Past performance — real or simulated — does not guarantee future results.{' '}
              <a href="/terms" className="underline hover:text-[var(--color-text-secondary)]">Terms</a>
              {' · '}
              <a href="/privacy" className="underline hover:text-[var(--color-text-secondary)]">Privacy</a>
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

      <MobileNavigation pathname={pathname} />
    </div>
  );
}
