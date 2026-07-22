// components/feature/options/GammaWallChart.tsx — diverging gamma profile by strike
// Puts extend left (resistance red), calls extend right (support emerald), spot line in accent.
//
// Layout stability: the chart windows to the N strikes nearest spot per
// breakpoint, so its height depends only on GEOM — never on the data — and the
// skeleton, gated, and loaded states all occupy an identical CSS aspect-ratio
// box (zero layout shift on load and on the 60s background refetch).
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { gexDetailQuery } from '@/lib/query/options';
import { POLL } from '@/lib/query/policy';
import { GateError } from '@/lib/api/gated';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { Surface, SurfaceHeader, InfoTip, DataFreshness } from '@/components/primitives';
import { formatCompact } from '@/lib/format';
import type { GexStrike } from '@/lib/schemas/market';

interface StrikeRow {
  strike: number;
  call?: GexStrike;
  put?: GexStrike;
}

// strikes[] arrives in feed order (ascending by strike per expiry bucket) —
// regroup by strike and build a price ladder (highest strike on top).
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

// Fixed per-breakpoint geometry. Mobile trades strike count for ≥44px touch
// rows and legible labels. FRAME's aspect ratios must equal W / (N*ROW+2*PAD)
// per breakpoint — keep them in sync when tuning GEOM.
const GEOM = {
  desktop: { W: 720, ROW: 24, PAD: 24, GUTTER: 64, N: 25, FONT: 11 },
  mobile: { W: 360, ROW: 52, PAD: 24, GUTTER: 48, N: 12, FONT: 13 },
} as const;
const FRAME = 'relative w-full aspect-[360/672] md:aspect-[720/648]';
// Reserved mobile detail slot — taller than the tallest detail card so
// pin/unpin never shifts the layout below the chart.
const DETAIL_SLOT = 'md:hidden mt-3 min-h-[156px]';
// The feed regenerates every ~30 min during market hours; 40 min = cron + slack.
const OPTIONS_STALE_MS = 40 * 60_000;

function rowAriaLabel(row: StrikeRow): string {
  const side = (s?: GexStrike) =>
    s ? `GEX ${formatCompact(s.gex)}, OI ${s.oi.toLocaleString('en-US')}` : 'none';
  return `Strike ${row.strike}: put ${side(row.put)}; call ${side(row.call)}`;
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
              <dt className="text-[var(--color-text-tertiary)]">Γ</dt>
              <dd className="text-[var(--color-text-primary)]">{formatCompact(s.gamma)}</dd>
            </div>
          )}
          {s.delta !== 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-text-tertiary)]">Δ</dt>
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

function DetailContent({ row }: { row: StrikeRow }) {
  return (
    <>
      <div className="pr-3 border-r" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] mb-1">Strike</p>
        <p className="text-lg font-semibold text-[var(--color-text-primary)]" data-numeric>
          {row.strike.toFixed(0)}
        </p>
      </div>
      <TooltipSide label="Call" s={row.call} color="var(--color-bull)" />
      <TooltipSide label="Put" s={row.put} color="var(--color-bear)" />
    </>
  );
}

// Invisible copy of the legend row so skeleton/gated frames reserve its exact
// line height (mirrors the ChartsSkeleton same-DOM approach).
function LegendSpacer() {
  return (
    <div
      className="flex items-center justify-between mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-0"
      aria-hidden="true"
    >
      <span>◀ Put GEX · resistance</span>
      <span>Spot</span>
      <span>Call GEX · support ▶</span>
    </div>
  );
}

// Skeleton, gated, and unavailable states mirror the loaded chart's DOM
// (header, legend, aspect box, mobile detail slot) so every state occupies
// identical pixels.
function ChartFrame({ state }: { state: 'loading' | 'gated' | 'unavailable' }) {
  const loading = state === 'loading';
  return (
    <Surface span="hero">
      <SurfaceHeader
        title="Gamma Wall"
        right={
          <span className="text-xs" aria-hidden="true">
            <span className="skeleton rounded text-transparent select-none">00s ago</span>
          </span>
        }
      />
      <div className="p-4" aria-busy={loading || undefined}>
        <LegendSpacer />
        <div className={FRAME}>
          <div className={loading ? 'skeleton w-full h-full' : 'w-full h-full rounded-[var(--radius-chip)] bg-[var(--color-bg-elevated)]'} />
          {state === 'unavailable' && (
            <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-[var(--color-text-tertiary)]">
              Gamma wall data isn’t available right now — retrying automatically.
            </p>
          )}
        </div>
        <div className={DETAIL_SLOT} />
        {loading && <span className="sr-only">Loading gamma data…</span>}
      </div>
    </Surface>
  );
}

