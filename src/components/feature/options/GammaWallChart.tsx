// components/feature/options/GammaWallChart.tsx — diverging gamma profile by strike
// Puts extend left (red), calls extend right (emerald), spot line in accent. The
// side captions deliberately no longer claim support/resistance: in this data
// put gamma sits at and below spot (the pipeline's floor_zone) and call gamma at
// and above it (ceiling_zone), which is the opposite of what they used to say.
'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { gexDetailQuery } from '@/lib/query/options';
import { Surface, SurfaceHeader, InfoTip } from '@/components/primitives';
import { formatCompact } from '@/lib/format';
import type { GexStrike } from '@/lib/schemas/market';

interface StrikeRow {
  strike: number;
  call?: GexStrike;
  put?: GexStrike;
}

// strikes[] arrives sorted by GEX magnitude — regroup by strike and build a
// price ladder (highest strike on top).
function buildLadder(strikes: GexStrike[]): StrikeRow[] {
  const byStrike = new Map<number, StrikeRow>();
  for (const s of strikes) {
    const row = byStrike.get(s.strike) ?? { strike: s.strike };
    if (s.type === 'C') row.call = s;
    else row.put = s;
    byStrike.set(s.strike, row);
  }
  return [...byStrike.values()].sort((a, b) => b.strike - a.strike);
}

const W = 720;
const ROW = 24;
const PAD = 24;
const GUTTER = 64;
const CX = W / 2;
const HALF = (W - GUTTER) / 2 - 16;
const BAR_H = ROW - 8;

function rowAriaLabel(row: StrikeRow): string {
  // Spelled out: screen-reader users were previously read raw "GEX"/"OI", i.e.
  // strictly less context than sighted users get from the legend.
  const side = (s?: GexStrike) =>
    s
      ? `gamma exposure ${formatCompact(s.gex)}, open interest ${s.oi.toLocaleString('en-US')}`
      : 'none';
  return `Strike price $${row.strike}: puts ${side(row.put)}; calls ${side(row.call)}`;
}

function TooltipSide({ label, s, color }: { label: string; s?: GexStrike; color: string }) {
  return (
    <div className="min-w-[92px]">
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-1" style={{ color }}>
        {label}
      </p>
      {s ? (
        <dl className="space-y-0.5 text-[11px]" data-numeric>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--color-text-tertiary)]">OI</dt>
            <dd className="text-[var(--color-text-primary)]">{s.oi.toLocaleString('en-US')}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--color-text-tertiary)]">GEX</dt>
            <dd className="text-[var(--color-text-primary)]">{formatCompact(s.gex)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--color-text-tertiary)]">DEX</dt>
            <dd className="text-[var(--color-text-primary)]">{formatCompact(s.dex)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--color-text-tertiary)]">VEX</dt>
            <dd className="text-[var(--color-text-primary)]">{formatCompact(s.vex)}</dd>
          </div>
          {s.gamma !== 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-text-tertiary)]">Gamma</dt>
              <dd className="text-[var(--color-text-primary)]">{formatCompact(s.gamma)}</dd>
            </div>
          )}
          {s.delta !== 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-text-tertiary)]">Delta</dt>
              <dd className="text-[var(--color-text-primary)]">{formatCompact(s.delta)}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-[11px] text-[var(--color-text-tertiary)]">—</p>
      )}
    </div>
  );
}

