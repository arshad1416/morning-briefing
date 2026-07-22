// app/archive/[date]/page.tsx — statically prerendered daily briefing pages.
//
// Each briefing under data/archive/*.json becomes a real indexable URL
// (/archive/2026-07-14/) with the narrative as server-rendered HTML and
// NewsArticle structured data. The interactive index at /archive is unchanged;
// these pages exist so search engines and AI crawlers can read the analysis.
import type { Metadata } from 'next';
import Link from 'next/link';
import fs from 'node:fs';
import path from 'node:path';
import { InfoTip } from '@/components/primitives';
import type { GlossaryTerm } from '@/lib/glossary';

export const dynamicParams = false;

const SITE = 'https://maplegamma.com';
const ARCHIVE_DIR = path.join(process.cwd(), 'data', 'archive');

type Any = any;

function listDates(): string[] {
  try {
    const idx = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'data', 'archive-index.json'), 'utf8'),
    );
    const dates: string[] = idx.dates ?? [];
    return dates.filter((d) => fs.existsSync(path.join(ARCHIVE_DIR, `${d}.json`)));
  } catch {
    return [];
  }
}

function loadBriefing(date: string): Any | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(ARCHIVE_DIR, `${date}.json`), 'utf8'));
  } catch {
    return null;
  }
}

function longDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function narrativeText(d: Any): string {
  const n = d?.narrative;
  if (typeof n === 'string') return n;
  if (n && typeof n === 'object') return Object.values(n).filter((v) => typeof v === 'string').join('\n\n');
  return '';
}

// Two rows of the archived `indices` array are not indexes at all — a fear
// gauge and a government bond yield — and both are unguessable four-character
// labels. Same mapping the ticker tape uses, so the wording stays site-wide.
const ROW_TERMS: Record<string, GlossaryTerm> = {
  VIX: 'vix',
  '10Y Yield': 'ten_year_yield',
};

/**
 * Screener flags arrive as raw machine tokens ("neutral_rsi", "above_20ma") and
 * used to be printed with the underscores intact. Each one is rendered as the
 * plain sentence it stands for; the wording matches the glossary's readings of
 * RSI and the moving averages. Older archives spell the same flags with spaces
 * ("neutral rsi"), so the key is normalised before lookup, and anything the map
 * does not know falls back to the token with its underscores tidied away rather
 * than disappearing.
 */
const SIGNAL_LABELS: Record<string, string> = {
  neutral_rsi: 'not overbought or oversold',
  oversold: 'sold off unusually hard lately',
  overbought: 'bought up unusually hard lately',
  strong_momentum: 'moving strongly in one direction',
  above_20ma: 'above its 20-day average price',
  above_50ma: 'above its 50-day average price',
  below_20ma: 'below its 20-day average price',
  below_50ma: 'below its 50-day average price',
  elevated_volume: 'heavier trading than usual',
  pullback: 'pulled back from a recent high',
  breakout: 'pushed past a level it had struggled with',
};

function signalLabel(raw: string): string {
  const key = String(raw).toLowerCase().trim().replace(/[\s-]+/g, '_');
  return SIGNAL_LABELS[key] ?? key.replace(/_/g, ' ');
}

// Minimal **bold** renderer — the narratives use markdown-style emphasis only.
function Prose({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((para, i) => (
          <p key={i} className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {para.split('**').map((part, j) =>
              j % 2 === 1 ? (
                <strong key={j} className="text-[var(--color-text-primary)]">{part}</strong>
              ) : (
                part
              ),
            )}
          </p>
        ))}
    </>
  );
}

export function generateStaticParams() {
  return listDates().map((date) => ({ date }));
}

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params;
  const d = loadBriefing(date);
  const raw = narrativeText(d).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  // The fallback fires exactly when the narrative is EMPTY, so it must not
  // promise analysis the page will not contain. "Key levels" and "dealer gamma"
  // have no field in data/archive/*.json at all; what is always there is the
  // index table and the central-bank notes.
  const description = raw
    ? `${raw.slice(0, 152)}…`
    : `MapleGamma daily market briefing for ${longDate(date)}: where the major indexes finished, the VIX fear gauge, and what the Fed and the Bank of Canada said.`;
  return {
    title: `S&P 500 Market Briefing — ${longDate(date)}`,
    description,
    alternates: { canonical: `/archive/${date}/` },
    openGraph: {
      type: 'article',
      title: `S&P 500 Market Briefing — ${longDate(date)}`,
      description,
      url: `/archive/${date}/`,
    },
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>
      {children}
    </section>
  );
}

