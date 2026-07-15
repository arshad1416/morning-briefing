// app/models/models-client.tsx
'use client';

import React from 'react';
import { DraggableBentoGrid, type GridItem } from '@/components/layout/DraggableBentoGrid';
import { BacktestSummary } from '@/components/feature/prediction/BacktestSummary';
import { AccuracyStats } from '@/components/feature/prediction/AccuracyStats';
import { CalibrationChart } from '@/components/feature/prediction/CalibrationChart';
import { ProGate } from '@/components/feature/gating/ProGate';
import { ScenarioSimulator } from '@/components/feature/MissedOpportunities';
import { WalkForwardTile } from '@/components/feature/prediction/WalkForwardTile';
import { SimulationTile } from '@/components/feature/prediction/SimulationTile';
import { CryptoCohortsTile } from '@/components/feature/prediction/CryptoCohortsTile';
import { OptionsStrategiesTile } from '@/components/feature/prediction/OptionsStrategiesTile';

export function ModelsClient() {
  return (
    <div className="space-y-4">
      {/* A1: Trust header */}
      <div
        className="relative overflow-hidden p-6 rounded-[var(--radius-tile)] border"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
      >
        <span aria-hidden="true" className="glow-orb -top-24 -right-8" />
        <h1 className="relative z-10 font-display text-3xl text-[var(--color-text-primary)]">
          Prediction <em className="italic" style={{ color: 'var(--color-accent)' }}>Engine</em>
        </h1>
        <p className="relative z-10 text-sm text-[var(--color-text-secondary)] mt-2">
          Full transparency on model performance. Every signal is tracked, backtested, and calibrated.
        </p>
      </div>

      <DraggableBentoGrid pageId="models" items={MODELS_ITEMS} />
    </div>
  );
}

// Paired compact tiles (Backtest+Accuracy, Calibration+Walk-Forward), then the
// full-width performance sections. Each has a stable id for user reordering.
const MODELS_ITEMS: GridItem[] = [
  { id: 'backtest', span: 'half', node: <ProGate feature="walkforward"><BacktestSummary /></ProGate> },
  { id: 'accuracy', span: 'half', node: <ProGate feature="walkforward"><AccuracyStats /></ProGate> },
  { id: 'calibration', span: 'half', node: <ProGate feature="calibration"><CalibrationChart /></ProGate> },
  { id: 'walkforward', span: 'half', node: <ProGate feature="walkforward"><WalkForwardTile /></ProGate> },
  { id: 'simulation', span: 'hero', node: <ProGate feature="simulation"><SimulationTile /></ProGate> },
  { id: 'options', span: 'hero', node: <OptionsStrategiesTile /> },
  { id: 'crypto', span: 'hero', node: <CryptoCohortsTile /> },
];
