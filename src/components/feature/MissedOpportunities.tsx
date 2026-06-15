// components/feature/missed-opportunities.tsx — Placeholder card shells
'use client';

import React from 'react';
import { Surface, SurfaceHeader } from '@/components/primitives';

interface PlaceholderProps {
  title: string;
  icon: string;
  description: string;
  span?: 'hero' | 'half' | 'third' | 'quarter';
}

function FeaturePlaceholder({ title, icon, description, span = 'third' }: PlaceholderProps) {
  return (
    <Surface span={span} className="relative overflow-hidden">
      <SurfaceHeader title={title} />
      <div className="p-4 flex flex-col items-center justify-center min-h-[120px] text-center opacity-70">
        <span className="text-3xl mb-3">{icon}</span>
        <p className="text-sm text-[var(--color-text-secondary)] max-w-xs">{description}</p>
        <span className="mt-3 inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-tertiary)]">
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
      icon="📊"
      description="AI-powered earnings analysis with whisper numbers, sentiment shifts, and post-earnings drift predictions."
    />
  );
}

export function ScenarioSimulator() {
  return (
    <FeaturePlaceholder
      title="Scenario Simulator"
      icon="🎛️"
      description="Drag VIX or spot price to watch GEX regime flip and gamma walls redraw in real-time. Teaches and informs."
      span="half"
    />
  );
}

export function TimeMachine() {
  return (
    <FeaturePlaceholder
      title="Time Machine"
      icon="⏮️"
      description="View the briefing as it stood on any past date, then reveal what actually happened. Build trust through transparency."
    />
  );
}

export function CompareMode() {
  return (
    <FeaturePlaceholder
      title="Compare Mode"
      icon="⚖️"
      description="Side-by-side ticker comparison across all metrics — GEX, momentum, sentiment, and fundamentals."
    />
  );
}

export function AlertRuleBuilder() {
  return (
    <FeaturePlaceholder
      title="Alert Rule Builder"
      icon="🔔"
      description="Custom alerts: notify when SPX crosses gamma wall, VIX > 25, FOMC in 24h, or any combination."
      span="half"
    />
  );
}
