// app/research/research-client.tsx — consolidated reading room, ported from the
// legacy SPA. Tabs: Overview (audio briefing + AI narrative + central banks +
// insider/earnings), News, Reddit sentiment, Ideas, MapleGamma Analysis (Basic),
// Backtest (Pro), Prediction Markets (Basic), Earnings (Basic), SEC (Basic).
//
// Public tabs read Pages /data/*; premium tabs go through the Worker data gate
// and render a GateCard on 401/403 — the server decides, the UI reflects it.
'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GateCard } from '@/components/feature/gating/GateCard';
import { fetchGated, GateError } from '@/lib/api/gated';

/* ------------------------------------------------------------------ */
/*  Loose fetch layer — these secondary feeds have drifting schemas,  */
/*  so (like the legacy SPA) we validate defensively at render time.  */
/* ------------------------------------------------------------------ */

const raw = <T,>() => ({ parse: (d: unknown) => d as T });

async function fetchPublic<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

const usePublic = <T,>(name: string, url: string) =>
  useQuery<T>({ queryKey: ['research', name], queryFn: () => fetchPublic<T>(url), staleTime: 300_000, retry: false });

const useGated = <T,>(name: string, file: string, enabled = true) =>
  useQuery<T>({
    queryKey: ['research', name],
    queryFn: () => fetchGated<T>(file, raw<T>()),
    staleTime: 300_000,
    retry: false,
    enabled,
  });

/* ------------------------------------------------------------------ */
/*  Shared bits                                                       */
/* ------------------------------------------------------------------ */