export function GammaWallChart() {
  // Call-site polling override (factories stay frozen — see TickerTape). A
  // 401/403 (signin/upgrade) halts polling entirely: free users behind the
  // gate overlay must not generate a Worker request every cycle. Transient
  // 'unavailable' errors keep polling so the chart self-heals after a blip.
  const { data, error } = useQuery({
    ...gexDetailQuery(),
    refetchInterval: (q) => {
      const err = q.state.error;
      return err instanceof GateError && err.kind !== 'unavailable' ? false : POLL.options.live;
    },
  });
  const reduce = useReducedMotion();
  // 48rem, not 768px: Tailwind v4's md: is rem-based, and the FRAME/DETAIL_SLOT
  // classes must flip at exactly the same width even with a non-16px root font.
  const isDesktop = useMediaQuery('(min-width: 48rem)');
  const [active, setActive] = useState<{ strike: number; pinned: boolean } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Stagger the bar entrance only on the first render that has data; silent
  // refetches morph in place. (Keyed on data, not mount — on a cold load the
  // component mounts in the skeleton state long before bars exist.)
  const firstRender = useRef(true);
  const hasData = !!data;
  useEffect(() => {
    if (hasData) firstRender.current = false;
  }, [hasData]);

  // Tap/click outside dismisses a pinned detail card.
  const pinned = active?.pinned ?? false;
  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && e.target instanceof Node && !wrapRef.current.contains(e.target)) {
        setActive(null);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [pinned]);

  const hasActive = active !== null;
  useEffect(() => {
    if (!hasActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hasActive]);

  if (!data) {
    // Hard-gated 401/403 gets a non-pulsing frame behind the gate overlay;
    // settled failures say so honestly (polling keeps retrying); otherwise pulse.
    const state =
      error instanceof GateError && error.kind !== 'unavailable'
        ? 'gated'
        : error
          ? 'unavailable'
          : 'loading';
    return <ChartFrame state={state} />;
  }

  const g = isDesktop ? GEOM.desktop : GEOM.mobile;
  const CX = g.W / 2;
  const HALF = (g.W - g.GUTTER) / 2 - 16;
  const BAR_H = g.ROW - 8;
  const H = g.N * g.ROW + g.PAD * 2;

  const mode = data.modes.all;
  const spot = mode.price;
  // Window to the N strikes nearest spot so height is data-independent, then
  // restore the descending price ladder. maxGex comes from the visible window
  // so a clamped-out far-OTM outlier can't flatten the bars.
  const rows = [...buildLadder(mode.strikes)]
    .sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot))
    .slice(0, g.N)
    .sort((a, b) => b.strike - a.strike);
  const maxGex = Math.max(...rows.flatMap((r) => [r.call?.gex ?? 0, r.put?.gex ?? 0]), 1);

  // Strike whose label gets the accent (nearest to spot).
  const nearestStrike = rows.reduce(
    (best, r) => (Math.abs(r.strike - spot) < Math.abs(best - spot) ? r.strike : best),
    rows[0]?.strike ?? spot,
  );

  // Spot line: interpolate between adjacent rows of the descending ladder.
  const rowCenter = (i: number) => g.PAD + i * g.ROW + g.ROW / 2;
  let spotY: number | null = null;
  if (rows.length > 1) {
    if (spot >= rows[0].strike) spotY = rowCenter(0);
    else if (spot <= rows[rows.length - 1].strike) spotY = rowCenter(rows.length - 1);
    else {
      for (let i = 0; i < rows.length - 1; i++) {
        const hi = rows[i].strike;
        const lo = rows[i + 1].strike;
        if (spot <= hi && spot >= lo) {
          spotY = rowCenter(i) + ((hi - spot) / (hi - lo || 1)) * g.ROW;
          break;
        }
      }
    }
  } else if (rows.length === 1) {
    spotY = rowCenter(0);
  }

  // Active row is keyed by strike so it survives window shifts on refetch.
  const activeRow = active ? (rows.find((r) => r.strike === active.strike) ?? null) : null;
  // If a refetch (or breakpoint flip) dropped the pinned strike out of the
  // window, release the pin — otherwise its `pinned` guard silently blocks
  // hover on every row. Render-phase adjustment per React's sanctioned pattern.
  if (active && !activeRow) setActive(null);
  const activeIdx = activeRow ? rows.indexOf(activeRow) : -1;
  // Pin the desktop tooltip opposite the dominant bar so it never covers it.
  const tooltipOnRight = activeRow ? (activeRow.put?.gex ?? 0) >= (activeRow.call?.gex ?? 0) : true;
  const tooltipTopPct = activeIdx >= 0 ? Math.min(78, Math.max(4, ((g.PAD + activeIdx * g.ROW) / H) * 100)) : 0;

  const togglePin = (strike: number) =>
    setActive((a) => (a?.strike === strike && a.pinned ? null : { strike, pinned: true }));

  return (
    <Surface span="hero">
      <SurfaceHeader
        title={<InfoTip term="gamma_wall">Gamma Wall — {data.ticker}</InfoTip>}
        right={
          <div className="flex items-center gap-2">
            <DataFreshness timestamp={data.generated_at} staleAfterMs={OPTIONS_STALE_MS} />
            {/* hidden on phones so the header never wraps to a second line */}
            <span className="hidden sm:inline text-xs text-[var(--color-text-tertiary)]" style={{ fontFamily: 'var(--font-mono)' }}>
              {mode.expiry_count} expiries
            </span>
          </div>
        }
      />
      {/* wrapRef spans the chart AND the mobile detail slot so tapping the
          detail card doesn't count as tap-outside and dismiss the pin */}
      <div className="p-4" ref={wrapRef}>
        {/* Legend / axis captions */}
        <div className="flex items-center justify-between mb-3 text-[10px] font-semibold uppercase tracking-[0.14em]">
          <span style={{ color: 'var(--color-bear)' }}>◀ Put GEX · resistance</span>
          <span className="text-[var(--color-text-tertiary)]" data-numeric>
            Spot <span style={{ color: 'var(--color-accent)' }}>${spot.toFixed(2)}</span>
          </span>
          <span style={{ color: 'var(--color-bull)' }}>Call GEX · support ▶</span>
        </div>

        <div className={FRAME}>
          <svg viewBox={`0 0 ${g.W} ${H}`} className="w-full h-full" role="img" aria-label={`Gamma profile for ${data.ticker}: put and call gamma exposure by strike`}>
            {/* Zero-axis hairlines */}
            <line x1={CX - g.GUTTER / 2} y1={g.PAD - 8} x2={CX - g.GUTTER / 2} y2={H - g.PAD + 8} stroke="var(--color-border-default)" strokeWidth="1" />
            <line x1={CX + g.GUTTER / 2} y1={g.PAD - 8} x2={CX + g.GUTTER / 2} y2={H - g.PAD + 8} stroke="var(--color-border-default)" strokeWidth="1" />

            {rows.map((row, i) => {
              const y = g.PAD + i * g.ROW;
              const isMaxGex = row.strike === mode.max_gex_strike;
              const isNear = row.strike === nearestStrike;
              const putW = ((row.put?.gex ?? 0) / maxGex) * HALF;
              const callW = ((row.call?.gex ?? 0) / maxGex) * HALF;
              const barY = y + (g.ROW - BAR_H) / 2;
              const putX = CX - g.GUTTER / 2 - putW;
              const callX = CX + g.GUTTER / 2;
              const glow = isMaxGex ? { filter: 'drop-shadow(0 0 5px currentColor)' } : undefined;
              const isActive = activeIdx === i;

              return (
                <g key={row.strike}>
                  {isActive && <rect x={0} y={y} width={g.W} height={g.ROW} fill="rgba(255,255,255,0.03)" />}

                  {row.put &&
                    (reduce ? (
                      <rect x={putX} y={barY} width={putW} height={BAR_H} rx={2} fill="var(--color-bear)" color="var(--color-bear)" fillOpacity={isMaxGex ? 1 : 0.85} style={glow} />
                    ) : (
                      <motion.rect
                        initial={{ width: 0, x: CX - g.GUTTER / 2 }}
                        animate={{ width: putW, x: putX }}
                        transition={{ duration: 0.5, delay: firstRender.current ? i * 0.015 : 0, ease: [0.22, 1, 0.36, 1] }}
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
                        transition={{ duration: 0.5, delay: firstRender.current ? i * 0.015 : 0, ease: [0.22, 1, 0.36, 1] }}
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
                    y={y + g.ROW / 2 + 3.5}
                    textAnchor="middle"
                    fontSize={g.FONT}
                    fontFamily="var(--font-mono)"
                    fontWeight={isMaxGex || isNear ? 600 : 400}
                    fill={isNear ? 'var(--color-accent)' : isMaxGex ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'}
                  >
                    {row.strike.toFixed(0)}
                  </text>

                  {/* Hover/focus/tap target spanning the row. Tap or Enter pins
                      the detail card; tap outside or Escape dismisses. */}
                  <rect
                    x={0}
                    y={y}
                    width={g.W}
                    height={g.ROW}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={rowAriaLabel(row)}
                    aria-pressed={isActive && pinned}
                    onPointerEnter={(e) => {
                      if (e.pointerType === 'mouse') {
                        setActive((a) => (a?.pinned ? a : { strike: row.strike, pinned: false }));
                      }
                    }}
                    onPointerLeave={(e) => {
                      if (e.pointerType === 'mouse') {
                        setActive((a) => (a?.pinned ? a : null));
                      }
                    }}
                    onClick={() => togglePin(row.strike)}
                    onFocus={() => setActive((a) => (a?.pinned ? a : { strike: row.strike, pinned: false }))}
                    onBlur={() => setActive((a) => (a?.pinned ? a : null))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        togglePin(row.strike);
                      }
                    }}
                    style={{ outline: 'none', cursor: 'pointer' }}
                  />
                </g>
              );
            })}

            {/* Spot price line */}
            {spotY !== null && (
              <g>
                <line x1={0} y1={spotY} x2={g.W} y2={spotY} stroke="var(--color-accent)" strokeWidth="1" strokeDasharray="4 4" />
                <text x={g.W - 4} y={spotY - 5} textAnchor="end" fontSize={g.FONT - 1} fontFamily="var(--font-mono)" fontWeight={600} fill="var(--color-accent)">
                  SPOT ${spot.toFixed(2)}
                </text>
              </g>
            )}
          </svg>

          {/* Desktop floating detail card (overlay — never shifts layout) */}
          {activeRow && (
            <div
              className="absolute z-10 pointer-events-none rounded-[var(--radius-chip)] border p-3 hidden md:flex gap-4 backdrop-blur-md"
              style={{
                top: `${tooltipTopPct}%`,
                ...(tooltipOnRight ? { left: '56%' } : { right: '56%' }),
                backgroundColor: 'color-mix(in srgb, var(--color-bg-overlay) 88%, transparent)',
                borderColor: 'var(--color-border-default)',
                boxShadow: 'var(--shadow-tile)',
              }}
            >
              <DetailContent row={activeRow} />
            </div>
          )}
        </div>

        {/* Mobile detail slot — reserved height, filled on tap */}
        <div className={DETAIL_SLOT}>
          {activeRow ? (
            <div
              className="rounded-[var(--radius-chip)] border p-3 flex gap-4"
              style={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-default)' }}
            >
              <DetailContent row={activeRow} />
            </div>
          ) : (
            <p className="pt-2 text-[11px] text-[var(--color-text-tertiary)]">Tap a strike for details.</p>
          )}
        </div>
      </div>
    </Surface>
  );
}
