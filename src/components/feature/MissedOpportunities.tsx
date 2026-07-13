// components/feature/missed-opportunities.tsx — Placeholder card shells
'use client';

import React from 'react';
import { Surface, SurfaceHeader } from '@/components/primitives';

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
  title: string;
  icon: keyof typeof ICONS;
  description: string;
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

export function EarningsIntelligence() {
  return (
    <FeaturePlaceholder
      title="Earnings Intelligence"
      icon="earnings"
      description="AI-powered earnings analysis with whisper numbers, sentiment shifts, and post-earnings drift predictions."
    />
  );
}

export function ScenarioSimulator() {
  return (
    <FeaturePlaceholder
      title="Scenario Simulator"
      icon="simulator"
      description="Drag VIX or spot price to watch GEX regime flip and gamma walls redraw in real-time. Teaches and informs."
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
      description="Side-by-side ticker comparison across all metrics — GEX, momentum, sentiment, and fundamentals."
    />
  );
}

export function AlertRuleBuilder() {
  return (
    <FeaturePlaceholder
      title="Alert Rule Builder"
      icon="alerts"
      description="Custom alerts: notify when SPX crosses gamma wall, VIX > 25, FOMC in 24h, or any combination."
      span="half"
    />
  );
}