export default async function BriefingPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const d = loadBriefing(date) ?? {};
  const dates = listDates(); // newest-first
  const i = dates.indexOf(date);
  const newer = i > 0 ? dates[i - 1] : null;
  const older = i >= 0 && i < dates.length - 1 ? dates[i + 1] : null;

  const indices: Any[] = d?.market_summary?.indices ?? [];
  const narrative = narrativeText(d);
  const geo: Any[] = (d?.geopolitical ?? []).slice(0, 6);
  const setups: Any[] = (d?.premarket_top_setups ?? []).slice(0, 6);
  const cb = d?.central_banks ?? {};

  const ARTICLE_LD = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: `S&P 500 Market Briefing — ${longDate(date)}`,
    datePublished: d?.generated_at ?? `${date}T07:20:00-04:00`,
    dateModified: d?.generated_at ?? `${date}T07:20:00-04:00`,
    author: { '@type': 'Organization', name: 'MapleGamma', url: SITE },
    publisher: { '@type': 'Organization', name: 'MapleGamma', url: SITE },
    mainEntityOfPage: `${SITE}/archive/${date}/`,
    description: narrative.replace(/\*\*/g, '').slice(0, 200),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ARTICLE_LD) }}
      />

      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]" style={{ fontFamily: 'var(--font-mono)' }}>
          Daily Briefing · {date}
        </p>
        <h1 className="font-display text-3xl text-[var(--color-text-primary)]">
          S&P 500 Market Briefing — {longDate(date)}
        </h1>
        {/* "AI council" is the product's own name for the ensemble, so it stays
            — but "council" reads as a room full of human experts, which is the
            opposite of what it is. Said plainly on first use instead. */}
        <p className="text-sm text-[var(--color-text-tertiary)]">
          Written before the market opened by the MapleGamma AI council — five AI models
          that each read the market separately, whose views are then combined. It follows a{' '}
          <InfoTip term="paper_trading">simulated (paper-trading)</InfoTip> account, so
          every balance and return below is practice money. Educational only — not
          financial advice.
        </p>
      </header>

      {indices.length > 0 && (
        <Section title="Market Snapshot">
          <div className="overflow-x-auto rounded-[var(--radius-tile)] border" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <table className="w-full text-sm" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                {/* Not all rows are indexes — the archived `indices` array also
                    carries VIX and the 10-year yield. "Change" needed its unit
                    and its period spelled out. */}
                <tr className="border-b text-left" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <th className="px-3 py-2 text-xs font-medium text-[var(--color-text-tertiary)]">Market</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[var(--color-text-tertiary)]">Level</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[var(--color-text-tertiary)]">1-day change</th>
                </tr>
              </thead>
              <tbody>
                {indices.map((x: Any) => (
                  <tr key={x.ticker} className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    <td className="px-3 py-2 text-[var(--color-text-primary)]">
                      {ROW_TERMS[x.ticker] ? (
                        <InfoTip term={ROW_TERMS[x.ticker]}>{x.ticker}</InfoTip>
                      ) : (
                        x.ticker
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-secondary)]">{Number(x.price).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right" style={{ color: x.change_pct >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}>
                      {x.change_pct >= 0 ? '+' : ''}{Number(x.change_pct).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {narrative && (
        <Section title="Morning Analysis">
          <div className="space-y-4">
            {/* The narrative is desk-note prose written by the models and stored
                verbatim, so it cannot be edited here. What it can be given is a
                frame: the "portfolio" it discusses is MapleGamma's simulated
                one, and the position sizes in it are not instructions to anyone. */}
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Written in trading-desk shorthand. Every holding, balance and target below
              belongs to MapleGamma&apos;s practice account, not to you.
            </p>
            <Prose text={narrative} />
          </div>
        </Section>
      )}

      {(cb.fed || cb.boc) && (
        <Section title="Central Banks">
          <div className="space-y-4">
            {cb.fed && <Prose text={`**Federal Reserve.** ${cb.fed}`} />}
            {cb.boc && <Prose text={`**Bank of Canada.** ${cb.boc}`} />}
          </div>
        </Section>
      )}

      {setups.length > 0 && (
        <Section title="Premarket Setups">
          <p className="text-sm text-[var(--color-text-secondary)]">
            A &ldquo;setup&rdquo; is a pattern on the price chart that MapleGamma&apos;s
            screen flagged — it says nothing about the business behind the stock. The
            score is the screen&apos;s own ranking: more signals lined up means a higher
            score. It is not a percentage, and it is not the 0–10 market score used
            elsewhere on the site. None of this is a recommendation.
          </p>
          <ul className="space-y-1 text-sm text-[var(--color-text-secondary)]">
            {setups.map((s: Any) => (
              <li key={s.ticker}>
                <strong className="text-[var(--color-text-primary)]">{s.ticker}</strong>
                {' '}— score {s.score}, {s.change_pct >= 0 ? '+' : ''}{Number(s.change_pct).toFixed(2)}%
                {Array.isArray(s.signals) && s.signals.length > 0 && ` (${s.signals.slice(0, 3).map(signalLabel).join('; ')})`}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {geo.length > 0 && (
        <Section title="Geopolitical Watch">
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-text-secondary)]">
            {geo.map((g: Any, k: number) => (
              <li key={k}>
                {g.title}
                {g.source && <span className="text-[var(--color-text-tertiary)]"> — {g.source}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Go Deeper">
        {/* An InfoTip cannot go inside the link (a <button> nested in an <a>),
            so the explanation follows the link as ordinary prose. */}
        <p className="text-sm text-[var(--color-text-secondary)]">
          See today&apos;s live <Link href="/options/" className="underline text-[var(--color-accent)]">dealer gamma exposure and flip levels</Link> —
          how much buying and selling the banks that sold these options must do just to
          stay balanced, and the price at which that hedging switches from steadying the
          market to amplifying its moves. Or open the free{' '}
          <Link href="/dashboard/" className="underline text-[var(--color-accent)]">market dashboard</Link>,
          or browse the full <Link href="/archive/" className="underline text-[var(--color-accent)]">briefing archive</Link>.
        </p>
      </Section>

      <nav className="flex items-center justify-between border-t pt-4 text-sm" style={{ borderColor: 'var(--color-border-subtle)' }}>
        {older ? (
          <Link href={`/archive/${older}/`} className="text-[var(--color-accent)] underline">← {older}</Link>
        ) : <span />}
        {newer ? (
          <Link href={`/archive/${newer}/`} className="text-[var(--color-accent)] underline">{newer} →</Link>
        ) : <span />}
      </nav>
    </div>
  );
}
