// components/primitives/InfoTip.tsx — Learning Mode hook
'use client';

import React from 'react';
import { useUI } from '@/stores/ui';

interface InfoTipProps {
  term: string;
  children: React.ReactNode;
  className?: string;
}

const GLOSSARY: Record<string, string> = {
  gex: 'Gamma Exposure — measures how much market makers must hedge as prices move. High GEX = more stable; low GEX = more volatile.',
  dex: 'Delta Exposure — net directional exposure from options. Positive = dealers buy dips; negative = dealers sell rallies.',
  vex: 'Vega Exposure — sensitivity to volatility changes. High VEX means the position is very sensitive to VIX moves.',
  vix: 'The CBOE Volatility Index — often called the "fear gauge." Measures expected 30-day volatility of S&P 500 options.',
  conviction: 'A model-generated score (0–10) indicating confidence in the current market signal direction.',
  max_pain: 'The strike price where the most options expire worthless. Theory suggests prices gravitate toward max pain at expiry.',
  gamma_wall: 'A strike with extremely high gamma exposure. Acts as a magnet or barrier — prices tend to cluster around these levels.',
  zero_gamma: 'The level where dealer hedging flips from stabilizing to destabilizing. Above = dampened moves; below = amplified moves.',
  kelly: 'The Kelly Criterion — mathematically optimal bet sizing. We use fractional Kelly (typically 1/4) for conservative position sizing.',
  fomc: 'Federal Open Market Committee — the Fed\'s rate-setting body. FOMC days are the highest-impact event for markets.',
  contango: 'When futures prices are higher than spot prices. VIX in contango = normal; VIX in backwardation = stress signal.',
};

export function InfoTip({ term, children, className = '' }: InfoTipProps) {
  const learningMode = useUI((s) => s.learningMode);
  const definition = GLOSSARY[term.toLowerCase()];

  if (!learningMode || !definition) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span className={`relative group inline-block ${className}`}>
      <span className="border-b border-dotted border-[var(--color-accent)] cursor-help">{children}</span>
      <span
        role="tooltip"
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 text-xs text-[var(--color-text-primary)] bg-[var(--color-bg-overlay)] border border-[var(--color-border-default)] rounded-[var(--radius-chip)] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
      >
        {definition}
      </span>
    </span>
  );
}
