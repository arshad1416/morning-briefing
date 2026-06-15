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
  className?: string;
}

export function Stat({ label, value, delta, prefix = '', suffix = '', size = 'md', className = '' }: StatProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-[2.75rem] leading-tight',
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-2">
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
