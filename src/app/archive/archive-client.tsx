// app/archive/archive-client.tsx — browse past briefings, ported from the
// legacy archive.js. Reads the public /data/archive-index.json plus
// /data/archive/{date}.json per entry; each card expands inline to the full
// structured briefing (markets table + sectioned narrative).
'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InfoTip, PlainLabel } from '@/components/primitives';
import { lookup, type GlossaryTerm } from '@/lib/glossary';

/** Glossary wording for a native `title`, where an InfoTip button cannot go. */
const chipHint = (term: GlossaryTerm) => lookup(term)?.plain;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const fetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const CORE_INDICES = ['S&P 500', 'Dow Jones', 'NASDAQ', 'TSX'];

// These four are stock-market indexes, quoted in points — the S&P 500 is not
// "$7,443.28". The old formatter prefixed a dollar sign unconditionally, which
// also contradicted the same field on /archive/[date], where it is printed with
// no currency at all. Formatting only; the value is untouched.
const fmtLevel = (v: number) =>
  Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function narrativeText(brief: Any): string {
  const narr = brief?.narrative ?? '';
  if (typeof narr === 'string' && narr.length > 20) return narr;
  if (narr?.summary_paragraph) return narr.summary_paragraph;
  return '';
}

interface Section {
  heading: string;
  /** Optional glossary term explained on the heading itself. */
  term?: GlossaryTerm;
  /**
   * The exact words the tooltip attaches to, when the term only explains part
   * of the heading — otherwise the dotted underline claims to define words it
   * does not ("Watchlist &" is not position sizing). Defaults to the whole
   * heading, and must be a suffix of it.
   */
  termWords?: string;
  text: string;
}

/** Section heading, with the tooltip on just the words the term explains. */
function SectionHeading({ section }: { section: Section }) {
  if (!section.term) return <>{section.heading}</>;
  const tipped = section.termWords ?? section.heading;
  const lead = section.heading.slice(0, section.heading.length - tipped.length);
  return (
    <>
      {lead}
      <InfoTip term={section.term}>{tipped}</InfoTip>
    </>
  );
}

/**
 * Split the briefing narrative into the email's named sections.
 *
 * Headings deliberately say "practice portfolio". The balances underneath
 * ("cash sits at $1,120.36 of a $1,177.72 balance", "a YTD return of −41.1%")
 * belong to MapleGamma's own simulated ledger, not to the reader — the old
 * "Portfolio Overview" read as a statement about their money. "Strategy
 * Recommendations" was worse: the source block is headed "Strategy tilt & macro
 * signals" — a lean on a simulated book — and the body carries concrete orders,
 * on a product whose signup checkbox has the user confirm MapleGamma gives no
 * recommendations. The heading now describes the lean without prescribing it.
 */
