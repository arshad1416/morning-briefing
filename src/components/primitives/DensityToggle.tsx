// components/primitives/DensityToggle.tsx — comfortable/compact table-density
// pill. Writes the global preference (stores/ui.ts), which stamps
// data-density on <html>; any table opted in via .mg-table follows.
'use client';

import React, { useEffect, useState } from 'react';
import { useUI } from '@/stores/ui';

const OPTIONS = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
] as const;

export function DensityToggle({ className = '' }: { className?: string }) {
  const density = useUI((s) => s.density);
  const setDensity = useUI((s) => s.setDensity);
  // The persisted value is client-only — show the default until mounted so
  // the static HTML and first client render agree (DataFreshness pattern).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? density : 'comfortable';

  return (
    <div
      className={`flex rounded-lg border p-0.5 ${className}`}
      style={{ borderColor: 'var(--color-border-default)' }}
      role="group"
      aria-label="Row density"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={current === o.value}
          onClick={() => setDensity(o.value)}
          className="rounded-md px-2.5 py-1 text-xs font-semibold transition"
          style={
            current === o.value
              ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }
              : { color: 'var(--color-text-secondary)' }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
