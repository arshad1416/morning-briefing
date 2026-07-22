// app/ticker/ticker-client.tsx — single-ticker deep dive, ported from the
// legacy ticker-detail.js. Reads the public /data/tickers/{T}.json (ungated —
// same as legacy) plus the premarket scan entry from latest.json.
'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { InfoTip, PlainLabel } from '@/components/primitives';
import type { GlossaryTerm } from '@/lib/glossary';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const fetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const fmtPrice = (v: number | null | undefined) =>
  v == null ? '—' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Stat-card label with its plain-English tooltip. The term stays visible as the
// label; the tooltip only explains it. Wording always comes from @/lib/glossary.
function TermLabel({ term, children }: { term: GlossaryTerm; children: React.ReactNode }) {
  return <InfoTip term={term}>{children}</InfoTip>;
}

// `caption` is the always-on plain-English gloss for the pure acronyms a
// beginner cannot even guess at (RSI, SMA, ATR, P/E, EPS, IV Rank). It renders
// BELOW the number, not under the label: these cards sit in a stretch grid, so
// a caption between label and value would push that card's number a line lower
// than its uncaptioned row-mates and break the row's alignment.
function StatCard({ label, value, sub, caption, color }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; caption?: GlossaryTerm; color?: string }) {
  return (
    <div
      className="rounded-[var(--radius-tile)] border p-4"
      style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-1 text-xl font-bold" data-numeric style={{ color: color ?? 'var(--color-text-primary)' }}>{value}</p>
      {caption && <PlainLabel term={caption} className="mt-1" />}
      {sub}
    </div>
  );
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">{title}</h2>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[var(--radius-tile)] border p-4"
      style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
    >
      {children}
    </div>
  );
}

function Badge({ tone, children }: { tone: 'bull' | 'bear' | 'caution'; children: React.ReactNode }) {
  const color = tone === 'bull' ? 'var(--color-bull)' : tone === 'bear' ? 'var(--color-bear)' : 'var(--color-caution)';
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      {children}
    </span>
  );
}

