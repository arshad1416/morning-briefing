// components/primitives/Stat.tsx — label + big tabular value + DeltaBadge
'use client';

import React from 'react';
import { DeltaBadge } from './DeltaBadge';

interface StatProps {
  label: string;
  value: string | number;
  delta?: number;
  prefix?: string;
  suffix?: string;
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
  className?: string;
}

export function Stat({ label, value, delta, prefix = '', suffix = '', size = 'md', glow, className = '' }: StatProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-[2.75rem] leading-tight',
  };

  return (
    <div className={`relative flex flex-col gap-1 ${className}`}>
      {glow && (
        <span
          aria-hidden="true"
          className="glow-orb -top-16 -left-10"
          style={{ width: 160, height: 160 }}
        />
      )}
      <span className="relative z-10 text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-[0.14em]">{label}</span>
      <div className="relative z-10 flex items-baseline gap-2">
        <span
          className={`font-[var(--font-mono)] font-variant-numeric-tabular-nums font-semibold text-[var(--color-text-primary)] ${sizeClasses[size]}`}
          style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
          data-numeric
        >
          {prefix}{typeof value === 'number' ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}{suffix}
        </span>
        {delta !== undefined && <DeltaBadge value={delta} />}
      </div>
    </div>
  );
}
