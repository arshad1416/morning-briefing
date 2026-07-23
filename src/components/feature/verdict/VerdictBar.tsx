// components/feature/verdict/VerdictBar.tsx — hero A1 component
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { verdictQuery } from '@/lib/query/options';
import { ConvictionGauge, DataFreshness, InfoTip, PlainLabel, Surface } from '@/components/primitives';

export function VerdictBar() {
  const { data: verdict, isLoading } = useQuery(verdictQuery());

  if (isLoading || !verdict) {
    return (
      <Surface span="hero" className="p-6">
        <div className="skeleton h-8 w-3/4 mb-4" />
        <div className="skeleton h-4 w-full" />
      </Surface>
    );
  }

  const signalLabel = verdict.signal === 'bullish' ? 'BULLISH' : verdict.signal === 'bearish' ? 'BEARISH' : 'NEUTRAL';
  const signalColor = verdict.signal === 'bullish' ? 'var(--color-bull)' : verdict.signal === 'bearish' ? 'var(--color-bear)' : 'var(--color-neutral)';

  const glowColor =
    verdict.signal === 'bullish'
      ? 'rgba(16,185,129,0.14)'
      : verdict.signal === 'bearish'
      ? 'rgba(255,69,87,0.14)'
      : 'rgba(139,139,150,0.10)';

  return (
    <Surface span="hero" glow className="p-6 relative">
      <span aria-hidden="true" className="glow-orb -top-10 -left-6" style={{ ['--glow-color' as string]: glowColor }} />
      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center gap-6">
        {/* The gauge printed a big number with no word attached — "Conviction"
            existed only in its aria-label, so a sighted beginner saw 5.4 /10 of
            nothing in particular. */}
        <div className="flex flex-col items-center shrink-0">
          <ConvictionGauge value={verdict.conviction * 10} />
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
            <InfoTip term="conviction">Conviction</InfoTip>
          </span>
          <PlainLabel term="conviction" className="mt-0.5 text-center" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            {/* Names whose call this is. The VIX card shows an identical-looking
                BULLISH/BEARISH/NEUTRAL chip that is only a VIX threshold. */}
            <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
              Model call
            </span>
            <span
              className="text-lg font-bold uppercase tracking-wider"
              style={{ color: signalColor, fontFamily: 'var(--font-mono)' }}
            >
              {verdict.signal === 'bullish' ? '▲' : verdict.signal === 'bearish' ? '▼' : '●'} {signalLabel}
            </span>
            <DataFreshness timestamp={verdict.generated_at} />
          </div>

          <p className="font-display italic text-lg lg:text-xl text-[var(--color-text-secondary)] leading-relaxed">
            {verdict.narrative}
          </p>

          {/* "CI" was unexpanded and sat on the 0–1 conviction scale while the
              gauge above shows the same score out of 10 — hence the explicit
              scale note. Numbers are untouched.

              Deliberately NOT wrapped in <InfoTip term="confidence_interval">.
              The glossary entry describes a calibrated interval ("a wide range
              means the model is genuinely unsure"), but every snapshot of
              data/verdict.json carries calibration_source: "heuristic_fallback"
              and a band that just brackets the conviction score — so the
              tooltip would promise a statistic this field is not. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-tertiary)]" style={{ fontFamily: 'var(--font-mono)' }}>
            <span>
              Conviction range (0–1, rough estimate):{' '}
              [{verdict.confidence_interval[0].toFixed(2)}, {verdict.confidence_interval[1].toFixed(2)}]
            </span>
            <span>
              <InfoTip term="vix">VIX</InfoTip> when scored: {verdict.model_features.vix}
            </span>
            {/* Deliberately NOT wrapped in <InfoTip term="breadth">. The
                generator for model_features.breadth lives on the Pi, not in
                this repo, so the glossary's advance/decline definition cannot
                be confirmed to describe this field — and the live value sits at
                a flat 1.00. An unexplained number beats a wrong explanation. */}
            <span>Breadth: {verdict.model_features.breadth.toFixed(2)}</span>
            {/* The sample size has to travel with the number. On the live file
                recent_trades is 0 while recent_hit_rate still reads 0.5, so
                naming "recent paper trades" as the source of a 50% would be a
                measurement that never happened. */}
            <span>
              <InfoTip term="hit_rate">Hit rate</InfoTip>
              {verdict.model_features.recent_trades > 0 ? (
                <>
                  , last {verdict.model_features.recent_trades} paper{' '}
                  {verdict.model_features.recent_trades === 1 ? 'trade' : 'trades'}:{' '}
                  {(verdict.model_features.recent_hit_rate * 100).toFixed(0)}%
                </>
              ) : (
                <>: no recent paper trades yet</>
              )}
            </span>
          </div>
        </div>
      </div>
    </Surface>
  );
}
