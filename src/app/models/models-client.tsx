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

        {/* Walk-forward placeholder */}
        <BentoTile span="half">
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-tile)] shadow-[var(--shadow-tile)] overflow-hidden">
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
              <h3 className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-[0.14em]">Walk-Forward Analysis</h3>
            </div>
            <div className="p-4 flex flex-col items-center justify-center min-h-[200px]">
              <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="var(--color-text-tertiary)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="mb-3" aria-hidden="true">
                <path d="M3 17l5-5 4 4 6-7 3 3" />
                <path d="M3 21h18" />
              </svg>
              <p className="text-sm text-[var(--color-text-tertiary)] text-center">
                Walk-forward chart showing out-of-sample performance over rolling windows.
              </p>
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
