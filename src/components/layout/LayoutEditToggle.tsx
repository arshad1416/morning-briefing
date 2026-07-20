// components/layout/LayoutEditToggle.tsx — header control to rearrange cards.
// Only shown on pages that have a draggable bento grid. Enters "edit layout"
// mode (drag handles appear) and offers Reset-to-default for the current page.
'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useLayout } from '@/stores/layout';

// Routes whose client renders a DraggableBentoGrid (pageId = last path segment).
const GRID_PAGES: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/models': 'models',
  '/options': 'options',
};

function pageIdFor(pathname: string | null): string | null {
  if (!pathname) return null;
  const clean = pathname.replace(/\/+$/, '') || '/';
  return GRID_PAGES[clean] ?? null;
}

export function LayoutEditToggle() {
  const pathname = usePathname();
  const pageId = pageIdFor(pathname);
  const editing = useLayout((s) => s.editing);
  const toggleEditing = useLayout((s) => s.toggleEditing);
  const setEditing = useLayout((s) => s.setEditing);
  const reset = useLayout((s) => s.reset);

  // Leave edit mode automatically when navigating to a non-grid page.
  React.useEffect(() => {
    if (!pageId && editing) setEditing(false);
  }, [pageId, editing, setEditing]);

  if (!pageId) return null;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={toggleEditing}
        className="flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:w-auto sm:px-2.5"
        style={{ color: 'var(--color-text-secondary)' }}
        aria-label="Edit layout"
        title="Rearrange cards"
      >
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <rect x="2.5" y="2.5" width="6" height="6" rx="1" />
          <rect x="11.5" y="2.5" width="6" height="6" rx="1" />
          <rect x="2.5" y="11.5" width="6" height="6" rx="1" />
          <rect x="11.5" y="11.5" width="6" height="6" rx="1" />
        </svg>
        <span className="hidden sm:inline">Edit layout</span>
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-0 sm:gap-1.5">
      <button
        type="button"
        onClick={() => reset(pageId)}
        className="min-h-11 rounded-lg px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] min-[360px]:px-2.5 min-[360px]:text-xs"
        style={{ color: 'var(--color-text-tertiary)' }}
        title="Reset this page to the default layout"
        aria-label="Reset layout"
      >
        Reset
      </button>
      <button
        type="button"
        onClick={toggleEditing}
        className="min-h-11 rounded-lg px-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] min-[360px]:px-3 min-[360px]:text-xs"
        style={{ backgroundColor: 'var(--color-accent)', color: '#0b0e1a' }}
        aria-label="Done editing layout"
      >
        Done
      </button>
    </div>
  );
}
