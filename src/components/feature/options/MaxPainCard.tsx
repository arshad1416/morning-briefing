'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { gexQuery } from '@/lib/query/options';

function metric(value: number | null | undefined, suffix = '') {
  if (value == null) return '—';
  return `${value.toFixed(0)}${suffix}`;
}

export function MaxPainCard() {
  const { data, isLoading } = useQuery(gexQuery());
  const p = data?.positioning;
  const mode = data?.modes.all;

  const maxPain = p?.max_pain ?? null;
  const spot = p?.spot ?? null;
  const gammaFlip = p?.gamma_flip ?? null;

  // Compute distance from spot to max pain
  const distancePct =
    maxPain != null && spot != null && spot > 0
      ? ((maxPain - spot) / spot) * 100
      : null;

  const maxPainAbove = distancePct != null && distancePct > 0;
  const maxPainBelow = distancePct != null && distancePct < 0;

  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-tile)] shadow-[var(--shadow-tile)] overflow-hidden h-full">
      <div
        className="px-4 py-3 border-b flex items-center justify-between gap-3"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <h3 className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-[0.14em]">
          Max Pain
        </h3>
        <span className="text-[10px] font-medium text-[var(--color-text-tertiary)]">
          PRO · EOD
        </span>
      </div>
      <div className="p-4">
        {isLoading || !data ? (
          <div className="skeleton h-24" />
        ) : (
          <>
            <div
              className="grid grid-cols-2 gap-4"
              style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
            >
              {/* Max Pain */}
              <div className="min-w-0">
                <p className="text-xs text-[var(--color-text-tertiary)]">Max Pain</p>
                <p
                  className="text-xl font-bold mt-0.5 text-[var(--color-text-primary)]"
                  data-numeric
                >
                  {maxPain != null ? `$${metric(maxPain)}` : '—'}
                </p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                  {distancePct != null
                    ? `${maxPainAbove ? '↓' : maxPainBelow ? '↑' : '·'} ${Math.abs(distancePct).toFixed(1)}% ${maxPainAbove ? 'below' : maxPainBelow ? 'above' : 'at'} spot`
                    : 'N/A'}
                </p>
              </div>

              {/* Spot */}
              <div className="min-w-0">
                <p className="text-xs text-[var(--color-text-tertiary)]">Spot</p>
                <p
                  className="text-xl font-bold mt-0.5 text-[var(--color-text-primary)]"
                  data-numeric
                >
                  {spot != null ? `$${spot.toFixed(2)}` : '—'}
                </p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                  {gammaFlip != null ? `Flip $${gammaFlip.toFixed(0)}` : 'Flip N/A'}
                </p>
              </div>
            </div>

            {/* Key Levels Bar */}
            {maxPain != null && spot != null && mode != null && (
              <div className="mt-4 relative">
                <div
                  className="relative h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--color-bg-elevated)' }}
                >
                  {/* Spot marker */}
                  <span
                    className="absolute top-0 bottom-0 w-0.5 z-10"
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      left: '50%',
                    }}
                    aria-hidden="true"
                  />
                  {/* Max pain indicator — left of center if maxPain < spot, right if > */}
                  <span
                    className="absolute top-0 bottom-0 w-1 z-10 rounded-full"
                    style={{
                      backgroundColor:
                        maxPain > spot
                          ? 'var(--color-bull)'
                          : maxPain < spot
                          ? 'var(--color-bear)'
                          : 'var(--color-text-tertiary)',
                      left: maxPain > spot ? '45%' : maxPain < spot ? '55%' : '50%',
                    }}
                    aria-hidden="true"
                  />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-[var(--color-text-tertiary)]">
                  <span style={{ fontFamily: 'var(--font-mono)' }} data-numeric>
                    MP ${maxPain.toFixed(0)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)' }} data-numeric>
                    Spot ${spot.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <p className="mt-3 text-[10px] text-[var(--color-text-tertiary)] leading-relaxed">
              {data?.generated_at
                ? `Analytical max pain from open interest. Spot typically reverts toward max pain near expiry. Last calculation: ${new Date(data.generated_at).toLocaleString()}.`
                : 'Analytical max pain from open interest. Not advice.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
