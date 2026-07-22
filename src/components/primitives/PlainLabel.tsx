// components/primitives/PlainLabel.tsx — always-on plain-English subtitle.
//
// Unlike <InfoTip>, this renders regardless of Learning Mode. It exists for the
// handful of labels that are pure acronyms ("GEX", "OOS Sharpe", "NOPE") where
// a beginner has no way to even guess the meaning, and where a tooltip they
// have to discover is too late. Kept small and in tertiary text so it reads as
// a caption rather than competing with the number it sits under.
'use client';

import React from 'react';
import { lookup } from '@/lib/glossary';

interface PlainLabelProps {
  /** One glossary term, or several to be joined with a middot. */
  term: string | string[];
  className?: string;
}

export function PlainLabel({ term, className = '' }: PlainLabelProps) {
  const terms = Array.isArray(term) ? term : [term];
  const labels = terms
    .map((t) => lookup(t)?.plainLabel)
    .filter((l): l is string => Boolean(l));

  if (labels.length === 0) return null;

  return (
    <span
      className={`block text-[10px] leading-snug font-normal normal-case tracking-normal text-[var(--color-text-tertiary)] ${className}`}
    >
      {labels.join(' · ')}
    </span>
  );
}
