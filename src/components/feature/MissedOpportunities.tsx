// components/feature/missed-opportunities.tsx — Placeholder card shells
'use client';

import React from 'react';
import { Surface, SurfaceHeader, InfoTip } from '@/components/primitives';

const iconDefaults = {
  width: 28,
  height: 28,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'var(--color-text-tertiary)',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const ICONS = {
  earnings: (
    <svg {...iconDefaults} aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-8M21 20H3" />
    </svg>
  ),
  simulator: (
    <svg {...iconDefaults} aria-hidden="true">
      <path d="M4 8h16M4 16h16" />
      <circle cx="9" cy="8" r="2.2" fill="var(--color-bg-surface)" />
      <circle cx="15" cy="16" r="2.2" fill="var(--color-bg-surface)" />
    </svg>
  ),
  timeMachine: (
    <svg {...iconDefaults} aria-hidden="true">
      <circle cx="13" cy="12" r="8" />
      <path d="M13 8v4l3 2M5 12H2M4 8l2 1M4 16l2-1" />
    </svg>
  ),
  compare: (
    <svg {...iconDefaults} aria-hidden="true">
      <path d="M12 3v18M3 8l4-4 4 4M3 8h8M13 16l4 4 4-4M13 16h8" />
    </svg>
  ),
  alerts: (
    <svg {...iconDefaults} aria-hidden="true">
      <path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
      <path d="M10.5 20a1.8 1.8 0 0 0 3 0" />
    </svg>
  ),
} as const;

interface PlaceholderProps {
  title: React.ReactNode;
  icon: keyof typeof ICONS;
  description: React.ReactNode;
  span?: 'hero' | 'half' | 'third' | 'quarter';
}

function FeaturePlaceholder({ title, icon, description, span = 'third' }: PlaceholderProps) {
  return (
    <Surface span={span} className="relative overflow-hidden">
      <SurfaceHeader title={title} />
      <div className="p-4 flex flex-col items-center justify-center min-h-[120px] text-center opacity-80">
        <span className="mb-3">{ICONS[icon]}</span>
        <p className="text-sm text-[var(--color-text-secondary)] max-w-xs">{description}</p>
        <span
          className="mt-3 inline-flex items-center gap-1 px-3 py-1 text-[10px] uppercase tracking-[0.12em] rounded-full border"
          style={{
            backgroundColor: 'var(--color-accent-dim)',
            color: 'var(--color-accent)',
            borderColor: 'color-mix(in srgb, var(--color-accent) 25%, transparent)',
          }}
        >
          Coming Soon
        </span>
      </div>
    </Surface>
  );
}

// "whisper numbers" and "post-earnings drift" have no glossary entry, so each
// term stays visible with a plain-English gloss appended inline rather than
// being replaced by one.
export function EarningsIntelligence() {
  return (
    <FeaturePlaceholder
      title={<InfoTip term="earnings">Earnings Intelligence</InfoTip>}
      icon="earnings"
      description="Automated earnings analysis: whisper numbers (what traders privately expect, not the published forecast), sentiment shifts, and post-earnings drift — prices tend to keep moving for weeks after a surprise."
    />
  );
}

export function ScenarioSimulator() {
  return (
    <FeaturePlaceholder
      title="Scenario Simulator"
      icon="simulator"
      description={
        <>
          Drag the <InfoTip term="vix">VIX</InfoTip> or the <InfoTip term="spot">spot price</InfoTip> and watch the{' '}
          <InfoTip term="gamma_regime">gamma regime</InfoTip> flip between steadying the market and amplifying it, with{' '}
          <InfoTip term="gamma_wall">gamma walls</InfoTip> redrawing as you go. Built to teach, not just inform.
        </>
      }
      span="half"
    />
  );
}

export function TimeMachine() {
  return (
    <FeaturePlaceholder
      title="Time Machine"
      icon="timeMachine"
      description="View the briefing as it stood on any past date, then reveal what actually happened. Build trust through transparency."
    />
  );
}

export function CompareMode() {
  return (
    <FeaturePlaceholder
      title="Compare Mode"
      icon="compare"
      description={
        <>
          Tickers side by side across every metric — <InfoTip term="gex">GEX</InfoTip>,{' '}
          <InfoTip term="momentum">momentum</InfoTip>, sentiment (the mood in the news and in social chatter), and the{' '}
          <InfoTip term="fundamentals">fundamentals</InfoTip> of the business.
        </>
      }
    />
  );
}

export function AlertRuleBuilder() {
  return (
    <FeaturePlaceholder
      title="Alert Rule Builder"
      icon="alerts"
      description={
        <>
          Your own alerts: when the S&amp;P 500 (SPX) crosses a <InfoTip term="gamma_wall">gamma wall</InfoTip>, when the{' '}
          <InfoTip term="vix">VIX</InfoTip> goes above 25, when an <InfoTip term="fomc">FOMC</InfoTip> rate decision is 24
          hours away, or any combination.
        </>
      }
      span="half"
    />
  );
}
