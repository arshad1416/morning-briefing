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

export function ModelsClient() {
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

      <DraggableBentoGrid pageId="models" items={MODELS_ITEMS} />
    </div>
  );
}

// Paired compact tiles (Backtest+Accuracy, Calibration+Walk-Forward), then the
// full-width performance sections. Each has a stable id for user reordering.
const MODELS_ITEMS: GridItem[] = [
  { id: 'backtest', span: 'half', node: <FeatureGate feature="walkforward"><BacktestSummary /></FeatureGate> },
  { id: 'accuracy', span: 'half', node: <FeatureGate feature="walkforward"><AccuracyStats /></FeatureGate> },
  { id: 'calibration', span: 'half', node: <FeatureGate feature="calibration"><CalibrationChart /></FeatureGate> },
  { id: 'walkforward', span: 'half', node: <FeatureGate feature="walkforward"><WalkForwardTile /></FeatureGate> },
  { id: 'simulation', span: 'hero', node: <FeatureGate feature="simulation"><SimulationTile /></FeatureGate> },
  { id: 'options', span: 'hero', node: <OptionsStrategiesTile /> },
  { id: 'crypto', span: 'hero', node: <CryptoCohortsTile /> },
];
