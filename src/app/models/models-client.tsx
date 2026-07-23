// app/models/models-client.tsx
'use client';

import React from 'react';
import { DraggableBentoGrid, type GridItem } from '@/components/layout/DraggableBentoGrid';
import { BacktestSummary } from '@/components/feature/prediction/BacktestSummary';
import { AccuracyStats } from '@/components/feature/prediction/AccuracyStats';
import { CalibrationChart } from '@/components/feature/prediction/CalibrationChart';
import { FeatureGate } from '@/components/feature/gating/FeatureGate';
import { InfoTip } from '@/components/primitives';
import { WalkForwardTile } from '@/components/feature/prediction/WalkForwardTile';
import { SimulationTile } from '@/components/feature/prediction/SimulationTile';
import { CryptoCohortsTile } from '@/components/feature/prediction/CryptoCohortsTile';
import { OptionsStrategiesTile } from '@/components/feature/prediction/OptionsStrategiesTile';
import { useMe } from '@/lib/auth/useMe';
import { entitlementRank, NEED_RANK } from '@/stores/entitlements';

export function ModelsClient() {
  const { data: me, isLoading } = useMe();
  // Every gated tile on this page needs the same tier (Pro), so under-tier
  // visitors get ONE pitch for the whole group instead of five identical
  // boxes. While the session check is in flight, render the real grid — same
  // reasoning as FeatureGate: a brief expose beats flashing the lock at every
  // entitled user on every load.
  const can = isLoading || entitlementRank(me?.entitlement) >= NEED_RANK.pro;

  return (
    <div className="space-y-4">
      {/* A1: Trust header */}
      <div
        className="relative p-6 rounded-[var(--radius-tile)] border"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
      >
        {/* The clip lives on the orb's own wrapper rather than on the card. When
            the card itself was `overflow-hidden` it also clipped the Learning
            Mode tooltips, which open upward out of the paragraph below. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[var(--radius-tile)]">
          <span className="glow-orb -top-24 -right-8" />
        </span>
        <h1 className="relative z-10 font-display text-3xl text-[var(--color-text-primary)]">
          Prediction <em className="italic" style={{ color: 'var(--color-accent)' }}>Engine</em>
        </h1>
        <p className="relative z-10 text-sm text-[var(--color-text-secondary)] mt-2">
          Full transparency on model performance. Every trade idea is recorded,{' '}
          <InfoTip term="backtest">backtested</InfoTip> against past market data, and{' '}
          <InfoTip term="calibration">calibrated</InfoTip> — checked to see whether its stated confidence held up.
          Every result here is <InfoTip term="paper_trading">paper-traded</InfoTip>: no real money is involved.
        </p>
      </div>

      <DraggableBentoGrid pageId="models" items={can ? MODELS_ITEMS : LOCKED_ITEMS} />
    </div>
  );
}

// Paired compact tiles (Backtest+Accuracy, Calibration+Walk-Forward), then the
// full-width performance sections. Each has a stable id for user reordering.
// No per-tile FeatureGates: under-tier visitors never see this list (they get
// LOCKED_ITEMS below), and the tiles' own quiet gated frames cover the brief
// session-loading window where a 401 can land first.
const MODELS_ITEMS: GridItem[] = [
  { id: 'backtest', span: 'half', node: <BacktestSummary /> },
  { id: 'accuracy', span: 'half', node: <AccuracyStats /> },
  { id: 'calibration', span: 'half', node: <CalibrationChart /> },
  { id: 'walkforward', span: 'half', node: <WalkForwardTile /> },
  { id: 'simulation', span: 'hero', node: <SimulationTile /> },
  { id: 'options', span: 'hero', node: <OptionsStrategiesTile /> },
  { id: 'crypto', span: 'hero', node: <CryptoCohortsTile /> },
];

// What the one pitch card sits on: the five locked section names, dimmed, so
// the group preview says what Pro unlocks without a signup box per tile.
const ENGINE_SECTIONS = [
  'Backtest Summary',
  'Accuracy Stats',
  'Calibration Chart',
  'Walk-Forward Analysis',
  'Live Simulation',
];

function EngineGroupPreview() {
  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-tile)] shadow-[var(--shadow-tile)] p-4">
      {/* Tall enough that FeatureGate's centered pitch card stays inside the
          tile — the overlay lives outside any overflow clip. */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 min-h-[320px]">
        {ENGINE_SECTIONS.map((title) => (
          <div key={title} className="rounded-[var(--radius-chip)] bg-[var(--color-bg-elevated)] p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
              {title}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const LOCKED_ITEMS: GridItem[] = [
  {
    id: 'engine-locked',
    span: 'hero',
    node: (
      <FeatureGate feature="walkforward" label="Full Prediction Engine access">
        <EngineGroupPreview />
      </FeatureGate>
    ),
  },
  { id: 'options', span: 'hero', node: <OptionsStrategiesTile /> },
  { id: 'crypto', span: 'hero', node: <CryptoCohortsTile /> },
];