function splitSections(text: string): Section[] {
  const insightMarker = '**Three quantitative insights**';
  const tiltMarker = '**Strategy tilt';
  const watchlistMarker = '**Watchlist';
  const sections: Section[] = [];
  const insightIdx = text.indexOf(insightMarker);
  if (insightIdx >= 0) {
    const intro = text.substring(0, insightIdx).trim();
    if (intro) sections.push({ heading: 'Practice Portfolio Overview', term: 'paper_trading', text: intro });
    const afterInsight = text.substring(insightIdx + insightMarker.length);
    const tiltIdx = afterInsight.indexOf(tiltMarker);
    sections.push({ heading: 'Key Insights', text: (tiltIdx >= 0 ? afterInsight.substring(0, tiltIdx) : afterInsight).trim() });
    if (tiltIdx >= 0) {
      const afterTilt = afterInsight.substring(tiltIdx);
      const watchIdx = afterTilt.indexOf(watchlistMarker);
      sections.push({ heading: 'How the Practice Portfolio Is Leaning', text: (watchIdx >= 0 ? afterTilt.substring(0, watchIdx) : afterTilt).trim() });
      // Source section is "**Watchlist & sizing**" — the old heading dropped
      // "sizing", so the position-sizing instructions inside arrived unlabelled.
      if (watchIdx >= 0)
        sections.push({
          heading: 'Watchlist & Position Sizing',
          term: 'position_sizing',
          termWords: 'Position Sizing',
          text: afterTilt.substring(watchIdx).trim(),
        });
    }
  } else {
    sections.push({ heading: 'Practice Portfolio Analysis', term: 'paper_trading', text });
  }
  return sections;
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sectionHtml(text: string): string {
  return esc(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n[•●] /g, '<br>&nbsp;&nbsp;• ')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

function Chip({ children, color, hint }: { children: React.ReactNode; color?: string; hint?: string }) {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
      data-numeric
      title={hint}
      style={{
        backgroundColor: color ? `color-mix(in srgb, ${color} 14%, transparent)` : 'var(--color-bg-elevated)',
        color: color ?? 'var(--color-text-secondary)',
      }}
    >
      {children}
    </span>
  );
}

function BriefingCard({ date }: { date: string }) {
  const [open, setOpen] = useState(false);
  const q = useQuery<Any>({
    queryKey: ['archive', date],
    queryFn: () => fetchJson(`/data/archive/${date}.json`),
    staleTime: Infinity,
    retry: false,
  });

  const brief = q.data;
  if (q.isError) return null;

  const ms = brief?.market_summary || {};
  const indices: Any[] = ms.indices || [];
  const core = indices.filter((i) => CORE_INDICES.includes(i.ticker));
  const fx: Any[] = (ms.fx_rates || []).filter((f: Any) => f.price > 0);
  const text = brief ? narrativeText(brief) : '';
  const preview = text ? `${text.replace(/\*\*/g, '').replace(/[•●]/g, '').substring(0, 150).trim()}${text.length > 150 ? '…' : ''}` : '';
  const timeStr = brief?.generated_at
    ? new Date(brief.generated_at).toLocaleTimeString('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div
      className="overflow-hidden rounded-[var(--radius-tile)] border transition-colors"
      style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: open ? 'var(--color-border-default)' : 'var(--color-border-subtle)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full p-4 text-left transition-colors hover:bg-[var(--color-bg-elevated)]"
        aria-expanded={open}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]" data-numeric>{date}</span>
          <span className="text-xs text-[var(--color-text-tertiary)]" data-numeric>{timeStr} ET</span>
        </div>
        {q.isLoading ? (
          <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">Loading…</p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-1">
              {core.map((i) => (
                <Chip key={i.ticker} color={(i.change_pct || 0) >= 0 ? 'var(--color-bull)' : 'var(--color-bear)'}>
                  {i.ticker}: {fmtLevel(i.price)} ({(i.change_pct || 0) >= 0 ? '+' : ''}{(i.change_pct || 0).toFixed(2)}%)
                </Chip>
              ))}
              {/* No <InfoTip> in this block: the whole collapsed card is a
                  <button>, and InfoTip renders a real <button> of its own —
                  nesting them is invalid HTML. A native `title` carries the same
                  glossary wording instead, the way the ticker tape does, and the
                  expanded table below has the full tooltip plus a caption. */}
              {ms.vix != null && <Chip hint={chipHint('vix')}>VIX: {ms.vix}</Chip>}
              {ms.ten_year_yield != null && (
                <Chip hint={chipHint('ten_year_yield')}>10Y: {ms.ten_year_yield}%</Chip>
              )}
              {fx.map((f) => (
                <Chip key={f.pair}>{f.pair}: {Number(f.price).toFixed(2)}</Chip>
              ))}
            </div>
            {preview && <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">{preview}</p>}
          </>
        )}
      </button>

      {open && brief && (
        <div className="border-t p-4" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div className="mb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {/* "Index" was wrong for several rows below — an exchange rate, a
                  volatility gauge and a bond yield are not indexes. "Value"
                  implied dollars; index levels are points. "Change" gave
                  neither the unit nor the period. */}
              <tr className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                <th className="py-1.5 text-left">Market</th>
                <th className="py-1.5 text-right">Level</th>
                <th className="py-1.5 text-right">1-day change</th>
              </tr>
            </thead>
            <tbody>
              {core.map((i) => (
                <tr key={i.ticker} className="border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <td className="py-1.5 text-[var(--color-text-secondary)]">{i.ticker}</td>
                  <td className="py-1.5 text-right font-semibold text-[var(--color-text-primary)]" data-numeric>{fmtLevel(i.price)}</td>
                  <td className="py-1.5 text-right" data-numeric style={{ color: (i.change_pct || 0) >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}>
                    {(i.change_pct || 0) >= 0 ? '▲' : '▼'} {(i.change_pct || 0).toFixed(2)}%
                  </td>
                </tr>
              ))}
              {fx.map((f) => (
                <tr key={f.pair} className="border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <td className="py-1.5 text-[var(--color-text-secondary)]">{f.pair}</td>
                  <td className="py-1.5 text-right font-semibold text-[var(--color-text-primary)]" data-numeric>{Number(f.price).toFixed(2)}</td>
                  <td className="py-1.5 text-right text-[var(--color-text-tertiary)]">—</td>
                </tr>
              ))}
              {ms.vix != null && (
                <tr className="border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  {/* Bare three- and four-character labels a beginner cannot
                      decode, so these two carry an always-on caption as well as
                      the tooltip. */}
                  <td className="py-1.5 text-[var(--color-text-secondary)]">
                    <InfoTip term="vix">VIX</InfoTip>
                    <PlainLabel term="vix" />
                  </td>
                  <td className="py-1.5 text-right font-semibold text-[var(--color-text-primary)]" data-numeric>{ms.vix}</td>
                  <td className="py-1.5 text-right text-[var(--color-text-tertiary)]">—</td>
                </tr>
              )}
              {ms.ten_year_yield != null && (
                <tr className="border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <td className="py-1.5 text-[var(--color-text-secondary)]">
                    <InfoTip term="ten_year_yield">10Y Yield</InfoTip>
                    <PlainLabel term="ten_year_yield" />
                  </td>
                  <td className="py-1.5 text-right font-semibold text-[var(--color-text-primary)]" data-numeric>{ms.ten_year_yield}%</td>
                  <td className="py-1.5 text-right text-[var(--color-text-tertiary)]">—</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          {text &&
            splitSections(text).map((s) => (
              <div key={s.heading} className="mb-4 last:mb-0">
                <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                  <SectionHeading section={s} />
                </h3>
                <div
                  className="text-sm leading-relaxed text-[var(--color-text-secondary)]"
                  dangerouslySetInnerHTML={{ __html: sectionHtml(s.text) }}
                />
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export function ArchiveClient() {
  const index = useQuery<Any>({
    queryKey: ['archive-index'],
    queryFn: () => fetchJson('/data/archive-index.json'),
    staleTime: 300_000,
    retry: false,
  });

  const dates: string[] = Array.isArray(index.data?.dates) ? index.data.dates : [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div
        className="relative overflow-hidden rounded-[var(--radius-tile)] border p-6"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
      >
        <span aria-hidden="true" className="glow-orb -top-24 -right-8" />
        <h1 className="relative z-10 font-display text-3xl text-[var(--color-text-primary)]">
          Briefing <em className="italic" style={{ color: 'var(--color-accent)' }}>Archive</em>
        </h1>
        <p className="relative z-10 mt-2 text-sm text-[var(--color-text-secondary)]">
          Every morning briefing, preserved — expand any day for the full report.
        </p>
        {/* The per-date pages carry this qualifier; this index page did not, so
            the balances and returns inside each card read as the reader's own. */}
        <p className="relative z-10 mt-2 text-xs text-[var(--color-text-tertiary)]">
          Each briefing follows MapleGamma&apos;s own{' '}
          <InfoTip term="paper_trading">practice portfolio</InfoTip> — the balances and
          returns you will read are simulated, no real money is involved, and none of it
          is financial advice.
        </p>
      </div>

      {index.isLoading ? (
        <p className="p-8 text-center text-sm text-[var(--color-text-tertiary)]">Loading archive…</p>
      ) : !dates.length ? (
        <p className="p-8 text-center text-sm text-[var(--color-text-tertiary)]">No archived briefings yet.</p>
      ) : (
        <div className="space-y-3">
          {dates.map((date) => (
            <BriefingCard key={date} date={date} />
          ))}
        </div>
      )}
    </div>
  );
}
