// app/archive/[date]/page.tsx — statically prerendered daily briefing pages.
//
// Each briefing under data/archive/*.json becomes a real indexable URL
// (/archive/2026-07-14/) with the narrative as server-rendered HTML and
// NewsArticle structured data. The interactive index at /archive is unchanged;
// these pages exist so search engines and AI crawlers can read the analysis.
import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoTip, PlainLabel } from '@/components/primitives';
import type { GlossaryTerm } from '@/lib/glossary';
import { buildMetadata } from '@/lib/seo';
import { listDates, loadBriefing, publishedOn, repeatOf } from '../corpus';

export const dynamicParams = false;

const SITE = 'https://maplegamma.com';

type Any = any;

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

/**
 * The one sentence describing this date, for BOTH <meta name=description> and
 * the NewsArticle JSON-LD.
 *
 * The JSON-LD used to take `narrative.slice(0, 200)` of its own, which is the
 * empty string on the 51 dates whose narrative is a repeat — and an empty
 * `description` property asserts the article has none, which is worse than
 * omitting it. Both surfaces now get the same real sentence.
 *
 * The fallback also used to be one boilerplate line with only the date swapped,
 * i.e. 51 near-duplicate descriptions across two-thirds of the indexed archive.
 * What genuinely differs per date is the closing tape this page already renders
 * in its table, so that is quoted instead — measured present on all 51.
 */
function describe(date: string, d: Any): string {
  // A narrative this date only repeated is not this date's briefing, so it must
  // not be the sentence Google prints under the headline either.
  const raw = repeatOf(date, d?.narrative)
    ? ''
    : narrativeText(d).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  if (raw) return `${raw.slice(0, 152)}…`;
  // "Key levels" and "dealer gamma" were promised by the old fallback and have
  // no field in data/archive/*.json at all; the central-bank notes it also
  // promised are missing from some days. These two are what is actually there.
  const sp = (d?.market_summary?.indices ?? []).find((x: Any) => x.ticker === 'S&P 500');
  const vix = Number(d?.market_summary?.vix);
  // These are the levels the briefing was written against — the LAST close, not
  // this date's. Briefings generate pre-market, and 17 archived dates fall on a
  // weekend (2026-07-04 and 07-05 both carry Friday's 7,483.24), so "closed at
  // <date>" would be flatly false on those. State the levels, not a close.
  const tape = [
    Number.isFinite(Number(sp?.price)) &&
      Number.isFinite(Number(sp?.change_pct)) &&
      `S&P 500 ${Number(sp.price).toLocaleString('en-US', { maximumFractionDigits: 2 })} (${Number(sp.change_pct) >= 0 ? '+' : ''}${Number(sp.change_pct).toFixed(2)}%)`,
    Number.isFinite(vix) && `VIX ${vix.toFixed(2)}`,
  ]
    .filter(Boolean)
    .join(', ');
  return tape
    ? `MapleGamma daily market briefing for ${longDate(date)}, written before the open against the last close: ${tape}.`
    : `MapleGamma daily market briefing for ${longDate(date)}: where the major indexes and the VIX fear gauge stood before the open.`;
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
  return buildMetadata({
    title: `S&P 500 Market Briefing — ${longDate(date)}`,
    description: describe(date, d),
    path: `/archive/${date}/`,
    ogType: 'article',
    publishedTime: d?.generated_at ?? `${date}T07:20:00-04:00`,
  });
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
  // BUG FIX: VIX and 10Y Yield ride along in the `indices` array as
  // pseudo-index rows, so they used to go through the same "index level"
  // formatting as a real index. That gave the 10-year yield a bare "4.6"
  // with no percent sign (it is a rate — the /archive index page prints the
  // identical market_summary.ten_year_yield field as "4.6%"), and its
  // change_pct is a RELATIVE percent change of the yield, not a move in
  // percentage points (+1.32% here is about +0.06 percentage points, i.e.
  // "6bps"), so next to a bare level it reads as a 1.32-point move. Neither
  // row has a correctly-scaled change figure in this data, so — matching how
  // /archive's index page already handles the same two fields — the real
  // indices are rendered from `indices` as before, and VIX / 10Y Yield are
  // rendered separately from the scalar market_summary.vix /
  // .ten_year_yield fields with their own unit and a dash for Change rather
  // than a misleading percent.
  // On the five mornings the index fetch failed, all four real index rows are
  // `NaN` — now that they parse, a row would print "NaN" at "NaN%".
  const coreIndices = indices.filter((x: Any) => !(x.ticker in ROW_TERMS) && Number.isFinite(Number(x.price)));
  const vix = d?.market_summary?.vix;
  const tenYearYield = d?.market_summary?.ten_year_yield;
  const narrativeRepeatOf = repeatOf(date, d?.narrative);
  const narrative = narrativeRepeatOf ? '' : narrativeText(d);
  const geo: Any[] = (d?.geopolitical ?? []).slice(0, 6);
  // A premarket scan is a same-morning artifact, and this corpus holds exactly
  // one of them: 50 of the 76 archived files carry setups and every one is the
  // same scan — MSFT at 426.989990234375 throughout — spread over seven weeks,
  // 2026-06-04 … 2026-07-27. The two "first publications" an origin-keeps-it
  // rule left standing (06-04, 06-08) are that same scan differing only in
  // signal spelling ("neutral rsi" vs "neutral_rsi", which signalLabel() below
  // renders identically), so neither is a first publication at all. Nothing in
  // the payload can say which morning it ran, so a scan carrying more than one
  // date is dropped from all of them. This stays a repeat rule rather than a
  // deletion of the section because a scan published under exactly one date is
  // that date's own and still renders.
  const setups: Any[] =
    publishedOn(d?.premarket_top_setups).length > 1 ? [] : (d?.premarket_top_setups ?? []).slice(0, 6);
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
    description: describe(date, d),
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

      {(coreIndices.length > 0 || vix != null || tenYearYield != null) && (
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
                {coreIndices.map((x: Any) => (
                  <tr key={x.ticker} className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    <td className="px-3 py-2 text-[var(--color-text-primary)]">{x.ticker}</td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-secondary)]">{Number(x.price).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right" style={{ color: x.change_pct >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}>
                      {x.change_pct >= 0 ? '+' : ''}{Number(x.change_pct).toFixed(2)}%
                    </td>
                  </tr>
                ))}
                {vix != null && (
                  <tr className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    <td className="px-3 py-2 text-[var(--color-text-primary)]">
                      <InfoTip term={ROW_TERMS.VIX}>VIX</InfoTip>
                      <PlainLabel term={ROW_TERMS.VIX} />
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-secondary)]">{Number(vix).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-tertiary)]">—</td>
                  </tr>
                )}
                {tenYearYield != null && (
                  <tr className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    <td className="px-3 py-2 text-[var(--color-text-primary)]">
                      <InfoTip term={ROW_TERMS['10Y Yield']}>10Y Yield</InfoTip>
                      <PlainLabel term={ROW_TERMS['10Y Yield']} />
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-secondary)]">{Number(tenYearYield).toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-tertiary)]">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {narrativeRepeatOf && (
        <Section title="Morning Analysis">
          <p className="text-sm text-[var(--color-text-secondary)]">
            No new analysis was written for this date — the briefing repeated the note
            first published on{' '}
            <Link href={`/archive/${narrativeRepeatOf}/`} className="underline text-[var(--color-accent)]">
              {longDate(narrativeRepeatOf)}
            </Link>
            , so it is not reprinted here as that morning&apos;s reading.
          </p>
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
