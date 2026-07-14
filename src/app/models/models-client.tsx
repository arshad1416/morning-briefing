// app/models/models-client.tsx
'use client';

import React from 'react';
import { BentoGrid, BentoTile } from '@/components/layout/BentoGrid';
import { BacktestSummary } from '@/components/feature/prediction/BacktestSummary';
import { AccuracyStats } from '@/components/feature/prediction/AccuracyStats';
import { CalibrationChart } from '@/components/feature/prediction/CalibrationChart';
import { ProGate } from '@/components/feature/gating/ProGate';
import { ScenarioSimulator } from '@/components/feature/MissedOpportunities';
import { WalkForwardTile } from '@/components/feature/prediction/WalkForwardTile';
import { SimulationTile } from '@/components/feature/prediction/SimulationTile';
import { CryptoCohortsTile } from '@/components/feature/prediction/CryptoCohortsTile';

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

      <BentoGrid>
        {/* A2: Backtest + Accuracy */}
        <BentoTile span="half">
          <BacktestSummary />
        </BentoTile>
        <BentoTile span="half">
          <AccuracyStats />
        </BentoTile>

        {/* A3: Calibration chart */}
        <BentoTile span="half">
          <ProGate feature="calibration">
            <CalibrationChart />
          </ProGate>
        </BentoTile>

        {/* Walk-forward (real out-of-sample results — was a hardcoded placeholder) */}
        <BentoTile span="half">
          <ProGate feature="walkforward">
            <WalkForwardTile />
          </ProGate>
        </BentoTile>

        {/* Live simulation summary (legacy Models view, lost in the port) */}
        <BentoTile span="hero">
          <ProGate feature="simulation">
            <SimulationTile />
          </ProGate>
        </BentoTile>

        {/* Crypto strategy cohorts — the crypto asset class (public) */}
        <BentoTile span="hero">
          <CryptoCohortsTile />
        </BentoTile>

      </BentoGrid>
    </div>
  );
}
