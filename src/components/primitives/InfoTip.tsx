// components/primitives/InfoTip.tsx — Learning Mode hook
//
// Wraps a piece of jargon and, when Learning Mode is on, explains it in plain
// English. Definitions live in @/lib/glossary — never inline wording here.
//
// Two things this component has to get right, both of which it previously got
// wrong:
//
// 1. Reachability. It used to be a hover-only <span> with pointer-events-none,
//    so it did nothing on touch and was unreachable by keyboard — invisible to
//    exactly the beginners it exists for. It is now a real <button>: hover,
//    focus, tap, outside-tap and Escape all work.
//
// 2. Visibility. An absolutely-positioned tooltip is clipped by any ancestor
//    with overflow-hidden or overflow-x-auto — which covers Surface (every card
//    header) and every scrollable table on the site. So the panel is rendered
//    through a portal to document.body with fixed positioning, and flips below
//    the trigger when there is no room above. It is also clamped to the
//    viewport so it cannot run off-screen on a narrow phone.
'use client';

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

const PANEL_WIDTH = 272; // px — matches w-68 below
const GAP = 8;
const MARGIN = 8;

export function InfoTip({ term, children, className = '' }: InfoTipProps) {
  const learningMode = useUI((s) => s.learningMode);
  const [open, setOpen] = useState(false);
  // `persist` rehydrates from localStorage on the client, so the prerendered
  // HTML must not commit to a decorated or undecorated state.
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; below: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const panelHeight = panelRef.current?.offsetHeight ?? 96;

    // Flip below when there isn't room above.
    const below = r.top - panelHeight - GAP < MARGIN;
    const top = below ? r.bottom + GAP : r.top - panelHeight - GAP;

    // Centre on the trigger, then clamp so it can't leave the viewport.
    const half = PANEL_WIDTH / 2;
    const maxLeft = window.innerWidth - PANEL_WIDTH - MARGIN;
    const left = Math.max(MARGIN, Math.min(r.left + r.width / 2 - half, Math.max(MARGIN, maxLeft)));

    setPos({ top, left, below });
  }, []);

  // Measure before paint so the panel never flashes in the wrong spot.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    // A tap anywhere else dismisses it — without this, an open tooltip on a
    // phone could only be closed by tapping the same trigger again.
    function onPointerDown(e: PointerEvent) {
      if (!triggerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    // The panel is position:fixed, so it would otherwise detach from its
    // trigger as soon as the page or a table scrolls underneath it.
    function onScroll() {
      setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const entry = lookup(term);

  if (!mounted || !learningMode || !entry) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
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

      {open &&
        createPortal(
          <span
            ref={panelRef}
            role="tooltip"
            id={tooltipId}
            style={{
              position: 'fixed',
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width: PANEL_WIDTH,
              visibility: pos ? 'visible' : 'hidden',
            }}
            className="p-3 text-xs leading-relaxed normal-case tracking-normal font-normal text-left text-[var(--color-text-primary)] bg-[color-mix(in_srgb,var(--color-bg-overlay)_96%,transparent)] backdrop-blur-md border border-[var(--color-border-default)] rounded-[var(--radius-chip)] shadow-[var(--shadow-tile)] pointer-events-none z-[999]"
          >
            {entry.plain}
            {entry.detail && (
              <span className="mt-2 block text-[11px] text-[var(--color-text-tertiary)]">{entry.detail}</span>
            )}
          </span>,
          document.body
        )}
    </span>
  );
}