export function TickerClient({ initialTicker }: { initialTicker?: string }) {
  const params = useSearchParams();
  const ticker = (initialTicker || params.get('symbol') || '').toUpperCase();

  const latest = useQuery<Any>({ queryKey: ['latest-raw'], queryFn: () => fetchJson('/data/latest.json'), staleTime: 300_000, retry: false, enabled: !!ticker });
  const detail = useQuery<Any>({
    queryKey: ['ticker', ticker],
    queryFn: () => fetchJson(`/data/tickers/${encodeURIComponent(ticker)}.json`),
    staleTime: 300_000,
    retry: false,
    enabled: !!ticker,
  });

  if (!ticker) {
    return (
      <Card>
        <p className="text-sm text-[var(--color-text-secondary)]">
          No stock selected — pick one from the <Link href="/screener/" className="font-medium text-[var(--color-accent)] hover:underline">Screener</Link>, our list of scanned stocks and funds.
        </p>
      </Card>
    );
  }

  const t: Any = detail.data || {};
  const scan: Any = latest.data?.premarket_top_setups?.find((s: Any) => s.ticker === ticker) || {};
  const loading = detail.isLoading || latest.isLoading;

  if (!loading && !detail.data && !Object.keys(scan).length) {
    return (
      <Card>
        <p className="text-sm text-[var(--color-text-secondary)]" data-numeric>No data available for {ticker}.</p>
      </Card>
    );
  }

  const price = t.price ?? scan.price;
  const changePct = t.change_pct ?? scan.change_pct;
  const score = t.council_analysis?.score ?? scan.score;
  const verdict = t.council_analysis?.verdict ?? scan.council_verdict;
  const tech = t.technical;
  const f = t.fundamentals;
  const o = t.options;
  const ca = t.council_analysis;

  return (
    <div className="space-y-4">
      <div
        className="relative overflow-hidden rounded-[var(--radius-tile)] border p-6"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
      >
        <span aria-hidden="true" className="glow-orb -top-24 -right-8" />
        <div className="relative z-10 flex flex-wrap items-baseline gap-3">
          <h1 className="font-display text-3xl text-[var(--color-text-primary)]" data-numeric>{ticker}</h1>
          {t.name && <span className="text-sm text-[var(--color-text-secondary)]">{t.name}</span>}
        </div>
      </div>

      {loading ? (
        <p className="p-8 text-center text-sm text-[var(--color-text-tertiary)]" data-numeric>Loading {ticker}…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Price"
              value={fmtPrice(price)}
              sub={
                changePct != null ? (
                  <p className="text-sm font-medium" data-numeric style={{ color: changePct >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}>
                    {changePct >= 0 ? '+' : ''}{Number(changePct).toFixed(2)}%
                  </p>
                ) : undefined
              }
            />
            {score != null && <StatCard label="Score" value={Number(score).toFixed(1)} />}
            {verdict && (
              <StatCard
                label="AI Verdict"
                value={<Badge tone={verdict === 'bullish' ? 'bull' : verdict === 'bearish' ? 'bear' : 'caution'}>{verdict}</Badge>}
                sub={
                  <p className="mt-1.5 text-[10px] leading-snug text-[var(--color-text-tertiary)]">
                    From the <InfoTip term="ai_council">AI Council</InfoTip> — a panel of AI models.
                  </p>
                }
              />
            )}
            {f?.market_cap && <StatCard label={<TermLabel term="market_cap">Market Cap</TermLabel>} value={f.market_cap} />}
          </div>

          {tech && (
            <Section title={<InfoTip term="technicals">Technicals</InfoTip>}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {tech.rsi_14 != null && <StatCard label={<TermLabel term="rsi">RSI (14)</TermLabel>} caption="rsi" value={tech.rsi_14} />}
                {tech.sma_20 != null && <StatCard label={<TermLabel term="sma_20">SMA 20</TermLabel>} caption="sma_20" value={fmtPrice(tech.sma_20)} />}
                {tech.sma_50 != null && <StatCard label={<TermLabel term="sma_50">SMA 50</TermLabel>} caption="sma_50" value={fmtPrice(tech.sma_50)} />}
                {tech.support_1 != null && <StatCard label={<TermLabel term="support">Support</TermLabel>} value={fmtPrice(tech.support_1)} color="var(--color-bull)" />}
                {tech.resistance_1 != null && <StatCard label={<TermLabel term="resistance">Resistance</TermLabel>} value={fmtPrice(tech.resistance_1)} color="var(--color-bear)" />}
                {tech.atr != null && <StatCard label={<TermLabel term="atr">ATR</TermLabel>} caption="atr" value={fmtPrice(tech.atr)} />}
              </div>
            </Section>
          )}

          {f && (f.pe_ratio || f.eps || f.beta || f.dividend_yield) && (
            <Section title={<InfoTip term="fundamentals">Fundamentals</InfoTip>}>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {f.pe_ratio && <StatCard label={<TermLabel term="p_e">P/E</TermLabel>} caption="p_e" value={f.pe_ratio} />}
                {f.eps && <StatCard label={<TermLabel term="eps">EPS</TermLabel>} caption="eps" value={`$${f.eps}`} />}
                {f.beta && <StatCard label={<TermLabel term="beta">Beta</TermLabel>} value={f.beta} />}
                {f.dividend_yield != null && f.dividend_yield !== 0 && (
                  <StatCard label={<TermLabel term="div_yield">Div Yield</TermLabel>} value={`${(f.dividend_yield * 100).toFixed(2)}%`} />
                )}
              </div>
            </Section>
          )}

          {/* Renamed from "Options Flow" — these three readings are a
              point-in-time snapshot, which "flow" does not convey. Note we do
              NOT currently know whether put_call_ratio is volume-based (the
              glossary says trading volume) or open-interest-based: no generator
              in this repo produces the `options` block and no file in
              data/tickers/ ships one, so this section is dead code today.
              Confirm against the Pi pipeline before describing it either way. */}
          {o && (o.put_call_ratio != null || o.max_pain != null || o.iv_rank != null) && (
            <Section title="Options Snapshot">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {o.put_call_ratio != null && <StatCard label={<TermLabel term="put_call_ratio">P/C Ratio</TermLabel>} caption="put_call_ratio" value={Number(o.put_call_ratio).toFixed(2)} />}
                {o.max_pain != null && <StatCard label={<TermLabel term="max_pain">Max Pain</TermLabel>} caption="max_pain" value={`$${o.max_pain}`} />}
                {o.iv_rank != null && <StatCard label={<TermLabel term="iv_rank">IV Rank</TermLabel>} caption="iv_rank" value={`${o.iv_rank}%`} />}
              </div>
            </Section>
          )}

          {/* "Council" reads like a committee of humans, so the heading says
              "AI" first — but the name is kept, not dropped: /predictions is
              titled "AI Council Predictions" and names the models, and this is
              the same feature. Deleting the word here would leave a reader
              unable to tell the two surfaces apart. */}
          {(ca?.bull_case || ca?.bear_case || ca?.risk_assessment) && (
            <Section title={<><InfoTip term="ai_council">AI Council</InfoTip> Analysis</>}>
              <Card>
                <div className="space-y-4">
                  {ca.bull_case && (
                    <div>
                      <Badge tone="bull">Bull Case</Badge>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">{ca.bull_case}</p>
                    </div>
                  )}
                  {ca.bear_case && (
                    <div>
                      <Badge tone="bear">Bear Case</Badge>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">{ca.bear_case}</p>
                    </div>
                  )}
                  {ca.risk_assessment && (
                    <div>
                      <Badge tone="caution">Risk Assessment</Badge>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">{ca.risk_assessment}</p>
                    </div>
                  )}
                </div>
              </Card>
            </Section>
          )}

          {scan.council_summary && !ca && (
            <Section title={<><InfoTip term="ai_council">AI Council</InfoTip> Summary</>}>
              <Card>
                <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{scan.council_summary}</p>
              </Card>
            </Section>
          )}

          {/* Despite the field name, `upcoming_earnings` is not upcoming-only:
              every file that ships it also carries the last two REPORTED
              quarters (and some, e.g. CB, carry no future date at all). So the
              heading cannot promise "upcoming", and the estimate column cannot
              be labelled a forecast on its own — the reported figure lives in
              the same row as `epsActual` and is shown beside it. */}
          {!!t.upcoming_earnings?.length && (
            <Section title={<InfoTip term="earnings">Earnings Dates</InfoTip>}>
              <Card>
                <p className="mb-2 text-xs text-[var(--color-text-tertiary)]">
                  Recent and upcoming report dates. Forecast is what analysts expected the company to earn per share
                  (<InfoTip term="eps">EPS</InfoTip>); Actual is what it went on to report, and shows a dash for a
                  quarter that has not been reported yet.
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                      <th scope="col" className="pb-2 text-left font-medium">Report date</th>
                      <th scope="col" className="pb-2 text-right font-medium">Forecast</th>
                      <th scope="col" className="pb-2 text-right font-medium">Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.upcoming_earnings.map((e: Any, i: number) => (
                      <tr key={i} className="border-t first:border-t-0" style={{ borderColor: 'var(--color-border-subtle)' }}>
                        <td className="py-2 text-[var(--color-text-secondary)]" data-numeric>{e.date}</td>
                        <td className="py-2 text-right" data-numeric>{e.epsEstimate != null ? `$${Number(e.epsEstimate).toFixed(2)}` : '—'}</td>
                        <td className="py-2 text-right" data-numeric>{e.epsActual != null ? `$${Number(e.epsActual).toFixed(2)}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </Section>
          )}

          {!!t.recent_sec_filings?.length && (
            <Section title="Recent SEC Filings">
              <Card>
                <p className="mb-2 text-xs text-[var(--color-text-tertiary)]">
                  Reports {ticker} files with the US Securities and Exchange Commission (SEC), the regulator that oversees
                  American stock markets.
                </p>
                <table className="w-full text-sm">
                  <tbody>
                    {t.recent_sec_filings.map((fl: Any, i: number) => (
                      <tr key={i} className="border-t first:border-t-0" style={{ borderColor: 'var(--color-border-subtle)' }}>
                        <td className="py-2 text-[var(--color-text-secondary)]" data-numeric>{fl.date}</td>
                        <td className="py-2 text-[var(--color-text-secondary)]">{fl.form}</td>
                        <td className="py-2 text-right">
                          <a
                            href={/^https?:\/\//i.test(fl.url || '') ? fl.url : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-[var(--color-accent)] hover:underline"
                          >
                            Read on SEC.gov ↗
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </Section>
          )}

          {!!t.reddit_mentions?.length && (
            <Section title="Reddit Mentions">
              <Card>
                <div className="flex flex-wrap gap-1.5">
                  {t.reddit_mentions.map((m: Any, i: number) => (
                    <Badge key={i} tone="bull">r/{m.sub} · {m.count} {m.count === 1 ? 'mention' : 'mentions'}</Badge>
                  ))}
                </div>
              </Card>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
