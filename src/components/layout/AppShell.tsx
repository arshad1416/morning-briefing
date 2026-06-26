// components/layout/AppShell.tsx — providers + shell + nav
'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUI } from '@/stores/ui';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '◈' },
  { href: '/positions/', label: 'Positions', icon: '⊞' },
  { href: '/options/', label: 'Options', icon: '◉' },
  { href: '/models/', label: 'Models', icon: '◎' },
];

function MarketStatusPill() {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  const isOpen = day >= 1 && day <= 5 && hour >= 13 && hour < 21; // 9:30-4 ET approx

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{
        backgroundColor: isOpen ? 'var(--color-bull-soft)' : 'var(--color-bg-elevated)',
        color: isOpen ? 'var(--color-bull)' : 'var(--color-text-tertiary)',
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isOpen ? 'var(--color-bull)' : 'var(--color-text-tertiary)' }} />
      {isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
    </span>
  );
}

function GlobalTicker() {
  return (
    <div className="hidden md:flex items-center gap-4 text-xs" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
      <span className="text-[var(--color-text-tertiary)]">S&P 500</span>
      <span className="text-[var(--color-text-primary)]">5,431.46</span>
      <span className="text-[var(--color-bull)]">▲ +0.50%</span>
      <span className="text-[var(--color-text-tertiary)] ml-3">VIX</span>
      <span className="text-[var(--color-text-primary)]">17.68</span>
      <span className="text-[var(--color-bear)]">▼ -9.05%</span>
    </div>
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
      {theme === 'dark' ? '☀' : '🌙'}
    </button>
  );
}

function LearningModeToggle() {
  const { learningMode, toggleLearningMode } = useUI();

  return (
    <button
      onClick={toggleLearningMode}
      className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-sm transition-colors"
      style={{
        color: learningMode ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        backgroundColor: learningMode ? 'rgba(124, 108, 255, 0.1)' : 'transparent',
      }}
      aria-label={learningMode ? 'Disable learning mode' : 'Enable learning mode'}
      title="Learning Mode — shows tooltips for jargon"
    >
      📖
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

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      {/* TopBar */}
      <header className="sticky top-0 z-40 border-b" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface)' }}>
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
              <span style={{ color: 'var(--color-maple)' }}>🍁</span>
              <span>MapleGamma</span>
            </Link>
            <MarketStatusPill />
          </div>
          <GlobalTicker />
          <div className="flex items-center gap-1">
            <LearningModeToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-[1400px] mx-auto w-full">
        {/* SideNav */}
        <nav className="hidden md:flex flex-col w-56 shrink-0 border-r p-3 gap-1" style={{ borderColor: 'var(--color-border-subtle)' }}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-11"
                style={{
                  backgroundColor: isActive ? 'var(--color-bg-elevated)' : 'transparent',
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                }}
              >
                <span aria-hidden="true">{item.icon}</span>
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
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t flex justify-around py-2 px-4" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface)' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 text-xs min-w-11 min-h-11 justify-center"
              style={{ color: isActive ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}
            >
              <span className="text-lg" aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
