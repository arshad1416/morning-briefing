// app/models/models-client.tsx
'use client';

import React from 'react';
import { BentoGrid, BentoTile } from '@/components/layout/BentoGrid';
import { BacktestSummary } from '@/components/feature/prediction/BacktestSummary';
import { AccuracyStats } from '@/components/feature/prediction/AccuracyStats';
import { CalibrationChart } from '@/components/feature/prediction/CalibrationChart';
import { ProGate } from '@/components/feature/gating/ProGate';
import { ScenarioSimulator } from '@/components/feature/MissedOpportunities';

export function ModelsClient() {
  return (
    <div className="space-y-4">
      {/* A1: Trust header */}
      <div className="p-6 rounded-[var(--radius-tile)]" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Prediction Engine</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-2">
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

        {/* Walk-forward placeholder */}
        <BentoTile span="half">
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-tile)] shadow-[var(--shadow-tile)] overflow-hidden">
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Walk-Forward Analysis</h3>
            </div>
            <div className="p-4 flex flex-col items-center justify-center min-h-[200px]">
              <span className="text-3xl mb-3">📈</span>
              <p className="text-sm text-[var(--color-text-tertiary)] text-center">
                Walk-forward chart showing out-of-sample performance over rolling windows.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-tertiary)]">
                Coming Soon
              </span>
            </div>
          </div>
        </BentoTile>

        {/* Scenario simulator placeholder */}
        <BentoTile span="hero">
          <ScenarioSimulator />
        </BentoTile>
      </BentoGrid>
    </div>
  );
}