export function GammaWallChart() {
  const { data, isLoading } = useQuery(gexDetailQuery());
  const reduce = useReducedMotion();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (isLoading || !data) {
    return (
      <Surface span="hero">
        <SurfaceHeader title={<InfoTip term="gamma_wall">Gamma Wall</InfoTip>} />
        <div className="p-4 skeleton h-64" />
      </Surface>
    );
  }

  const mode = data.modes.all;
  const rows = buildLadder(mode.strikes);
  const maxGex = Math.max(...mode.strikes.map((s) => s.gex), 1);
  const spot = mode.price;
  const H = rows.length * ROW + PAD * 2;

  // Strike whose label gets the accent (nearest to spot).
  const nearestStrike = rows.reduce(
    (best, r) => (Math.abs(r.strike - spot) < Math.abs(best - spot) ? r.strike : best),
    rows[0]?.strike ?? spot,
  );

  // Spot line: interpolate between adjacent rows of the descending ladder.
  const rowCenter = (i: number) => PAD + i * ROW + ROW / 2;
  let spotY: number | null = null;
  if (rows.length > 1) {
    if (spot >= rows[0].strike) spotY = rowCenter(0);
    else if (spot <= rows[rows.length - 1].strike) spotY = rowCenter(rows.length - 1);
    else {
      for (let i = 0; i < rows.length - 1; i++) {
        const hi = rows[i].strike;
        const lo = rows[i + 1].strike;
        if (spot <= hi && spot >= lo) {
          spotY = rowCenter(i) + ((hi - spot) / (hi - lo || 1)) * ROW;
          break;
        }
      }
    }
  } else if (rows.length === 1) {
    spotY = rowCenter(0);
  }

  const hovered = hoverIdx !== null ? rows[hoverIdx] : null;
  // Pin the tooltip opposite the dominant bar so it never covers it.
  const tooltipOnRight = hovered ? (hovered.put?.gex ?? 0) >= (hovered.call?.gex ?? 0) : true;
  const tooltipTopPct = hoverIdx !== null ? Math.min(78, Math.max(4, ((PAD + hoverIdx * ROW) / H) * 100)) : 0;

  return (
    <Surface span="hero">
      <SurfaceHeader
        title={<InfoTip term="gamma_wall">Gamma Wall — {data.ticker}</InfoTip>}
        right={
          <span className="text-xs text-[var(--color-text-tertiary)]" style={{ fontFamily: 'var(--font-mono)' }}>
            {mode.expiry_count} expiry dates combined
          </span>
        }
      />
      <div className="p-4">
        {/* The floor/ceiling reading is conditional and the condition is not
            decoration: it only holds while dealers are net long gamma, and in
            the current data dealer gamma is negative — the regime in which the
            same levels can accelerate a move instead of blocking it. The
            glossary carries that caveat in `gamma_wall.detail`, but that text
            only appears with Learning Mode on, so it has to be stated here too. */}
        <p className="mb-3 text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">
          Every bar is how much hedging sits at that price level — puts to the left, calls to the
          right, the latest price marked by the dashed line. A heavy put level below that price
          tends to act as a floor, and a heavy call level above it as a ceiling — but only while{' '}
          <InfoTip term="dealer_gamma">dealer gamma</InfoTip> is positive. When it is negative (see
          the Dealer Positioning card), those same levels can speed a move through instead of
          blocking it. The glowing row marks the price level carrying the most hedging.
        </p>

        {/* Legend / axis captions. The old captions read "Put GEX · resistance"
            and "Call GEX · support", which inverts the data: put gamma sits at
            and below spot (the pipeline's own floor_zone) and call gamma at and
            above it (ceiling_zone). Side labels now state only which leg each
            side plots; the floor/ceiling reading is in the caption above. */}
        <div className="flex items-center justify-between mb-3 text-[10px] font-semibold uppercase tracking-[0.14em]">
          <span style={{ color: 'var(--color-bear)' }}>◀ Put gamma</span>
          <span className="text-[var(--color-text-tertiary)]" data-numeric>
            <InfoTip term="spot">Spot</InfoTip>{' '}
            <span style={{ color: 'var(--color-accent)' }}>${spot.toFixed(2)}</span>
          </span>
          <span style={{ color: 'var(--color-bull)' }}>Call gamma ▶</span>
        </div>

        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`How much dealer hedging sits at each price level for ${data.ticker}: put gamma exposure to the left of each strike price, call gamma exposure to the right`}>
            {/* Zero-axis hairlines */}
            <line x1={CX - GUTTER / 2} y1={PAD - 8} x2={CX - GUTTER / 2} y2={H - PAD + 8} stroke="var(--color-border-default)" strokeWidth="1" />
            <line x1={CX + GUTTER / 2} y1={PAD - 8} x2={CX + GUTTER / 2} y2={H - PAD + 8} stroke="var(--color-border-default)" strokeWidth="1" />

            {rows.map((row, i) => {
              const y = PAD + i * ROW;
              const isMaxGex = row.strike === mode.max_gex_strike;
              const isNear = row.strike === nearestStrike;
              const putW = ((row.put?.gex ?? 0) / maxGex) * HALF;
              const callW = ((row.call?.gex ?? 0) / maxGex) * HALF;
              const barY = y + (ROW - BAR_H) / 2;
              const putX = CX - GUTTER / 2 - putW;
              const callX = CX + GUTTER / 2;
              const glow = isMaxGex ? { filter: 'drop-shadow(0 0 5px currentColor)' } : undefined;

              return (
                <g key={row.strike}>
                  {hoverIdx === i && <rect x={0} y={y} width={W} height={ROW} fill="rgba(255,255,255,0.03)" />}

                  {row.put &&
                    (reduce ? (
                      <rect x={putX} y={barY} width={putW} height={BAR_H} rx={2} fill="var(--color-bear)" color="var(--color-bear)" fillOpacity={isMaxGex ? 1 : 0.85} style={glow} />
                    ) : (
                      <motion.rect
                        initial={{ width: 0, x: CX - GUTTER / 2 }}
                        animate={{ width: putW, x: putX }}
                        transition={{ duration: 0.5, delay: i * 0.015, ease: [0.22, 1, 0.36, 1] }}
                        y={barY}
                        height={BAR_H}
                        rx={2}
                        fill="var(--color-bear)"
                        color="var(--color-bear)"
                        fillOpacity={isMaxGex ? 1 : 0.85}
                        style={glow}
                      />
                    ))}
                  {row.call &&
                    (reduce ? (
                      <rect x={callX} y={barY} width={callW} height={BAR_H} rx={2} fill="var(--color-bull)" color="var(--color-bull)" fillOpacity={isMaxGex ? 1 : 0.85} style={glow} />
                    ) : (
                      <motion.rect
                        initial={{ width: 0 }}
                        animate={{ width: callW }}
                        transition={{ duration: 0.5, delay: i * 0.015, ease: [0.22, 1, 0.36, 1] }}
                        x={callX}
                        y={barY}
                        height={BAR_H}
                        rx={2}
                        fill="var(--color-bull)"
                        color="var(--color-bull)"
                        fillOpacity={isMaxGex ? 1 : 0.85}
                        style={glow}
                      />
                    ))}

                  <text
                    x={CX}
                    y={y + ROW / 2 + 3.5}
                    textAnchor="middle"
                    fontSize="11"
                    fontFamily="var(--font-mono)"
                    fontWeight={isMaxGex || isNear ? 600 : 400}
                    fill={isNear ? 'var(--color-accent)' : isMaxGex ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'}
                  >
                    {row.strike.toFixed(0)}
                  </text>

                  {/* Hover/focus target spanning the row */}
                  <rect
                    x={0}
                    y={y}
                    width={W}
                    height={ROW}
                    fill="transparent"
                    tabIndex={0}
                    role="img"
                    aria-label={rowAriaLabel(row)}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                    onFocus={() => setHoverIdx(i)}
                    onBlur={() => setHoverIdx(null)}
                    style={{ outline: 'none', cursor: 'crosshair' }}
                  />
                </g>
              );
            })}

            {/* Spot price line */}
            {spotY !== null && (
              <g>
                <line x1={0} y1={spotY} x2={W} y2={spotY} stroke="var(--color-accent)" strokeWidth="1" strokeDasharray="4 4" />
                <text x={W - 4} y={spotY - 5} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fontWeight={600} fill="var(--color-accent)">
                  SPOT ${spot.toFixed(2)}
                </text>
              </g>
            )}
          </svg>

          {/* Hover detail card */}
          {hovered && (
            <div
              className="absolute z-10 pointer-events-none rounded-[var(--radius-chip)] border p-3 flex gap-4 backdrop-blur-md"
              style={{
                top: `${tooltipTopPct}%`,
                ...(tooltipOnRight ? { left: '56%' } : { right: '56%' }),
                backgroundColor: 'color-mix(in srgb, var(--color-bg-overlay) 88%, transparent)',
                borderColor: 'var(--color-border-default)',
                boxShadow: 'var(--shadow-tile)',
              }}
            >
              <div className="pr-3 border-r" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] mb-1">Strike</p>
                <p className="text-lg font-semibold text-[var(--color-text-primary)]" data-numeric>
                  {hovered.strike.toFixed(0)}
                </p>
              </div>
              <TooltipSide label="Call" s={hovered.call} color="var(--color-bull)" />
              <TooltipSide label="Put" s={hovered.put} color="var(--color-bear)" />
            </div>
          )}
        </div>
      </div>
    </Surface>
  );
}
