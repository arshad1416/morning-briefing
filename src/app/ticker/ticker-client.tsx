// app/ticker/ticker-client.tsx — single-ticker deep dive, ported from the
// legacy ticker-detail.js. Reads the public /data/tickers/{T}.json (ungated —
// same as legacy) plus the premarket scan entry from latest.json.
'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const fetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const fmtPrice = (v: number | null | undefined) =>
  v == null ? '—' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function StatCard({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: React.ReactNode; color?: string }) {
  return (
    <div
      className="rounded-[var(--radius-tile)] border p-4"
      style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-1 text-xl font-bold" data-numeric style={{ color: color ?? 'var(--color-text-primary)' }}>{value}</p>
      {sub}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
          No ticker specified — pick one from the <Link href="/screener/" className="font-medium text-[var(--color-accent)] hover:underline">Screener</Link>.
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
                label="Council Verdict"
                value={<Badge tone={verdict === 'bullish' ? 'bull' : verdict === 'bearish' ? 'bear' : 'caution'}>{verdict}</Badge>}
              />
            )}
            {f?.market_cap && <StatCard label="Market Cap" value={f.market_cap} />}
          </div>

          {tech && (
            <Section title="Technicals">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {tech.rsi_14 != null && <StatCard label="RSI (14)" value={tech.rsi_14} />}
                {tech.sma_20 != null && <StatCard label="SMA 20" value={fmtPrice(tech.sma_20)} />}
                {tech.sma_50 != null && <StatCard label="SMA 50" value={fmtPrice(tech.sma_50)} />}
                {tech.support_1 != null && <StatCard label="Support" value={fmtPrice(tech.support_1)} color="var(--color-bull)" />}
                {tech.resistance_1 != null && <StatCard label="Resistance" value={fmtPrice(tech.resistance_1)} color="var(--color-bear)" />}
                {tech.atr != null && <StatCard label="ATR" value={fmtPrice(tech.atr)} />}
              </div>
            </Section>
          )}

          {f && (f.pe_ratio || f.eps || f.beta || f.dividend_yield) && (
            <Section title="Fundamentals">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {f.pe_ratio && <StatCard label="P/E" value={f.pe_ratio} />}
                {f.eps && <StatCard label="EPS" value={`$${f.eps}`} />}
                {f.beta && <StatCard label="Beta" value={f.beta} />}
                {f.dividend_yield != null && f.dividend_yield !== 0 && (
                  <StatCard label="Div Yield" value={`${(f.dividend_yield * 100).toFixed(2)}%`} />
                )}
              </div>
            </Section>
          )}

          {o && (o.put_call_ratio != null || o.max_pain != null || o.iv_rank != null) && (
            <Section title="Options Flow">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {o.put_call_ratio != null && <StatCard label="P/C Ratio" value={Number(o.put_call_ratio).toFixed(2)} />}
                {o.max_pain != null && <StatCard label="Max Pain" value={`$${o.max_pain}`} />}
                {o.iv_rank != null && <StatCard label="IV Rank" value={`${o.iv_rank}%`} />}
              </div>
            </Section>
          )}

          {(ca?.bull_case || ca?.bear_case || ca?.risk_assessment) && (
            <Section title="Council Analysis">
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
            <Section title="Council Verdict">
              <Card>
                <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{scan.council_summary}</p>
              </Card>
            </Section>
          )}

          {!!t.upcoming_earnings?.length && (
            <Section title="Upcoming Earnings">
              <Card>
                <table className="w-full text-sm">
                  <tbody>
                    {t.upcoming_earnings.map((e: Any, i: number) => (
                      <tr key={i} className="border-t first:border-t-0" style={{ borderColor: 'var(--color-border-subtle)' }}>
                        <td className="py-2 text-[var(--color-text-secondary)]" data-numeric>{e.date}</td>
                        <td className="py-2 text-right" data-numeric>{e.epsEstimate != null ? `$${Number(e.epsEstimate).toFixed(2)} est.` : '—'}</td>
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
                            EDGAR ↗
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
                    <Badge key={i} tone="bull">r/{m.sub} · {m.count}</Badge>
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
