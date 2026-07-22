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
import { InfoTip, PlainLabel } from '@/components/primitives';
import type { GlossaryTerm } from '@/lib/glossary';
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
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'long', timeStyle: 'short' })} ET`;
};

// `title` is a ReactNode rather than a string so a card header can carry a
// <PlainLabel> caption for the jargon it names, without a second wrapper.
//
// Do NOT put an <InfoTip> in a card title. This root keeps `overflow-hidden`
// (it clips children to the rounded corners and stops wide tables widening the
// grid column), and InfoTip renders its tooltip *upward* — from a header at the
// very top of the card that lands outside the box and is clipped away, so the
// tooltip is invisible and the click does nothing. Card headers therefore show
// the real term and explain it with the always-on <PlainLabel> caption plus a
// note in the card body.
function Card({ title, children, className = '' }: { title?: React.ReactNode; children: React.ReactNode; className?: string }) {
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

/** `term` optionally adds the glossary's plain-English caption under a fact's
 *  label. The label itself stays a plain string so it can keep serving as the
 *  React key — and it keeps the real term, with the caption explaining it.
 *
 *  Caption rather than <InfoTip> on purpose: this grid needs `overflow-hidden`
 *  to clip its cells to the rounded corners, and an InfoTip opens its tooltip
 *  upward, so a tooltip on a label in the top row would be clipped away and the
 *  click would appear to do nothing. An always-on caption cannot be clipped. */
function DetailFacts({ items }: { items: { label: string; value: React.ReactNode; term?: GlossaryTerm }[] }) {
  const visible = items.filter((item) => item.value !== undefined && item.value !== null && item.value !== '');
  if (!visible.length) return null;
  return (
    <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border sm:grid-cols-2" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-border-subtle)' }}>
      {visible.map((item) => (
        <div key={item.label} className="min-w-0 p-3" style={{ backgroundColor: 'var(--color-bg-elevated)' }}>
          <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            {item.label}
            {item.term && <PlainLabel term={item.term} className="mt-0.5" />}
          </dt>
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
          {/* Only the date carries `data-numeric` (it switches on the monospace
              face). Setting the whole line in mono made this long caption far
              wider than the flex row, and it wrapped to a column on mobile. */}
          <p className="text-xs text-[var(--color-text-tertiary)]">
            <span data-numeric>{selected}</span> · top headlines, read aloud
          </p>
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

/** meta.market_regime is free text, so only the two values we can define get a
 *  tooltip — anything else is left undecorated rather than mislabelled. */
const regimeTerm = (regime?: string): GlossaryTerm | undefined =>
  regime === 'risk-on' ? 'risk_on' : regime === 'risk-off' ? 'risk_off' : undefined;

/** The raw pipeline codes on analysis_ideas[].type are internal category names.
 *  These are the everyday-English versions shown to readers; the original code
 *  is still displayed in the detail dialog so nothing is hidden. */
const IDEA_TYPE_LABELS: Record<string, string> = {
  MOST_UNUSUAL_FLOW: 'Unusual options activity',
  BULLISH_CONVERGENCE: 'Several signals agree — upward',
  BEARISH_CONVERGENCE: 'Several signals agree — downward',
  SECTOR_SENTIMENT: 'Best-rated industry group',
  SECTOR_AVOID: 'Worst-rated industry group',
};

const ideaTypeLabel = (type?: string) =>
  IDEA_TYPE_LABELS[String(type || '')] || String(type || 'Analysis idea').replace(/_/g, ' ');

const ideaGuide = (type?: string) => {
  switch (type) {
    case 'BULLISH_CONVERGENCE':
      return {
        meaning: 'Several separate measures are pointing upward at the same time. When independent inputs agree, the reading carries more weight than any one of them on its own.',
        caution: 'Agreement is not certainty — it only means the inputs happen to line up. Check that the price is actually moving that way, and that the wider market is too, before leaning on it.',
      };
    case 'BEARISH_CONVERGENCE':
      return {
        meaning: 'Several separate measures are pointing downward at the same time, which makes it more likely the weakness is widespread rather than one-off noise.',
        caution: 'Downward signals can also come from investors simply buying protection, or from too many people already betting the same way. If more stocks start rising again, or the price climbs back above a level it had been stuck under, the reading weakens.',
      };
    case 'MOST_UNUSUAL_FLOW':
      return {
        meaning: 'This options contract had the most unusual trading activity in the latest scan: far more contracts changed hands than the number left open from previous days, which often means traders are opening brand-new bets rather than closing old ones.',
        caution: 'Heavy options trading does not tell you what the traders intend. It may be insurance against a fall, or one piece of a larger multi-contract position. Check whether the share price actually follows before reading anything into it.',
      };
    case 'SECTOR_SENTIMENT':
      return {
        meaning: 'This group of industries scored best in the latest sentiment scan. It is a place to start looking, not a sign that every company in the group is worth buying.',
        caution: 'Sentiment towards an industry can turn quickly on economic data, profit reports or commodity prices. Judge individual companies on their own finances and their own price history.',
      };
    case 'SECTOR_AVOID':
      return {
        meaning: 'This group of industries scored worst in the latest sentiment scan, which suggests more bad-news risk than usual for money already invested there, or about to be.',
        caution: 'When almost everyone is negative, prices can snap back sharply. Treat this as a warning flag rather than an instruction, and watch for more of the group’s companies starting to rise again.',
      };
    default:
      return {
        meaning: 'The pipeline found a pattern worth a closer look, based on the latest news, sentiment and options activity it had available.',
        caution: 'Treat it as a starting point. Check it against what the price is actually doing, how easily the shares trade, what events are coming up, and how much you are willing to lose.',
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
            // Sector rows put an industry-group name in `tickers`, not a stock
            // symbol, so the label has to cover both.
            { label: 'Stocks or industries in focus', value: idea.tickers?.length ? idea.tickers.join(', ') : 'The market as a whole' },
            { label: 'Takeaway', value: idea.action || 'Monitor' },
            // No glossary tooltip here: `signal_family` describes trend-following
            // vs snap-back families, which is not how these types are grouped.
            { label: 'Type of idea', value: ideaTypeLabel(idea.type) },
            { label: 'Pipeline code', value: String(idea.type || '').replace(/_/g, ' ') },
          ]}
        />
      </DetailSection>
      <DetailSection title="What to check before trusting it">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{guide.caution}</p>
      </DetailSection>
    </>
  );
}

const sentimentRead = (score: number | undefined) => {
  if (typeof score !== 'number') return 'The model did not give the day a score this morning.';
  if (score >= 7) return 'The model reads the day as positive. Investors are willing to take risk — though when a lot of people are already betting the same way, temporary falls tend to be sharper when they come.';
  if (score <= 3) return 'The model reads the day as defensive. Protecting what you already have matters more than chasing new positions here.';
  return 'The model reads the day as mixed. Prices are not clearly trending either way, so being picky counts for more than usual.';
};

function MarketPulseDetails({ pulse, meta }: { pulse: Any; meta: Any }) {
  const levels = Object.entries((pulse.key_levels || {}) as Record<string, Any>);
  return (
    <>
      <DetailSection title="How to read this">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{sentimentRead(pulse.sentiment_score)}</p>
      </DetailSection>
      <DetailSection title="The model’s own read">
        <DetailFacts
          items={[
            // Every value here is written by the morning model, including the
            // two scores — neither is measured from market data, which is what
            // the note under the grid says. The field names ("sentiment score",
            // "market regime") stay visible; the captions explain them.
            { label: 'Sentiment score', value: pulse.sentiment_score != null ? `${pulse.sentiment_score}/10` : undefined },
            { label: 'Market regime', value: meta.market_regime ? String(meta.market_regime).toUpperCase() : undefined, term: 'regime' },
            { label: 'Model’s own confidence', value: meta.confidence != null ? `${meta.confidence}/10` : undefined },
            { label: 'Sector rotation', value: pulse.sector_rotation, term: 'sector_rotation' },
          ]}
        />
        <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
          The sentiment score is the model’s 0–10 reading of the mood it describes, and the confidence score is the model rating its own write-up. Neither is measured from market data, and neither is a record of how often the model has been right.
        </p>
      </DetailSection>
      {!!levels.length && (
        <DetailSection title="Prices the model is watching">
          <DetailFacts
            items={levels.flatMap(([ticker, level]) => [
              { label: `${ticker} support`, value: level?.support != null ? `$${level.support}` : undefined, term: 'support' as GlossaryTerm },
              { label: `${ticker} resistance`, value: level?.resistance != null ? `$${level.resistance}` : undefined, term: 'resistance' as GlossaryTerm },
            ])}
          />
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-tertiary)]">These are prices where a move has stalled before, not places it has to stop again. If the price pushes clearly through one, the whole read changes.</p>
        </DetailSection>
      )}
      {(pulse.drivers?.length || pulse.catalysts?.length) && (
        <DetailSection title="What is driving it">
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{(pulse.drivers || pulse.catalysts).join(' · ')}</p>
        </DetailSection>
      )}
    </>
  );
}

const convictionGuide = (conviction?: string) => {
  const level = String(conviction || '').toLowerCase();
  if (level === 'high') return 'High conviction means the inputs line up strongly. Even so, decide how much to put in from how much you would lose if the exit price is hit, not from how good the idea sounds.';
  if (level === 'low') return 'Low conviction means the idea is early, or the evidence points both ways. It needs more proof before it is worth risking much on.';
  return 'There is useful evidence behind the idea, but it still needs the price to move the right way, and the event it depends on to actually happen.';
};

function OpportunityDetails({ opportunity }: { opportunity: Any }) {
  const isLong = opportunity.direction === 'LONG';
  return (
    <>
      <DetailSection title="What the idea is">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
          This is a bet that the price {isLong ? 'rises — either carrying on upward, or bouncing back from a fall' : 'falls — either carrying on downward, or slipping back after a rise that does not hold'}. {convictionGuide(opportunity.conviction)}
        </p>
      </DetailSection>
      <DetailSection title="The plan at a glance">
        <DetailFacts
          items={[
            { label: 'Direction', value: opportunity.direction },
            // Keep the field's real name. No tooltip: the glossary's `conviction`
            // entry describes the 0–10 daily market score, which is a different
            // number from this high/medium/low rating — the caption below the
            // facts explains this one instead.
            { label: 'Conviction', value: opportunity.conviction },
            { label: 'Timeframe', value: opportunity.timeframe },
            { label: 'Type of investment', value: opportunity.asset_class },
            { label: 'Entry zone', value: opportunity.entry_zone?.length ? `$${opportunity.entry_zone[0]}–$${opportunity.entry_zone[1]}` : opportunity.entry, term: 'entry_zone' },
            { label: 'Target', value: opportunity.target != null ? `$${opportunity.target}` : undefined, term: 'target' },
            { label: 'Stop', value: opportunity.stop != null ? `$${opportunity.stop}` : undefined, term: 'stop' },
            { label: 'Risk / reward', value: opportunity.risk_reward, term: 'risk_reward' },
          ]}
        />
        <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
          “Conviction” here is the model’s own high / medium / low rating of this idea. It is a different figure from the
          model’s 0–10 confidence score shown at the top of the tab, and neither one is a record of how often the model
          has been right.
        </p>
      </DetailSection>
      {opportunity.catalyst && (
        <DetailSection title="The event it hangs on">
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{opportunity.catalyst}</p>
        </DetailSection>
      )}
      <DetailSection title="What would weaken it">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {opportunity.invalidation || opportunity.risk || opportunity.risks?.join?.(' · ') || 'The idea gets weaker if the price passes the exit level above, if the event it depends on does not happen or does not matter, or if the whole market moves the other way.'}
        </p>
      </DetailSection>
    </>
  );
}

const positionActionGuide = (action?: string) => {
  switch (action) {
    case 'ADD': return 'The model sees enough supporting evidence to consider buying more — while keeping the exit price in place and watching how much of the practice portfolio is riding on this one holding.';
    case 'TRIM': return 'The holding still has something going for it, but what it could gain no longer looks big enough next to what it could lose, so the model would sell part of it.';
    case 'EXIT': return 'The reason for owning it no longer holds, or the price has gone past the level set for cutting the loss. The model would sell the whole holding rather than wait for a recovery.';
    case 'HOLD': return 'The reason for owning it still holds and nothing needs to change today. The prices listed below are what to keep an eye on next.';
    default: return 'This is what the model would do with the holding today, based on the latest reasoning, prices and risks.';
  }
};

function PositionReviewDetails({ position }: { position: Any }) {
  return (
    <>
      <DetailSection title="What the instruction means">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{positionActionGuide(position.action)}</p>
      </DetailSection>
      <DetailSection title="The holding at a glance">
        <DetailFacts
          items={[
            { label: 'Action', value: position.action },
            { label: 'Type of investment', value: position.asset_class },
            { label: 'Current price', value: position.current_price != null ? `$${position.current_price}` : undefined },
            // The underlying field is a single entry_price, not an average of
            // several buys, so this must not be called an average.
            { label: 'Price it was bought at', value: position.entry_price != null ? `$${position.entry_price}` : undefined },
            { label: 'Target', value: position.target != null ? `$${position.target}` : undefined, term: 'target' },
            { label: 'Stop', value: position.stop != null ? `$${position.stop}` : undefined, term: 'stop' },
            { label: 'Risk / reward', value: position.risk_reward, term: 'risk_reward' },
            { label: 'Timeframe', value: position.timeframe },
          ]}
        />
      </DetailSection>
      <DetailSection title="Why the model holds it">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{position.rationale || 'The review did not add a reason today.'}</p>
      </DetailSection>
      <DetailSection title="What would change the plan">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {position.invalidation || 'Think again if the price drops past the exit level above, if the reason for owning it stops being true, or if the holding grows so large that one bad day in it would hurt the whole portfolio.'}
        </p>
      </DetailSection>
    </>
  );
}

const riskGuide = (severity?: string) => {
  if (severity === 'high') return 'Rated high, which means looking at it soon: if it plays out it could undo the reason for holding these positions, or take a real bite out of the account.';
  if (severity === 'medium') return 'Rated medium, which means keeping an eye on it and deciding in advance what you would do if it gets worse.';
  return 'Rated low — an early warning. Nothing may need changing today, but it is worth staying aware of what would set it off.';
};

function RiskAlertDetails({ alert }: { alert: Any }) {
  return (
    <>
      <DetailSection title="Why it matters">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{riskGuide(alert.severity)}</p>
      </DetailSection>
      <DetailSection title="What it affects">
        <DetailFacts
          items={[
            // Free text from the model, not a scored or thresholded rating.
            { label: 'How serious the model rates it', value: String(alert.severity || 'Unrated').toUpperCase() },
            { label: 'Holdings affected', value: alert.affected_positions?.length ? alert.affected_positions.join(', ') : 'The whole portfolio, or not specified' },
            { label: 'What would set it off', value: alert.trigger },
            { label: 'How far ahead it applies', value: alert.timeframe || alert.time_horizon },
          ]}
        />
      </DetailSection>
      <DetailSection title="Suggested response">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {alert.mitigation || alert.action || alert.response || 'Look at the holdings involved, check that the prices set for cutting losses still make sense and that no single holding has grown too large, and hold off putting more money in until this is settled one way or the other.'}
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
            <Card
              title={
                <>
                  Insider Trades — SEC Form 4
                  <PlainLabel term="sec_form_4" className="mt-0.5" />
                </>
              }
            >
              <p className="mb-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                Shares bought or sold by a company’s own directors, senior managers and largest shareholders, in their own
                accounts. They are legally required to report each one on a form called an SEC Form 4, so this is public
                record — not a leak or a tip.
              </p>
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
                          {i.value ? `$${Number(i.value).toLocaleString()}` : (i.shares ? `${Number(i.shares).toLocaleString()} shares` : '—')}
                        </td>
                        <td className="py-2 text-right text-[var(--color-text-tertiary)] text-xs" data-numeric>{i.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] text-[var(--color-text-tertiary)]">Source: Form 4 filings in EDGAR, the U.S. Securities and Exchange Commission’s public filing database. Ordinary buying and selling on the stock market is listed first; share awards and staff option exercises rank below it.</p>
            </Card>
          )}
          {!!d?.congress?.recent_trades?.length && (
            <Card title="Congressional Trades — House Disclosures">
              <p className="mb-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                Shares bought or sold by members of the U.S. House of Representatives, who have to declare their own trades.
              </p>
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
              <p className="mt-2 text-[10px] text-[var(--color-text-tertiary)]">Source: U.S. House Clerk financial disclosures (public domain). The dollar figure is the wide band the rules require them to report, not the exact size of the trade.</p>
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
        <GateCard kind={gateKind} need={webNews.error instanceof GateError ? webNews.error.need : undefined} feature="The live news feed" />
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
        <Card
          title={
            <>
              Analyst Ratings
              <PlainLabel term="analyst_ratings" className="mt-0.5" />
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                  <th className="py-1.5 text-left">Symbol</th>
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
          <p className="mt-2 text-[10px] text-[var(--color-text-tertiary)]">
            Each number is how many analysts covering the stock held that view when this data was last collected — a count
            of opinions, not a price or a score. “Hold” is the wording analysts tend to use when they are lukewarm on a
            stock. Ratings are opinions, and they are often slow to change.
          </p>
        </Card>
      )}
    </div>
  );
}

// Bug fix: wsb and stocks are classified with different vocabularies in the source data
// (wsb: BULLISH/BEARISH/MIXED; stocks: CONSTRUCTIVE/CAUTIOUS/BALANCED — it never contains
// the literal word BEARISH). The badge used to test only for that one substring, so the
// stocks card was hard-wired to always render 'Bullish'. Map whichever classification word
// the data actually bolds to a tone instead.
const SENTIMENT_TONE: Record<string, 'bull' | 'bear' | 'caution'> = {
  BULLISH: 'bull',
  CONSTRUCTIVE: 'bull',
  BEARISH: 'bear',
  CRITICAL: 'bear',
  MIXED: 'caution',
  BALANCED: 'caution',
  CAUTIOUS: 'caution',
};

function SentimentTab() {
  const reddit = usePublic<Any>('reddit', '/data/reddit-sentiment.json');
  const d = reddit.data;
  if (reddit.isLoading) return <Empty>Loading…</Empty>;
  if (!d) return <Empty>Reddit sentiment data not available.</Empty>;

  return (
    <div className="space-y-4">
      <Updated iso={d._generated_at} />
      <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
        What everyday investors were posting on two Reddit discussion forums when this was last collected — see the time
        above. It is a sample of the busiest posts, not the whole forum, and it is public chatter rather than research:
        useful for spotting which stocks people are talking about, not for judging whether they are worth owning.
      </p>
      <Grid2>
        {([['wsb', 'r/wallstreetbets — Reddit forum'], ['stocks', 'r/stocks — Reddit forum']] as const).map(([key, label]) => {
          const src = d[key];
          if (!src) return null;
          const summary = String(src.sentiment_summary || '');
          const sentimentWord = summary.match(/\*\*([A-Z]+)\*\*/)?.[1];
          const tone: 'bull' | 'bear' | 'caution' = sentimentWord ? SENTIMENT_TONE[sentimentWord] ?? 'caution' : 'caution';
          const badgeText = sentimentWord ? sentimentWord.charAt(0) + sentimentWord.slice(1).toLowerCase() : 'Unclear';
          return (
            <Card key={key} title={label}>
            <div className="mb-2">
              <Badge tone={tone}>{badgeText}</Badge>
            </div>
            {src.sentiment_summary && (
              <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {String(src.sentiment_summary).substring(0, 400)}
              </p>
            )}
            {!!src.top_tickers?.length && (
              <div className="mb-3">
                <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                  Most-mentioned stocks (times each came up in the posts scanned)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {src.top_tickers.map((t: Any) => (
                    <Badge key={t.ticker} tone="bull">
                      {t.ticker} ({t.count})
                    </Badge>
                  ))}
                </div>
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
              <p className="mb-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                Generated automatically each weekday morning from options trading and industry sentiment — a starting point
                for your own reading, not stock picks made by a person. Tap any row for what it means and what to check.
              </p>
              <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
                {d.analysis_ideas.map((idea: Any, i: number) => (
                  <DetailTrigger
                    key={i}
                    label={`Open analysis details for ${(idea.tickers || []).join(', ') || String(idea.type || 'idea')}`}
                    className="py-3 first:pt-0 last:pb-0"
                    onClick={() => setDetail({
                      eyebrow: 'Analysis idea',
                      title: `${(idea.tickers || []).join(', ') || 'Market'} · ${ideaTypeLabel(idea.type)}`,
                      summary: idea.signal,
                      badge: { tone: ideaTone(idea.type), label: ideaTypeLabel(idea.type) },
                      body: <AnalysisIdeaDetails idea={idea} />,
                    })}
                  >
                    <Badge tone={ideaTone(idea.type)}>{ideaTypeLabel(idea.type)}</Badge>
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
            <p className="text-xs leading-relaxed text-[var(--color-text-tertiary)]">
              Everything on this tab is written each weekday morning by an AI model, about a practice portfolio that holds
              no real money. Educational only — not a recommendation.
            </p>
            <Updated iso={meta.generated_at} />
            <div className="flex items-center gap-3">
              <Badge tone={meta.market_regime === 'risk-on' ? 'bull' : meta.market_regime === 'risk-off' ? 'bear' : 'caution'}>
                {regimeTerm(meta.market_regime) ? (
                  <InfoTip term={regimeTerm(meta.market_regime)!}>{String(meta.market_regime).toUpperCase()}</InfoTip>
                ) : meta.market_regime ? (
                  String(meta.market_regime).toUpperCase()
                ) : (
                  /* Fixed: a missing market_regime used to fall back to a bare '?', which read as a
                     punctuation glitch rather than a missing field. */
                  'Not stated'
                )}
              </Badge>
              <span className="text-xs text-[var(--color-text-tertiary)]" data-numeric>
                Model’s own confidence: {meta.confidence}/10{meta.model ? ` · ${meta.model}` : ''}
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
                    Sentiment score (the model’s own reading of the day): {d.market_pulse.sentiment_score}/10
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
                <>
                <p className="mb-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  Each holding in the practice portfolio, and what the model would do with it today.
                </p>
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
                          {[p.target && `Target $${p.target}`, p.stop && `Exit if it hits $${p.stop}`, p.risk_reward && `Reward vs risk ${p.risk_reward}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      {p.rationale && <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{p.rationale}</span>}
                    </DetailTrigger>
                  ))}
                </div>
                </>
              ) : (
                <p className="text-sm text-[var(--color-text-tertiary)]">No open positions to review.</p>
              )}
            </Card>
            </Grid2>
            <Grid2>
            {!!d.opportunities?.length && (
              <Card title="Opportunities">
                <p className="mb-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  Trades the model would consider opening. LONG means betting the price rises; SHORT means betting it
                  falls. “Conviction” is how strongly the model rates its own idea — high, medium or low. It is the
                  model’s opinion of the idea, not a record of how often it has been right.
                </p>
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
                          {/* Keep the real field name here. `opportunity.conviction` is a
                              word (high/medium/low) and is NOT the same thing as
                              meta.confidence, the 0–10 score in the header — calling both
                              "confidence" made them look like one measure on two scales. */}
                          {[o.conviction && `conviction: ${String(o.conviction).toLowerCase()}`, o.timeframe]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      {o.thesis && <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{o.thesis}</span>}
                      {!!o.entry_zone?.length && (
                        <span className="mt-0.5 block text-xs text-[var(--color-text-tertiary)]" data-numeric>
                          Entry zone (price range to open the trade): ${o.entry_zone[0]}–${o.entry_zone[1]}
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
                        title: r.alert || 'A risk to the portfolio',
                        badge: {
                          tone: r.severity === 'high' ? 'bear' : r.severity === 'medium' ? 'caution' : 'bull',
                          label: `Rated ${String(r.severity || 'Unrated').toUpperCase()}`,
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
                <p className="mb-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  What the model would do next in the practice portfolio.
                </p>
                {d.portfolio_actions.immediate.map((a: string, i: number) => (
                  <p key={i} className="py-1 text-sm text-[var(--color-text-secondary)]">⚡ {a}</p>
                ))}
                {!!d.portfolio_actions.watchlist?.length && (
                  <p className="mt-2 text-xs text-[var(--color-text-secondary)]" data-numeric>
                    Keeping an eye on: {d.portfolio_actions.watchlist.join(', ')}
                  </p>
                )}
                {!!d.portfolio_actions.avoid?.length && (
                  <p className="text-xs text-[var(--color-text-tertiary)]" data-numeric>Staying away from: {d.portfolio_actions.avoid.join(', ')}</p>
                )}
              </Card>
            )}
            {meta.stale && (
              <p className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: 'var(--color-bear-soft)', color: 'var(--color-bear)' }}>
                ⚠ This analysis is out of date — it was built from older data: {meta.stale_reason || 'No recent data'}
              </p>
            )}
            <ResearchDetailDialog detail={detail} onClose={() => setDetail(null)} />
          </div>
        );
      }}
    </GatedPane>
  );
}