const fmtTs = (iso?: string | null) => {
  if (!iso) return '';
  // Pi artifacts carry timezone-NAIVE ET wall time ("2026-07-21 17:15").
  // new Date() would parse that in the viewer's zone (Invalid Date on Safari),
  // so render naive strings as-is; only real ISO strings with Z/offset get
  // converted to ET.
  const hasOffset = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso.trim());
  if (!hasOffset) return `${iso.trim().slice(0, 16)} ET`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'long', timeStyle: 'short' })} ET`;
};

function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[var(--radius-tile)] border overflow-hidden ${className}`}
      style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
    >
      {title && (
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">{title}</h3>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

function Updated({ iso }: { iso?: string | null }) {
  const s = fmtTs(iso);
  return s ? <p className="text-xs text-[var(--color-text-tertiary)]">Last updated: {s}</p> : null;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="p-6 text-center text-sm text-[var(--color-text-tertiary)]">{children}</p>;
}

function Badge({ tone, children }: { tone: 'bull' | 'bear' | 'caution'; children: React.ReactNode }) {
  const color = tone === 'bull' ? 'var(--color-bull)' : tone === 'bear' ? 'var(--color-bear)' : 'var(--color-caution)';
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      {children}
    </span>
  );
}

type DetailTone = 'bull' | 'bear' | 'caution';

type DetailView = {
  eyebrow: string;
  title: string;
  summary?: string;
  badge?: { tone: DetailTone; label: string };
  body: React.ReactNode;
};

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailFacts({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  const visible = items.filter((item) => item.value !== undefined && item.value !== null && item.value !== '');
  if (!visible.length) return null;
  return (
    <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border sm:grid-cols-2" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-border-subtle)' }}>
      {visible.map((item) => (
        <div key={item.label} className="min-w-0 p-3" style={{ backgroundColor: 'var(--color-bg-elevated)' }}>
          <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">{item.label}</dt>
          <dd className="mt-1 break-words text-sm font-medium text-[var(--color-text-primary)]" data-numeric>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DetailTrigger({
  label,
  onClick,
  children,
  className = '',
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`group flex w-full items-start gap-3 rounded-lg px-2 text-left transition-colors hover:bg-[var(--color-bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${className}`}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[var(--color-text-tertiary)] transition-colors group-hover:border-[var(--color-border-strong)] group-hover:text-[var(--color-accent)]" style={{ borderColor: 'var(--color-border-subtle)' }} aria-hidden="true">
        <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7 4 6 6-6 6" />
        </svg>
      </span>
    </button>
  );
}

function ResearchDetailDialog({ detail, onClose }: { detail: DetailView | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const summaryId = useId();

  useEffect(() => {
    if (!detail) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.querySelector<HTMLElement>('[data-detail-autofocus]')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      ).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [detail, onClose]);

  if (!detail) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-5">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close analysis details"
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={detail.summary ? summaryId : undefined}
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border shadow-2xl sm:max-w-2xl sm:rounded-2xl"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
      >
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-caution), transparent 82%)' }} />
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b px-5 py-4 backdrop-blur-xl sm:px-6" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'color-mix(in srgb, var(--color-bg-surface) 92%, transparent)' }}>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">{detail.eyebrow}</p>
            <h2 id={titleId} className="mt-1 font-display text-2xl leading-tight text-[var(--color-text-primary)] sm:text-3xl">{detail.title}</h2>
          </div>
          <button
            type="button"
            data-detail-autofocus
            onClick={onClose}
            aria-label="Close analysis details"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl leading-none text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            ×
          </button>
        </div>
        <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          {(detail.badge || detail.summary) && (
            <div className="border-l-2 pl-4" style={{ borderColor: 'var(--color-accent)' }}>
              {detail.badge && <Badge tone={detail.badge.tone}>{detail.badge.label}</Badge>}
              {detail.summary && <p id={summaryId} className={`${detail.badge ? 'mt-2' : ''} text-sm leading-relaxed text-[var(--color-text-primary)]`}>{detail.summary}</p>}
            </div>
          )}
          {detail.body}
          <p className="border-t pt-4 text-xs leading-relaxed text-[var(--color-text-tertiary)]" style={{ borderColor: 'var(--color-border-subtle)' }}>
            Analysis is informational and may change as new market data arrives. It is not personalized investment advice.
          </p>
        </div>
      </div>
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  const safe = /^https?:\/\//i.test(href) ? href : '#';
  return (
    <a href={safe} target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors font-medium">
      {children}
    </a>
  );
}

/** Responsive 2-up layout: 1 column on mobile/tablet, 2 columns at ≥lg (1024px,
 *  the design system's bento breakpoint). Pure presentation — hydration-safe. */
function Grid2({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 gap-4 lg:grid-cols-2 ${className}`}>{children}</div>;
}

/** Renders a gated query state: gate card, empty state, or content.
 *  `need` is the file's own tier, used when the Worker's 403 carries none
 *  (e.g. no_subscription) so the upsell never names the wrong plan. */
function GatedPane<T>({
  q,
  feature,
  need: fallbackNeed = 'basic',
  children,
}: {
  q: { data?: T; error: unknown; isLoading: boolean };
  feature: string;
  need?: 'basic' | 'pro';
  children: (data: T) => React.ReactNode;
}) {
  if (q.isLoading) return <Empty>Loading…</Empty>;
  if (q.error) {
    const kind = q.error instanceof GateError ? q.error.kind : 'unavailable';
    const need = (q.error instanceof GateError ? q.error.need : undefined) ?? fallbackNeed;
    return <GateCard kind={kind} need={need} feature={feature} />;
  }
  if (q.data == null) return <Empty>No data available yet.</Empty>;
  return <>{children(q.data)}</>;
}

/* ------------------------------------------------------------------ */
/*  Markdown-ish renderer for the AI narrative (ported from utils.js) */
/* ------------------------------------------------------------------ */

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderNarrative(text: string): string {
  const lines = esc(text.replace(/\r\n?/g, '\n')).split('\n');
  const out: string[] = [];
  let inList = false;
  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line) {
      if (inList) { out.push('</ul>'); inList = false; }
      continue;
    }
    const header = line.match(/^\*\*(.+)\*\*$/);
    if (header) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h3 class="narrative-h">${header[1]}</h3>`);
      continue;
    }
    const bolded = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (/^[•\-*]\s+/.test(line)) {
      if (!inList) { out.push('<ul class="narrative-ul">'); inList = true; }
      out.push(`<li>${bolded.replace(/^[•\-*]\s+/, '')}</li>`);
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<p>${bolded}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Audio briefing (Eastern date — matches the Pi publishing schedule) */
/* ------------------------------------------------------------------ */

function AudioBriefing() {
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    const dates: string[] = [];
    const cursor = new Date();
    while (dates.length < 15) {
      const weekday = cursor.getDay();
      if (weekday !== 0 && weekday !== 6)
        dates.push(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(cursor));
      cursor.setDate(cursor.getDate() - 1);
    }
    setQueue(dates);
  }, []);

  const selected = queue[index];
  if (!selected) return null;

  const older = () => {
    if (index < queue.length - 1) { setIndex((value) => value + 1); setExhausted(false); }
  };
  const newer = () => {
    if (index > 0) { setIndex((value) => value - 1); setExhausted(false); }
  };
  const skipMissing = () => {
    if (index < queue.length - 1) older();
    else setExhausted(true);
  };

  return (
    <Card>
      <div className="flex items-center gap-4">
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
          style={{ backgroundColor: 'var(--color-accent-dim)', borderColor: 'color-mix(in srgb, var(--color-accent) 25%, transparent)' }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="var(--color-accent)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 13a8 8 0 0 1 16 0" />
            <rect x="2.5" y="13" width="4" height="7" rx="1.5" />
            <rect x="17.5" y="13" width="4" height="7" rx="1.5" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Audio Briefing</p>
          <p className="text-xs text-[var(--color-text-tertiary)]" data-numeric>{selected} · top-headline queue</p>
        </div>
        {exhausted ? (
          <span className="text-sm text-[var(--color-text-tertiary)]">No recent briefing available</span>
        ) : (
          <audio
            key={selected}
            controls
            preload="none"
            className="h-9 max-w-[280px]"
            onError={skipMissing}
          >
            <source src={`/data/audio/briefing-${selected}.mp3`} type="audio/mpeg" />
          </audio>
        )}
        <div className="flex gap-1">
          <button type="button" onClick={older} disabled={index >= queue.length - 1} className="rounded border px-2 py-1 text-xs disabled:opacity-40" style={{ borderColor: 'var(--color-border-subtle)' }}>Older</button>
          <button type="button" onClick={newer} disabled={index === 0} className="rounded border px-2 py-1 text-xs disabled:opacity-40" style={{ borderColor: 'var(--color-border-subtle)' }}>Newer</button>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Loose data shapes (defensive access, schemas drift)               */
/* ------------------------------------------------------------------ */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const ideaTone = (type?: string): DetailTone =>
  type === 'BULLISH_CONVERGENCE' ? 'bull' : type === 'BEARISH_CONVERGENCE' || type === 'SECTOR_AVOID' ? 'bear' : 'caution';

const ideaGuide = (type?: string) => {
  switch (type) {
    case 'BULLISH_CONVERGENCE':
      return {
        meaning: 'Several independent inputs are leaning bullish at the same time. Agreement across signals can make the setup more useful than any one input on its own.',
        caution: 'Convergence measures agreement, not certainty. Confirm that price, volume and the broader market are supporting the move before using the signal.',
      };
    case 'BEARISH_CONVERGENCE':
      return {
        meaning: 'Several independent inputs are leaning bearish at the same time, increasing the chance that weakness is broad rather than isolated noise.',
        caution: 'Bearish signals can also reflect hedging or a crowded move. Watch for improving breadth or price reclaiming resistance, which would weaken the read.',
      };
    case 'MOST_UNUSUAL_FLOW':
      return {
        meaning: 'This contract showed the largest options-volume anomaly in the scan. A high volume-to-open-interest ratio often points to fresh positioning rather than routine turnover.',
        caution: 'Unusual options flow does not reveal intent by itself. The trade may be a hedge or one leg of a spread, so direction should be confirmed with price action and follow-through.',
      };
    case 'SECTOR_SENTIMENT':
      return {
        meaning: 'This sector ranked strongest in the current sentiment scan. It is a place to look for relative-strength candidates, not a signal that every name in the group is attractive.',
        caution: 'Sector sentiment can reverse quickly around macro data, earnings or commodity moves. Compare individual names on fundamentals and price structure.',
      };
    case 'SECTOR_AVOID':
      return {
        meaning: 'This sector ranked weakest in the current sentiment scan, suggesting elevated headline or relative-strength risk for existing and potential exposure.',
        caution: 'Weak sentiment can become crowded and create sharp rebounds. Treat the label as a risk flag and monitor for improving price breadth before changing exposure.',
      };
    default:
      return {
        meaning: 'The research pipeline found a market relationship worth investigating using the latest available news, sentiment and positioning inputs.',
        caution: 'Use the idea as a starting point. Validate it against price action, liquidity, catalysts and your own risk limits before acting.',
      };
  }
};

function AnalysisIdeaDetails({ idea }: { idea: Any }) {
  const guide = ideaGuide(idea.type);
  return (
    <>
      <DetailSection title="Why it surfaced">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{guide.meaning}</p>
      </DetailSection>
      <DetailSection title="Current read">
        <DetailFacts
          items={[
            { label: 'Assets in focus', value: idea.tickers?.length ? idea.tickers.join(', ') : 'Broad market' },
            { label: 'Suggested bias', value: idea.action || 'Monitor' },
            { label: 'Signal family', value: String(idea.type || 'Analysis idea').replace(/_/g, ' ') },
          ]}
        />
      </DetailSection>
      <DetailSection title="What to validate">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{guide.caution}</p>
      </DetailSection>
    </>
  );
}

const sentimentRead = (score: number | undefined) => {
  if (typeof score !== 'number') return 'The pulse does not include a scored sentiment reading today.';
  if (score >= 7) return 'The score is firmly constructive. Risk appetite is elevated, though crowded positioning can make pullbacks sharper.';
  if (score <= 3) return 'The score is firmly defensive. Capital preservation and tighter risk controls deserve more weight than aggressive entries.';
  return 'The score is mixed to neutral. Selectivity matters because the market is not offering a strong directional tailwind.';
};

function MarketPulseDetails({ pulse, meta }: { pulse: Any; meta: Any }) {
  const levels = Object.entries((pulse.key_levels || {}) as Record<string, Any>);
  return (
    <>
      <DetailSection title="How to read the pulse">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{sentimentRead(pulse.sentiment_score)}</p>
      </DetailSection>
      <DetailSection title="Regime snapshot">
        <DetailFacts
          items={[
            { label: 'Sentiment', value: pulse.sentiment_score != null ? `${pulse.sentiment_score}/10` : undefined },
            { label: 'Market regime', value: meta.market_regime ? String(meta.market_regime).toUpperCase() : undefined },
            { label: 'Model confidence', value: meta.confidence != null ? `${meta.confidence}/10` : undefined },
            { label: 'Sector rotation', value: pulse.sector_rotation },
          ]}
        />
      </DetailSection>
      {!!levels.length && (
        <DetailSection title="Levels being watched">
          <DetailFacts
            items={levels.flatMap(([ticker, level]) => [
              { label: `${ticker} support`, value: level?.support != null ? `$${level.support}` : undefined },
              { label: `${ticker} resistance`, value: level?.resistance != null ? `$${level.resistance}` : undefined },
            ])}
          />
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-tertiary)]">Support and resistance are decision zones, not guaranteed turning points. A decisive break can change the regime read.</p>
        </DetailSection>
      )}
      {(pulse.drivers?.length || pulse.catalysts?.length) && (
        <DetailSection title="Key drivers">
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{(pulse.drivers || pulse.catalysts).join(' · ')}</p>
        </DetailSection>
      )}
    </>
  );
}

const convictionGuide = (conviction?: string) => {
  const level = String(conviction || '').toLowerCase();
  if (level === 'high') return 'High conviction means the inputs align strongly, but position size should still be anchored to the defined downside.';
  if (level === 'low') return 'Low conviction means the setup is early or has conflicting evidence; stronger confirmation is needed before taking meaningful risk.';
  return 'The setup has useful supporting evidence, but still needs confirmation from price action and the stated catalyst.';
};

function OpportunityDetails({ opportunity }: { opportunity: Any }) {
  const isLong = opportunity.direction === 'LONG';
  return (
    <>
      <DetailSection title="Setup interpretation">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
          This is a {isLong ? 'long setup looking for upside continuation or a favorable rebound' : 'short setup looking for downside continuation or a failed rally'}. {convictionGuide(opportunity.conviction)}
        </p>
      </DetailSection>
      <DetailSection title="Trade map">
        <DetailFacts
          items={[
            { label: 'Direction', value: opportunity.direction },
            { label: 'Conviction', value: opportunity.conviction },
            { label: 'Timeframe', value: opportunity.timeframe },
            { label: 'Asset class', value: opportunity.asset_class },
            { label: 'Entry zone', value: opportunity.entry_zone?.length ? `$${opportunity.entry_zone[0]}–$${opportunity.entry_zone[1]}` : opportunity.entry },
            { label: 'Target', value: opportunity.target != null ? `$${opportunity.target}` : undefined },
            { label: 'Stop', value: opportunity.stop != null ? `$${opportunity.stop}` : undefined },
            { label: 'Risk / reward', value: opportunity.risk_reward },
          ]}
        />
      </DetailSection>
      {opportunity.catalyst && (
        <DetailSection title="Catalyst">
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{opportunity.catalyst}</p>
        </DetailSection>
      )}
      <DetailSection title="What would weaken it">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {opportunity.invalidation || opportunity.risk || opportunity.risks?.join?.(' · ') || 'A break beyond the planned risk level, a failed catalyst, or broad-market movement against the setup would reduce confidence.'}
        </p>
      </DetailSection>
    </>
  );
}

const positionActionGuide = (action?: string) => {
  switch (action) {
    case 'ADD': return 'The model sees enough supporting evidence to consider increasing exposure while respecting the stop and total portfolio risk.';
    case 'TRIM': return 'The position still has merit, but the reward-to-risk balance has weakened enough to justify reducing exposure.';
    case 'EXIT': return 'The original thesis or risk boundary is no longer holding, so preserving capital takes priority over waiting for a recovery.';
    case 'HOLD': return 'The original thesis remains intact and no portfolio change is currently required; the listed levels define what to monitor next.';
    default: return 'This is the model’s current portfolio instruction based on the latest thesis, price levels and risk conditions.';
  }
};

function PositionReviewDetails({ position }: { position: Any }) {
  return (
    <>
      <DetailSection title="Action explained">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{positionActionGuide(position.action)}</p>
      </DetailSection>
      <DetailSection title="Position map">
        <DetailFacts
          items={[
            { label: 'Action', value: position.action },
            { label: 'Asset class', value: position.asset_class },
            { label: 'Current price', value: position.current_price != null ? `$${position.current_price}` : undefined },
            { label: 'Average entry', value: position.entry_price != null ? `$${position.entry_price}` : undefined },
            { label: 'Target', value: position.target != null ? `$${position.target}` : undefined },
            { label: 'Stop', value: position.stop != null ? `$${position.stop}` : undefined },
            { label: 'Risk / reward', value: position.risk_reward },
            { label: 'Timeframe', value: position.timeframe },
          ]}
        />
      </DetailSection>
      <DetailSection title="Rationale">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{position.rationale || 'The review did not include an additional rationale today.'}</p>
      </DetailSection>
      <DetailSection title="Decision point">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {position.invalidation || 'Reassess if price violates the stop, the stated rationale no longer applies, or the position grows beyond its intended share of portfolio risk.'}
        </p>
      </DetailSection>
    </>
  );
}

const riskGuide = (severity?: string) => {
  if (severity === 'high') return 'High severity calls for prompt review because the condition could materially affect the thesis or portfolio drawdown.';
  if (severity === 'medium') return 'Medium severity deserves active monitoring and a pre-planned response if the condition worsens.';
  return 'Low severity is an early warning. No immediate change may be needed, but the trigger should stay on the watchlist.';
};

function RiskAlertDetails({ alert }: { alert: Any }) {
  return (
    <>
      <DetailSection title="Why it matters">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{riskGuide(alert.severity)}</p>
      </DetailSection>
      <DetailSection title="Exposure map">
        <DetailFacts
          items={[
            { label: 'Severity', value: String(alert.severity || 'Unrated').toUpperCase() },
            { label: 'Affected positions', value: alert.affected_positions?.length ? alert.affected_positions.join(', ') : 'Portfolio-wide or unassigned' },
            { label: 'Trigger', value: alert.trigger },
            { label: 'Time horizon', value: alert.timeframe || alert.time_horizon },
          ]}
        />
      </DetailSection>
      <DetailSection title="Suggested response">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {alert.mitigation || alert.action || alert.response || 'Review the affected exposure, confirm that stops and position sizes are still appropriate, and avoid adding risk until the alert is resolved or disproven.'}
        </p>
      </DetailSection>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                              */
/* ------------------------------------------------------------------ */

function OverviewTab() {
  const latest = usePublic<Any>('latest', '/data/latest.json');
  const d = latest.data;

  return (
    <div className="space-y-4">
      <Updated iso={d?.generated_at} />
      <AudioBriefing />
      {d?.narrative?.summary_paragraph && (
        <Card>
          <div
            className="narrative text-sm leading-relaxed text-[var(--color-text-secondary)] space-y-3"
            dangerouslySetInnerHTML={{ __html: renderNarrative(d.narrative.summary_paragraph) }}
          />
        </Card>
      )}
      {(d?.central_banks?.fed || d?.central_banks?.boc) && (
        <Grid2>
          {(['fed', 'boc'] as const).map((bank) => {
            const text = d?.central_banks?.[bank];
            if (!text) return null;
            return (
              <Card key={bank} title={bank === 'fed' ? 'Federal Reserve' : 'Bank of Canada'}>
                <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{String(text).substring(0, 500)}</p>
              </Card>
            );
          })}
        </Grid2>
      )}
      {(!!d?.insider_trades?.length || !!d?.congress?.recent_trades?.length) && (
        <Grid2>
          {!!d?.insider_trades?.length && (
            <Card title="Insider Trades — SEC Form 4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {d.insider_trades.slice(0, 10).map((i: Any, idx: number) => (
                      <tr key={idx} className="border-t first:border-t-0" style={{ borderColor: 'var(--color-border-subtle)' }}>
                        <td className="py-2 font-semibold text-[var(--color-text-primary)]" data-numeric>{i.ticker}</td>
                        <td className="py-2">
                          <Badge tone={i.type === 'Buy' ? 'bull' : i.type === 'Sell' ? 'bear' : 'caution'}>{i.type}</Badge>
                        </td>
                        <td className="py-2 text-[var(--color-text-secondary)] truncate max-w-[120px]">{i.insider}</td>
                        <td className="py-2 text-right text-[var(--color-text-secondary)]" data-numeric>
                          {i.value ? `$${Number(i.value).toLocaleString()}` : (i.shares ? `${Number(i.shares).toLocaleString()} sh` : '—')}
                        </td>
                        <td className="py-2 text-right text-[var(--color-text-tertiary)] text-xs" data-numeric>{i.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] text-[var(--color-text-tertiary)]">Source: SEC EDGAR Form 4 (public domain). Open-market buys/sells prioritized.</p>
            </Card>
          )}
          {!!d?.congress?.recent_trades?.length && (
            <Card title="Congressional Trades — House Disclosures">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {d.congress.recent_trades.slice(0, 10).map((c: Any, idx: number) => (
                      <tr key={idx} className="border-t first:border-t-0" style={{ borderColor: 'var(--color-border-subtle)' }}>
                        <td className="py-2 font-semibold text-[var(--color-text-primary)]" data-numeric>{c.ticker}</td>
                        <td className="py-2">
                          <Badge tone={c.action === 'Buy' ? 'bull' : c.action === 'Sell' ? 'bear' : 'caution'}>{c.action}</Badge>
                        </td>
                        <td className="py-2 text-[var(--color-text-secondary)] truncate max-w-[130px]">{c.politician}</td>
                        <td className="py-2 text-right text-[var(--color-text-secondary)] text-xs">{c.amount_range}</td>
                        <td className="py-2 text-right text-[var(--color-text-tertiary)] text-xs" data-numeric>{c.transaction_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] text-[var(--color-text-tertiary)]">Source: U.S. House Clerk financial disclosures (public domain).</p>
            </Card>
          )}
        </Grid2>
      )}
      {!latest.isLoading && !d && <Empty>Market data not available.</Empty>}
    </div>
  );
}

function NewsTab() {
  const latest = usePublic<Any>('latest', '/data/latest.json');
  const analysis = usePublic<Any>('analysis', '/data/analysis.json');
  const webNews = useGated<Any>('web-news', 'web-news.json');

  const d = latest.data;
  const wn = webNews.data;
  const gateKind = webNews.error instanceof GateError ? webNews.error.kind : null;

  return (
    <div className="space-y-4">
      {wn?.articles?.length ? (
        <>
          <Updated iso={wn._fetched_at} />
          {!!wn.topics?.length && (
            <Card title="Trending Topics">
              <div className="flex flex-wrap gap-1.5">
                {wn.topics.slice(0, 15).map((t: Any, i: number) => {
                  const label = typeof t === 'string' ? t : t?.name || t?.label || t?.topic || '';
                  return label ? <Badge key={i} tone="caution">{label}</Badge> : null;
                })}
              </div>
            </Card>
          )}
          <Card title="Latest News">
            <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
              {wn.articles.map((a: Any, i: number) => (
                <div key={i} className="py-2.5 first:pt-0 last:pb-0">
                  <ExtLink href={a.url || '#'}>{a.title}</ExtLink>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {[a.source, fmtTs(a.published)].filter(Boolean).join(' · ')}
                  </p>
                  {a.snippet && (
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-text-secondary)] line-clamp-2">{a.snippet}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : gateKind && gateKind !== 'unavailable' ? (
        <GateCard kind={gateKind} need={webNews.error instanceof GateError ? webNews.error.need : undefined} feature="The live news wire" />
      ) : null}

      <Grid2>
        {!!d?.geopolitical?.length && (
          <Card title="Geopolitical Risks">
            <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
              {d.geopolitical.slice(0, 12).map((g: Any, i: number) => {
                const url = g.url || `https://news.google.com/search?q=${encodeURIComponent(g.title || '')}`;
                return (
                  <div key={i} className="py-2.5 first:pt-0 last:pb-0">
                    <ExtLink href={url}>{g.title}</ExtLink>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {g.source}
                      {!g.url && ' · via news search'}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {!!d?.market_news?.headlines?.length && (
          <Card title="Market News">
            <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
              {d.market_news.headlines.map((n: Any, i: number) => (
                <div key={i} className="py-2.5 first:pt-0 last:pb-0">
                  <ExtLink href={n.url || '#'}>{n.title}</ExtLink>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {[n.source, n.category].filter(Boolean).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {!!analysis.data?.market_overview?.top_headlines?.length && (
          <Card title="Seeking Alpha Top Stories">
            <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
              {analysis.data.market_overview.top_headlines.slice(0, 10).map((h: Any, i: number) => {
                const title = typeof h === 'string' ? h : h?.title || '';
                const url = typeof h === 'object' ? h?.url || '' : '';
                return (
                  <div key={i} className="py-2 first:pt-0 last:pb-0 text-sm">
                    {url ? <ExtLink href={url}>{title}</ExtLink> : <span className="text-[var(--color-text-secondary)]">{title}</span>}
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </Grid2>

      {!!d?.market_news?.analyst_ratings?.length && (
        <Card title="Analyst Ratings">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                  <th className="py-1.5 text-left">Ticker</th>
                  <th className="py-1.5 text-right">Strong Buy</th>
                  <th className="py-1.5 text-right">Buy</th>
                  <th className="py-1.5 text-right">Hold</th>
                  <th className="py-1.5 text-right">Sell</th>
                  <th className="py-1.5 text-right">Strong Sell</th>
                </tr>
              </thead>
              <tbody>
                {d.market_news.analyst_ratings.map((a: Any, i: number) => (
                  <tr key={i} className="border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    <td className="py-2 font-semibold text-[var(--color-text-primary)]" data-numeric>{a.ticker}</td>
                    <td className="py-2 text-right" data-numeric style={{ color: 'var(--color-bull)' }}>{a.strongBuy || 0}</td>
                    <td className="py-2 text-right" data-numeric style={{ color: 'var(--color-bull)' }}>{a.buy || 0}</td>
                    <td className="py-2 text-right" data-numeric style={{ color: 'var(--color-caution)' }}>{a.hold || 0}</td>
                    <td className="py-2 text-right" data-numeric style={{ color: 'var(--color-bear)' }}>{a.sell || 0}</td>
                    <td className="py-2 text-right" data-numeric style={{ color: 'var(--color-bear)' }}>{a.strongSell || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function SentimentTab() {
  const reddit = usePublic<Any>('reddit', '/data/reddit-sentiment.json');
  const d = reddit.data;
  if (reddit.isLoading) return <Empty>Loading…</Empty>;
  if (!d) return <Empty>Reddit sentiment data not available.</Empty>;

  return (
    <div className="space-y-4">
      <Updated iso={d._generated_at} />
      <Grid2>
        {([['wsb', 'r/wallstreetbets'], ['stocks', 'r/stocks']] as const).map(([key, label]) => {
          const src = d[key];
          if (!src) return null;
          const bearish = String(src.sentiment_summary || '').includes('BEARISH');
          return (
            <Card key={key} title={label}>
            <div className="mb-2">
              <Badge tone={bearish ? 'bear' : 'bull'}>{bearish ? 'Bearish' : 'Bullish'}</Badge>
            </div>
            {src.sentiment_summary && (
              <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {String(src.sentiment_summary).substring(0, 400)}
              </p>
            )}
            {!!src.top_tickers?.length && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {src.top_tickers.map((t: Any) => (
                  <Badge key={t.ticker} tone="bull">
                    {t.ticker} ({t.count})
                  </Badge>
                ))}
              </div>
            )}
            {!!src.hot_posts?.length && (
              <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
                {src.hot_posts.slice(0, 8).map((p: Any, i: number) => (
                  <div key={i} className="py-2 first:pt-0 last:pb-0 text-sm">
                    <ExtLink href={p.url || '#'}>{String(p.title || '').substring(0, 100)}</ExtLink>
                    <p className="text-xs text-[var(--color-text-tertiary)]" data-numeric>
                      ▲{p.ups}
                      {p.tickers?.length ? ` · ${p.tickers.join(', ')}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
            </Card>
          );
        })}
      </Grid2>
    </div>
  );
}

function IdeasTab() {
  const [detail, setDetail] = useState<DetailView | null>(null);
  const analysis = usePublic<Any>('analysis', '/data/analysis.json');
  const d = analysis.data;
  if (analysis.isLoading) return <Empty>Loading…</Empty>;
  if (!d) return <Empty>Analysis data not available.</Empty>;

  return (
    <div className="space-y-4">
      <Updated iso={d.generated_at} />
      {(!!d.analysis_ideas?.length || !!d.market_overview?.top_headlines?.length) && (
        <Grid2>
          {!!d.analysis_ideas?.length && (
            <Card title="Analysis Ideas">
              <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
                {d.analysis_ideas.map((idea: Any, i: number) => (
                  <DetailTrigger
                    key={i}
                    label={`Open analysis details for ${(idea.tickers || []).join(', ') || String(idea.type || 'idea')}`}
                    className="py-3 first:pt-0 last:pb-0"
                    onClick={() => setDetail({
                      eyebrow: 'Analysis idea',
                      title: `${(idea.tickers || []).join(', ') || 'Market'} · ${String(idea.type || 'Signal').replace(/_/g, ' ')}`,
                      summary: idea.signal,
                      badge: { tone: ideaTone(idea.type), label: String(idea.type || 'Analysis idea').replace(/_/g, ' ') },
                      body: <AnalysisIdeaDetails idea={idea} />,
                    })}
                  >
                    <Badge tone={ideaTone(idea.type)}>{String(idea.type || '').replace(/_/g, ' ')}</Badge>
                    <span className="mt-1.5 block text-sm font-semibold text-[var(--color-text-primary)]" data-numeric>
                      {(idea.tickers || []).join(', ')}
                    </span>
                    <span className="block text-sm text-[var(--color-text-secondary)]">{idea.signal}</span>
                    {idea.action && <span className="block text-sm" style={{ color: 'var(--color-accent)' }}>{idea.action}</span>}
                  </DetailTrigger>
                ))}
              </div>
            </Card>
          )}
          {!!d.market_overview?.top_headlines?.length && (
            <Card title="Seeking Alpha Top Stories">
              <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
                {d.market_overview.top_headlines.slice(0, 10).map((h: Any, i: number) => {
                  const title = typeof h === 'string' ? h : h?.title || '';
                  const url = typeof h === 'object' ? h?.url || '' : '';
                  return (
                    <div key={i} className="py-2 first:pt-0 last:pb-0 text-sm">
                      {url ? <ExtLink href={url}>{title}</ExtLink> : <span className="text-[var(--color-text-secondary)]">{title}</span>}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </Grid2>
      )}
      <ResearchDetailDialog detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function MgAnalysisTab() {
  const [detail, setDetail] = useState<DetailView | null>(null);
  const q = useGated<Any>('mg-analysis', 'morning_analysis.json');

  return (
    <GatedPane q={q} feature="MapleGamma Analysis">
      {(d) => {
        if (!d?.meta?.generated_at) return <Empty>No analysis available yet — the morning pipeline generates it on weekdays.</Empty>;
        const meta = d.meta;
        const positions = d.held_position_review || d.position_review || [];
        return (
          <div className="space-y-4">
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Simulated portfolio — for educational purposes only, not a recommendation.
            </p>
            <Updated iso={meta.generated_at} />
            <div className="flex items-center gap-3">
              <Badge tone={meta.market_regime === 'risk-on' ? 'bull' : meta.market_regime === 'risk-off' ? 'bear' : 'caution'}>
                {(meta.market_regime || '?').toUpperCase()}
              </Badge>
              <span className="text-xs text-[var(--color-text-tertiary)]" data-numeric>
                Confidence: {meta.confidence}/10{meta.model ? ` · ${meta.model}` : ''}
              </span>
            </div>
            <Grid2>
            {d.market_pulse && (
              <Card title="Market Pulse">
                <DetailTrigger
                  label="Open Market Pulse analysis details"
                  className="py-1"
                  onClick={() => setDetail({
                    eyebrow: 'MapleGamma analysis',
                    title: 'Market Pulse',
                    summary: d.market_pulse.one_liner,
                    badge: {
                      tone: d.market_pulse.sentiment_score >= 7 ? 'bull' : d.market_pulse.sentiment_score <= 3 ? 'bear' : 'caution',
                      label: `Sentiment ${d.market_pulse.sentiment_score ?? '—'}/10`,
                    },
                    body: <MarketPulseDetails pulse={d.market_pulse} meta={meta} />,
                  })}
                >
                  <span className="block text-sm leading-relaxed text-[var(--color-text-primary)]">{d.market_pulse.one_liner}</span>
                  <span className="mt-2 block text-xs text-[var(--color-text-tertiary)]" data-numeric>
                    Sentiment: {d.market_pulse.sentiment_score}/10
                  </span>
                  {d.market_pulse.sector_rotation && (
                    <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{d.market_pulse.sector_rotation}</span>
                  )}
                  {d.market_pulse.key_levels?.SPY && (
                    <span className="mt-1 block text-xs text-[var(--color-text-secondary)]" data-numeric>
                      SPY support: ${d.market_pulse.key_levels.SPY.support} / resistance: ${d.market_pulse.key_levels.SPY.resistance}
                    </span>
                  )}
                </DetailTrigger>
              </Card>
            )}
            <Card title="Position Review">
              {positions.length ? (
                <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  {positions.map((p: Any, i: number) => (
                    <DetailTrigger
                      key={i}
                      label={`Open position review details for ${p.ticker || 'position'}`}
                      className="py-2.5 first:pt-0 last:pb-0"
                      onClick={() => setDetail({
                        eyebrow: 'Position review',
                        title: `${p.ticker || 'Position'} · ${p.action || 'Review'}`,
                        summary: p.rationale,
                        badge: {
                          tone: p.action === 'ADD' ? 'bull' : p.action === 'TRIM' || p.action === 'EXIT' ? 'bear' : 'caution',
                          label: p.action || 'Review',
                        },
                        body: <PositionReviewDetails position={p} />,
                      })}
                    >
                      <span className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge tone={p.action === 'ADD' ? 'bull' : p.action === 'TRIM' || p.action === 'EXIT' ? 'bear' : 'caution'}>{p.action}</Badge>
                        <span className="font-semibold text-[var(--color-text-primary)]" data-numeric>{p.ticker}</span>
                        {p.asset_class && <Badge tone="caution">{String(p.asset_class).toUpperCase()}</Badge>}
                        <span className="text-xs text-[var(--color-text-tertiary)]" data-numeric>
                          {[p.target && `Target $${p.target}`, p.stop && `Stop $${p.stop}`, p.risk_reward && `R/R ${p.risk_reward}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      {p.rationale && <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{p.rationale}</span>}
                    </DetailTrigger>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-tertiary)]">No open positions to review.</p>
              )}
            </Card>
            </Grid2>
            <Grid2>
            {!!d.opportunities?.length && (
              <Card title="Opportunities">
                <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  {d.opportunities.map((o: Any, i: number) => (
                    <DetailTrigger
                      key={i}
                      label={`Open opportunity details for ${o.ticker || 'opportunity'}`}
                      className="py-2.5 first:pt-0 last:pb-0"
                      onClick={() => setDetail({
                        eyebrow: 'Opportunity',
                        title: `${o.ticker || 'Market'} · ${o.direction || 'Setup'}`,
                        summary: o.thesis,
                        badge: { tone: o.direction === 'LONG' ? 'bull' : 'bear', label: o.direction || 'Setup' },
                        body: <OpportunityDetails opportunity={o} />,
                      })}
                    >
                      <span className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge tone={o.direction === 'LONG' ? 'bull' : 'bear'}>{o.direction}</Badge>
                        <span className="font-semibold text-[var(--color-text-primary)]" data-numeric>{o.ticker}</span>
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          {[o.conviction && `${o.conviction} conviction`, o.timeframe].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      {o.thesis && <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{o.thesis}</span>}
                      {!!o.entry_zone?.length && (
                        <span className="mt-0.5 block text-xs text-[var(--color-text-tertiary)]" data-numeric>
                          Entry zone: ${o.entry_zone[0]}–${o.entry_zone[1]}
                          {o.catalyst ? ` · ${o.catalyst}` : ''}
                        </span>
                      )}
                    </DetailTrigger>
                  ))}
                </div>
              </Card>
            )}
            {!!d.risk_alerts?.length && (
              <Card title="Risk Alerts">
                <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  {d.risk_alerts.map((r: Any, i: number) => (
                    <DetailTrigger
                      key={i}
                      label={`Open risk alert details: ${r.alert || String(r.severity || 'risk')}`}
                      className="py-2.5 text-sm first:pt-0 last:pb-0"
                      onClick={() => setDetail({
                        eyebrow: 'Risk alert',
                        title: r.alert || 'Portfolio risk',
                        badge: {
                          tone: r.severity === 'high' ? 'bear' : r.severity === 'medium' ? 'caution' : 'bull',
                          label: `${String(r.severity || 'Unrated').toUpperCase()} severity`,
                        },
                        body: <RiskAlertDetails alert={r} />,
                      })}
                    >
                      <Badge tone={r.severity === 'high' ? 'bear' : r.severity === 'medium' ? 'caution' : 'bull'}>
                        {String(r.severity || '').toUpperCase()}
                      </Badge>{' '}
                      <span className="text-[var(--color-text-secondary)]">{r.alert}</span>
                      {!!r.affected_positions?.length && (
                        <span className="block text-xs text-[var(--color-text-tertiary)]" data-numeric>Affects: {r.affected_positions.join(', ')}</span>
                      )}
                    </DetailTrigger>
                  ))}
                </div>
              </Card>
            )}
            </Grid2>
            {!!d.portfolio_actions?.immediate?.length && (
              <Card title="Actions">
                {d.portfolio_actions.immediate.map((a: string, i: number) => (
                  <p key={i} className="py-1 text-sm text-[var(--color-text-secondary)]">⚡ {a}</p>
                ))}
                {!!d.portfolio_actions.watchlist?.length && (
                  <p className="mt-2 text-xs text-[var(--color-text-secondary)]" data-numeric>
                    Watchlist: {d.portfolio_actions.watchlist.join(', ')}
                  </p>
                )}
                {!!d.portfolio_actions.avoid?.length && (
                  <p className="text-xs text-[var(--color-text-tertiary)]" data-numeric>Avoid: {d.portfolio_actions.avoid.join(', ')}</p>
                )}
              </Card>
            )}
            {meta.stale && (
              <p className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: 'var(--color-bear-soft)', color: 'var(--color-bear)' }}>
                ⚠ Analysis is stale: {meta.stale_reason || 'No recent data'}
              </p>
            )}
            <ResearchDetailDialog detail={detail} onClose={() => setDetail(null)} />
          </div>
        );
      }}
    </GatedPane>
  );
}

function BacktestTab() {
  const q = useGated<Any>('walk-forward', 'walk_forward_v2.json');

  return (
    <GatedPane q={q} feature="Backtest research" need="pro">
      {(wf) => (
        <div className="space-y-4">
          <Card title="Research-Backed Backtest Validation">
            <Updated iso={wf?.generated_at} />
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              <strong className="text-[var(--color-text-primary)]">López de Prado — The False Strategy Theorem:</strong>{' '}
              run 100 backtests on random data and 5–10 will show positive returns by pure chance. We apply a ~30%
              Sharpe degradation factor — an in-sample Sharpe of 2.22 is expected to live-trade around 1.55.
              {wf?.summary?.mean_reversion && (
                <>
                  {' '}Walk-forward confirms: OOS Sharpe of{' '}
                  {typeof wf.summary.mean_reversion.avg_oos_sharpe === 'number' ? wf.summary.mean_reversion.avg_oos_sharpe.toFixed(2) : '?'} vs IS{' '}
                  {typeof wf.summary.mean_reversion.avg_is_sharpe === 'number' ? wf.summary.mean_reversion.avg_is_sharpe.toFixed(2) : '?'} for mean reversion.
                </>
              )}
            </p>
          </Card>
          {wf?.summary && (
            <Card title="Walk-Forward Results">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                      <th className="py-1.5 text-left">Strategy</th>
                      <th className="py-1.5 text-right">IS Sharpe</th>
                      <th className="py-1.5 text-right">OOS Sharpe</th>
                      <th className="py-1.5 text-right">Degradation</th>
                      <th className="py-1.5 text-right">OOS Trades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(wf.summary as Record<string, Any>).map(([key, s]) =>
                      s?.avg_is_sharpe != null ? (
                        <tr key={key} className="border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                          <td className="py-2 font-semibold text-[var(--color-text-primary)]">{key}</td>
                          <td className="py-2 text-right" data-numeric>{s.avg_is_sharpe.toFixed(2)}</td>
                          <td className="py-2 text-right" data-numeric>{s.avg_oos_sharpe?.toFixed?.(2) ?? '—'}</td>
                          <td className="py-2 text-right" data-numeric style={{ color: (s.avg_degradation_pct ?? 0) >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}>
                            {s.avg_degradation_pct != null ? `${s.avg_degradation_pct.toFixed(1)}%` : '—'}
                          </td>
                          <td className="py-2 text-right" data-numeric>{s.total_oos_trades ?? '—'}</td>
                        </tr>
                      ) : null,
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </GatedPane>
  );
}

function MarketsTab() {
  const q = useGated<Any>('polymarket', 'polymarket_sentiment.json');

  return (
    <GatedPane q={q} feature="Prediction markets">
      {(d) => {
        if (!d?.markets?.length) return <Empty>Prediction market data not available.</Empty>;
        const sorted = [...d.markets].sort((a: Any, b: Any) => (b.volume || 0) - (a.volume || 0)).slice(0, 30);
        const fmtVol = (v: number) =>
          v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${(v || 0).toFixed(0)}`;
        return (
          <div className="space-y-3">
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Source: {d.source || 'Polymarket'}
              {d.fetched_at ? ` · Updated ${fmtTs(d.fetched_at)}` : ''}
            </p>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {sorted.map((m: Any, i: number) => (
              <div
                key={i}
                className="rounded-[var(--radius-tile)] border p-4"
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  borderColor: 'var(--color-border-subtle)',
                  opacity: m.closed ? 0.6 : 1,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{m.question}</p>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--color-text-tertiary)]" data-numeric>
                    {fmtVol(m.volume || 0)}
                    {m.closed && <Badge tone="bear">Closed</Badge>}
                  </span>
                </div>
                {!!m.outcomes?.length && (
                  <div className="mt-2.5 space-y-1.5">
                    {m.outcomes.map((o: Any, j: number) => {
                      const pct = parseFloat(o.price) * 100;
                      const color = pct >= 50 ? 'var(--color-bull)' : 'var(--color-bear)';
                      return (
                        <div key={j} className="flex items-center gap-3 text-xs">
                          <span className="min-w-[64px] font-medium text-[var(--color-text-secondary)]">{o.name}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--color-bg-elevated)' }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }} />
                          </div>
                          <span className="min-w-[44px] text-right" data-numeric style={{ color }}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            </div>
            {d.markets.length > 30 && (
              <p className="text-center text-xs text-[var(--color-text-tertiary)]" data-numeric>
                Showing top 30 of {d.markets.length} markets by volume
              </p>
            )}
          </div>
        );
      }}
    </GatedPane>
  );
}

function EarningsTab() {
  const q = useGated<Any>('earnings', 'earnings.json');
  const [today, setToday] = useState('');
  const [transcriptSearch, setTranscriptSearch] = useState('');
  useEffect(() => {
    setToday(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date()));
  }, []);

  return (
    <GatedPane q={q} feature="Earnings research">
      {(d) => {
        if (!d?.calendar?.length)
          return <Empty>No earnings data generated yet — the pipeline runs weekday mornings.</Empty>;
        const upcoming = d.calendar.filter((r: Any) => r.date >= today).sort((a: Any, b: Any) => a.date.localeCompare(b.date));
        const recent = d.calendar.filter((r: Any) => r.date < today).slice(0, 20);
        const search = transcriptSearch.trim().toLowerCase();
        const transcripts = (d.transcripts || []).filter((tr: Any) =>
          !search || [tr.ticker, tr.quarter, tr.summary, tr.content].some((value) => String(value || '').toLowerCase().includes(search)),
        );

        const Table = ({ rows, title, showActual }: { rows: Any[]; title: string; showActual: boolean }) =>
          rows.length ? (
            <Card title={title}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                      <th className="py-1.5 text-left">Date</th>
                      <th className="py-1.5 text-left">Ticker</th>
                      <th className="py-1.5 text-right">EPS Est.</th>
                      {showActual && (
                        <>
                          <th className="py-1.5 text-right">EPS Actual</th>
                          <th className="py-1.5 text-right">Beat?</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 25).map((r: Any, i: number) => {
                      const beat = r.epsActual != null && r.epsEstimate != null ? r.epsActual >= r.epsEstimate : null;
                      return (
                        <tr key={i} className="border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                          <td className="py-2 text-[var(--color-text-secondary)]" data-numeric>{r.date}</td>
                          <td className="py-2 font-semibold text-[var(--color-text-primary)]" data-numeric>{r.ticker}</td>
                          <td className="py-2 text-right" data-numeric>{r.epsEstimate != null ? `$${Number(r.epsEstimate).toFixed(2)}` : '—'}</td>
                          {showActual && (
                            <>
                              <td className="py-2 text-right" data-numeric>{r.epsActual != null ? `$${Number(r.epsActual).toFixed(2)}` : '—'}</td>
                              <td className="py-2 text-right">
                                {beat == null ? '—' : <Badge tone={beat ? 'bull' : 'bear'}>{beat ? 'Beat' : 'Miss'}</Badge>}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null;

        return (
          <div className="space-y-4">
            {d.generated_at && <Updated iso={d.generated_at} />}
            <Table rows={upcoming} title="Upcoming Earnings (watchlist)" showActual={false} />
            <Table rows={recent} title="Recent Results" showActual />
            {d.transcripts?.length ? (
              <>
                <input
                  type="search"
                  value={transcriptSearch}
                  onChange={(event) => setTranscriptSearch(event.target.value)}
                  placeholder="Search transcripts by ticker, quarter, or phrase…"
                  className="w-full rounded-lg border bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                  style={{ borderColor: 'var(--color-border-subtle)' }}
                />
                {transcripts.length ? (
                  <Grid2>
                    {transcripts.slice(0, 20).map((tr: Any, i: number) => (
                      <Card key={i} title={`${tr.ticker || ''} — ${tr.quarter || ''}`}>
                        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                          {String(tr.summary || tr.content || '').substring(0, 600)}…
                        </p>
                      </Card>
                    ))}
                  </Grid2>
                ) : <Empty>No transcripts match “{transcriptSearch}”.</Empty>}
              </>
            ) : (
              <p className="text-xs text-[var(--color-text-tertiary)]">Full call transcripts require an FMP API key (not configured).</p>
            )}
          </div>
        );
      }}
    </GatedPane>
  );
}

function SecTab() {
  const q = useGated<Any>('sec', 'sec_filings.json');

  return (
    <GatedPane q={q} feature="SEC filings">
      {(d) =>
        d?.filings?.length ? (
          <Card title="Recent SEC Filings">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                    <th className="py-1.5 text-left">Date</th>
                    <th className="py-1.5 text-left">Ticker</th>
                    <th className="py-1.5 text-left">Form</th>
                    <th className="py-1.5 text-right">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {d.filings.slice(0, 20).map((f: Any, i: number) => (
                    <tr key={i} className="border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                      <td className="py-2 text-[var(--color-text-secondary)]" data-numeric>{f.date}</td>
                      <td className="py-2 font-semibold text-[var(--color-text-primary)]" data-numeric>{f.ticker}</td>
                      <td className="py-2 text-[var(--color-text-secondary)]">{f.form}</td>
                      <td className="py-2 text-right">
                        <ExtLink href={f.url || '#'}>EDGAR ↗</ExtLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Empty>No filings data generated yet — the pipeline runs weekday mornings.</Empty>
        )
      }
    </GatedPane>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

const TABS = [
  { key: 'overview', label: 'Overview', pane: OverviewTab },
  { key: 'news', label: 'News', pane: NewsTab },
  { key: 'sentiment', label: 'Sentiment', pane: SentimentTab },
  { key: 'ideas', label: 'Ideas', pane: IdeasTab },
  { key: 'mg', label: 'MapleGamma Analysis', pane: MgAnalysisTab },
  { key: 'backtest', label: 'Backtest', pane: BacktestTab },
  { key: 'markets', label: 'Markets', pane: MarketsTab },
  { key: 'earnings', label: 'Earnings', pane: EarningsTab },
  { key: 'sec', label: 'SEC Filings', pane: SecTab },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function ResearchClient() {
  const [tab, setTab] = useState<TabKey>('overview');
  const Active = TABS.find((t) => t.key === tab)!.pane;

  return (
    <div className="space-y-4">
      <div
        className="relative overflow-hidden rounded-[var(--radius-tile)] border p-6"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
      >
        <span aria-hidden="true" className="glow-orb -top-24 -right-8" />
        <h1 className="relative z-10 font-display text-3xl text-[var(--color-text-primary)]">
          Research <em className="italic" style={{ color: 'var(--color-accent)' }}>Desk</em>
        </h1>
        <p className="relative z-10 mt-2 text-sm text-[var(--color-text-secondary)]">
          The daily narrative, news wire, crowd sentiment, ideas and filings — one reading room.
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-1 rounded-full border p-1" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface)' }} role="tablist" aria-label="Research sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition"
              style={
                tab === t.key
                  ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }
                  : { color: 'var(--color-text-secondary)' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <Active />
    </div>
  );
}
