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
  const description = raw
    ? `${raw.slice(0, 152)}…`
    : `MapleGamma daily market briefing for ${longDate(date)}: S&P 500 regime, key levels, dealer gamma and macro analysis.`;
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
        <p className="text-sm text-[var(--color-text-tertiary)]">
          Generated by the MapleGamma AI council before the open. Simulated (paper-trading)
          analysis for educational purposes — not financial advice.
        </p>
      </header>

      {indices.length > 0 && (
        <Section title="Market Snapshot">
          <div className="overflow-x-auto rounded-[var(--radius-tile)] border" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <table className="w-full text-sm" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr className="border-b text-left" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <th className="px-3 py-2 text-xs font-medium text-[var(--color-text-tertiary)]">Index</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[var(--color-text-tertiary)]">Level</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[var(--color-text-tertiary)]">Change</th>
                </tr>
              </thead>
              <tbody>
                {indices.map((x: Any) => (
                  <tr key={x.ticker} className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    <td className="px-3 py-2 text-[var(--color-text-primary)]">{x.ticker}</td>
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
          <ul className="space-y-1 text-sm text-[var(--color-text-secondary)]">
            {setups.map((s: Any) => (
              <li key={s.ticker}>
                <strong className="text-[var(--color-text-primary)]">{s.ticker}</strong>
                {' '}— score {s.score}, {s.change_pct >= 0 ? '+' : ''}{Number(s.change_pct).toFixed(2)}%
                {Array.isArray(s.signals) && s.signals.length > 0 && ` (${s.signals.slice(0, 3).join(', ')})`}
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
        <p className="text-sm text-[var(--color-text-secondary)]">
          See today&apos;s live <Link href="/options/" className="underline text-[var(--color-accent)]">dealer gamma exposure and flip levels</Link>,
          the free <Link href="/dashboard/" className="underline text-[var(--color-accent)]">market dashboard</Link>,
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