/** walk_forward_v2.json keys its summary by raw snake_case strategy name; these
 *  are the reader-facing versions, matching the /models walk-forward tile. */
const STRATEGY_LABELS: Record<string, string> = {
  mean_reversion: 'Mean Reversion',
  momentum: 'Momentum',
  breakout: 'Breakout',
  sector_rotation: 'Sector Rotation',
};

function BacktestTab() {
  const q = useGated<Any>('walk-forward', 'walk_forward_v2.json');

  return (
    <GatedPane q={q} feature="Strategy testing results" need="pro">
      {(wf) => (
        <div className="space-y-4">
          <Card
            title={
              <>
                Why We Discount Backtest Results
                <PlainLabel term="backtest" className="mt-0.5" />
              </>
            }
          >
            <Updated iso={wf?.generated_at} />
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              A backtest replays a trading rule against past prices to see how it would have done. The catch, set out by the
              quantitative-finance researcher Marcos López de Prado in what he called{' '}
              <strong className="text-[var(--color-text-primary)]">the False Strategy Theorem</strong>: try 100 rules on
              purely random data and 5 to 10 of them will still look profitable, by luck alone. So we assume roughly 30% of
              any measured edge is luck and will not survive. As an illustration, a{' '}
              <InfoTip term="sharpe">Sharpe</InfoTip> score of 2.22 on the data a rule was tuned with would be expected to
              come out nearer 1.55 if the rule were traded for real. (Those two figures are an example, not today’s
              numbers — our own test results are in the table below, and they are simulated too.)
              {wf?.summary?.mean_reversion && (
                <>
                  {' '}Our own testing points the same way: the{' '}
                  <InfoTip term="mean_reversion">mean-reversion</InfoTip> rule scored{' '}
                  {typeof wf.summary.mean_reversion.avg_oos_sharpe === 'number' ? wf.summary.mean_reversion.avg_oos_sharpe.toFixed(2) : '?'} on data it had never seen, against{' '}
                  {typeof wf.summary.mean_reversion.avg_is_sharpe === 'number' ? wf.summary.mean_reversion.avg_is_sharpe.toFixed(2) : '?'} on the data it was built from.
                </>
              )}
            </p>
          </Card>
          {wf?.summary && (
            <Card
              title={
                <>
                  Walk-Forward Results
                  <PlainLabel term="walk_forward" className="mt-0.5" />
                </>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    {/* No <InfoTip> in these header cells: the table sits in an
                        `overflow-x-auto` wrapper, which also clips vertically, so an
                        upward-opening tooltip on the top row is cut off. The acronyms
                        stay, explained by the always-on captions and the note below. */}
                    <tr className="align-bottom text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                      <th className="py-1.5 text-left">Strategy</th>
                      <th className="py-1.5 text-right">
                        IS Sharpe
                        <PlainLabel term="is_sharpe" className="mt-0.5 text-right" />
                      </th>
                      <th className="py-1.5 text-right">
                        OOS Sharpe
                        <PlainLabel term="oos_sharpe" className="mt-0.5 text-right" />
                      </th>
                      <th className="py-1.5 text-right">Degradation</th>
                      <th className="py-1.5 text-right">OOS Trades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(wf.summary as Record<string, Any>).map(([key, s]) =>
                      s?.avg_is_sharpe != null ? (
                        <tr key={key} className="border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                          <td className="py-2 font-semibold text-[var(--color-text-primary)]">{STRATEGY_LABELS[key] || key.replace(/_/g, ' ')}</td>
                          <td className="py-2 text-right" data-numeric>{s.avg_is_sharpe.toFixed(2)}</td>
                          <td className="py-2 text-right" data-numeric>{s.avg_oos_sharpe?.toFixed?.(2) ?? '—'}</td>
                          {/* Degradation is "% of the edge lost on unseen data", so a big
                              positive number is BAD. The old rule coloured every positive
                              value green, which contradicted the caption below and the same
                              table on /models. Matches WalkForwardTile.tsx: red above 50%. */}
                          <td className="py-2 text-right" data-numeric style={{ color: (s.avg_degradation_pct ?? 0) > 50 ? 'var(--color-bear)' : 'var(--color-text-primary)' }}>
                            {s.avg_degradation_pct != null ? `${s.avg_degradation_pct.toFixed(1)}%` : '—'}
                          </td>
                          <td className="py-2 text-right" data-numeric>{s.total_oos_trades ?? '—'}</td>
                        </tr>
                      ) : null,
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-[var(--color-text-tertiary)]">
                IS = in-sample, the stretch of history each rule was built and tuned on. OOS = out-of-sample, later data it
                had never seen — that is the column that matters, and OOS Trades counts the trades it produced there.
                Degradation is how much of the edge fell away between the two: the bigger it is, the more the rule was
                fitted to the past, and a negative figure means it did better on the unseen data. Where the trade count is
                small, treat the scores beside it as thin evidence rather than proof. All of it is simulated, on past
                prices — nothing here was traded with real money.
              </p>
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
            <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
              A prediction market lets people stake real money on whether an event will happen. The percentage beside each
              answer is what a bet on it costs, in cents on the dollar — which is usually read as the crowd’s estimate of
              the odds. The dollar figure is how much has been traded on that question so far: it adds up every bet since
              the question opened, including bets later sold on, so it is not the amount currently riding on the outcome.
              These are bets on events, not stock prices.
            </p>
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
                    {fmtVol(m.volume || 0)} traded
                    {/* Fixed: was tone="bear" (red), which read as a bad outcome — "closed" just means
                        the question is over, not that any side lost. Neutral tone instead. */}
                    {m.closed && <Badge tone="caution">Betting closed</Badge>}
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
                Showing the 30 questions with the most trading, out of {d.markets.length}
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
                    {/* Same reason as the walk-forward table: no tooltip inside an
                        `overflow-x-auto` header row, because it would be clipped. */}
                    <tr className="align-bottom text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                      <th className="py-1.5 text-left">Date</th>
                      <th className="py-1.5 text-left">Symbol</th>
                      <th className="py-1.5 text-right">
                        EPS Est.
                        <PlainLabel term="eps" className="mt-0.5 text-right" />
                      </th>
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
                      // Fixed: was `epsActual >= epsEstimate`, which badged an exact match to the
                      // estimate as a green "Beat" — conventionally a match is "in-line", not a beat.
                      // Now beat/miss require a strict inequality and a tie gets its own neutral badge.
                      const result =
                        r.epsActual != null && r.epsEstimate != null
                          ? r.epsActual > r.epsEstimate
                            ? 'beat'
                            : r.epsActual < r.epsEstimate
                              ? 'miss'
                              : 'inline'
                          : null;
                      return (
                        <tr key={i} className="border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                          <td className="py-2 text-[var(--color-text-secondary)]" data-numeric>{r.date}</td>
                          <td className="py-2 font-semibold text-[var(--color-text-primary)]" data-numeric>{r.ticker}</td>
                          <td className="py-2 text-right" data-numeric>{r.epsEstimate != null ? `$${Number(r.epsEstimate).toFixed(2)}` : '—'}</td>
                          {showActual && (
                            <>
                              <td className="py-2 text-right" data-numeric>{r.epsActual != null ? `$${Number(r.epsActual).toFixed(2)}` : '—'}</td>
                              <td className="py-2 text-right">
                                {result == null ? (
                                  '—'
                                ) : (
                                  <Badge tone={result === 'beat' ? 'bull' : result === 'miss' ? 'bear' : 'caution'}>
                                    {result === 'beat' ? 'Beat' : result === 'miss' ? 'Miss' : 'In-line'}
                                  </Badge>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-[var(--color-text-tertiary)]">
                EPS is profit per share — the company’s profit divided by the number of shares. “Est.” is what Wall Street
                analysts expect it to be{showActual ? '; “Actual” is what the company reported. “Beat” means the reported figure came in above the estimate, “In-line” that it matched the estimate exactly, “Miss” that it fell short' : ''}.
              </p>
            </Card>
          ) : null;

        return (
          <div className="space-y-4">
            {d.generated_at && <Updated iso={d.generated_at} />}
            <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
              <InfoTip term="earnings">Earnings</InfoTip> are the profit figures a company publishes every three months.
              Share prices often move sharply in the hours after one, because the figure is compared against what analysts
              had forecast.
            </p>
            <Table rows={upcoming} title="Upcoming Earnings (stocks we track)" showActual={false} />
            <Table rows={recent} title="Recent Results" showActual />
            {d.transcripts?.length ? (
              <>
                <input
                  type="search"
                  value={transcriptSearch}
                  onChange={(event) => setTranscriptSearch(event.target.value)}
                  placeholder="Search earnings-call write-ups by symbol, quarter, or phrase…"
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
              <p className="text-xs text-[var(--color-text-tertiary)]">Word-for-word records of companies’ earnings calls — the sessions where management explains the results — are not available here. The data provider that supplies them is not connected.</p>
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
            <p className="mb-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
              Documents U.S.-listed companies are required to file with the Securities and Exchange Commission (SEC), the
              American market regulator. Each one is public and free to read.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                    <th className="py-1.5 text-left">Date</th>
                    <th className="py-1.5 text-left">Symbol</th>
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
                        <ExtLink href={f.url || '#'}>Open filing ↗</ExtLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--color-text-tertiary)]">
              What the form codes mean: 8-K, something significant just happened; 10-Q, the quarterly results; 10-K, the
              full annual report; 4, a director or senior manager bought or sold their own company’s shares; S-1, a company
              is preparing to sell shares to the public. Links open EDGAR, the SEC’s public filing database.
            </p>
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
  // "Sentiment" showed only Reddit, and "Markets" showed only prediction
  // markets — neither pane matched what a reader expected from the word.
  { key: 'sentiment', label: 'Reddit Sentiment', pane: SentimentTab },
  { key: 'ideas', label: 'Ideas', pane: IdeasTab },
  { key: 'mg', label: 'MapleGamma Analysis', pane: MgAnalysisTab },
  { key: 'backtest', label: 'Backtest', pane: BacktestTab },
  { key: 'markets', label: 'Prediction Markets', pane: MarketsTab },
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
          The day’s market write-up, the news, what people are saying online, trade ideas and company filings — all in one place.
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
