// components/primitives/InfoTip.tsx — Learning Mode hook
//
// Wraps a piece of jargon and, when Learning Mode is on, explains it in plain
// English. Definitions live in @/lib/glossary — never inline wording here.
//
// Accessibility note: this used to be a hover-only <span> with
// pointer-events-none, which meant it did nothing at all on a touch device and
// was unreachable by keyboard. Since beginners are exactly the people most
// likely to be on a phone, that made the feature invisible to its own audience.
// It is now a real <button>: hover, focus, tap, and Escape all work.
'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { useUI } from '@/stores/ui';
import { lookup, type GlossaryTerm } from '@/lib/glossary';

interface InfoTipProps {
  /**
   * Typed against the glossary, so a term that has no definition fails
   * `npm run typecheck` rather than silently rendering nothing at runtime.
   */
  term: GlossaryTerm;
  children: React.ReactNode;
  className?: string;
}

export function InfoTip({ term, children, className = '' }: InfoTipProps) {
  const learningMode = useUI((s) => s.learningMode);
  const [open, setOpen] = useState(false);
  // `persist` rehydrates from localStorage on the client, so the prerendered
  // HTML must not commit to a decorated or undecorated state. Same pattern the
  // theme toggle uses.
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    // A tap anywhere else dismisses it — without this, an open tooltip on a
    // phone can only be closed by tapping the same trigger again.
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const entry = lookup(term);

  if (!mounted || !learningMode || !entry) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span ref={wrapRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="border-b border-dotted border-[var(--color-accent)] cursor-help text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-[2px]"
        style={{ font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: 'inherit' }}
      >
        {children}
        <span className="sr-only"> — what does this mean?</span>
      </button>

      {open && (
        <span
          role="tooltip"
          id={tooltipId}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[min(17rem,calc(100vw-2rem))] p-3 text-xs leading-relaxed normal-case tracking-normal font-normal text-left text-[var(--color-text-primary)] bg-[color-mix(in_srgb,var(--color-bg-overlay)_94%,transparent)] backdrop-blur-md border border-[var(--color-border-default)] rounded-[var(--radius-chip)] shadow-[var(--shadow-tile)] transition-opacity pointer-events-none z-50"
        >
          {entry.plain}
          {entry.detail && (
            <span className="mt-2 block text-[11px] text-[var(--color-text-tertiary)]">
              {entry.detail}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
