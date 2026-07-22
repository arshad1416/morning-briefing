// app/research/research-client.tsx — consolidated reading room, ported from the
// legacy SPA. Tabs: Overview (audio briefing + AI narrative + central banks +
// insider/earnings), News, Reddit sentiment, Ideas, MapleGamma Analysis (Basic),
// Backtest (Pro), Prediction Markets (Basic), Earnings (Basic), SEC (Basic).
//
// Public tabs read Pages /data/*; premium tabs go through the Worker data gate
// and render a GateCard on 401/403 — the server decides, the UI reflects it.
'use client';

import React, { useEffect, useState } from 'react';
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
  const [today, setToday] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setToday(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date()));
  }, []);

  if (!today) return null;

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
          <p className="text-xs text-[var(--color-text-tertiary)]" data-numeric>{today}</p>
        </div>
        {missing ? (
          <span className="text-sm text-[var(--color-text-tertiary)]">No briefing yet for today</span>
        ) : (
          <audio
            controls
            preload="none"
            className="h-9 max-w-[280px]"
            onError={() => setMissing(true)}
          >
            <source src={`/data/audio/briefing-${today}.mp3`} type="audio/mpeg" onError={() => setMissing(true)} />
          </audio>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Loose data shapes (defensive access, schemas drift)               */
/* ------------------------------------------------------------------ */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

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
                  <div key={i} className="py-3 first:pt-0 last:pb-0">
                    <Badge tone={idea.type === 'BULLISH_CONVERGENCE' ? 'bull' : idea.type === 'BEARISH_CONVERGENCE' ? 'bear' : 'caution'}>
                      {String(idea.type || '').replace(/_/g, ' ')}
                    </Badge>
                    <p className="mt-1.5 text-sm font-semibold text-[var(--color-text-primary)]" data-numeric>
                      {(idea.tickers || []).join(', ')}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{idea.signal}</p>
                    {idea.action && <p className="text-sm" style={{ color: 'var(--color-accent)' }}>{idea.action}</p>}
                  </div>
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
    </div>
  );
}

function MgAnalysisTab() {
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
                <p className="text-sm leading-relaxed text-[var(--color-text-primary)]">{d.market_pulse.one_liner}</p>
                <p className="mt-2 text-xs text-[var(--color-text-tertiary)]" data-numeric>
                  Sentiment: {d.market_pulse.sentiment_score}/10
                </p>
                {d.market_pulse.sector_rotation && (
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{d.market_pulse.sector_rotation}</p>
                )}
                {d.market_pulse.key_levels?.SPY && (
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]" data-numeric>
                    SPY support: ${d.market_pulse.key_levels.SPY.support} / resistance: ${d.market_pulse.key_levels.SPY.resistance}
                  </p>
                )}
              </Card>
            )}
            <Card title="Position Review">
              {positions.length ? (
                <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  {positions.map((p: Any, i: number) => (
                    <div key={i} className="py-2.5 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge tone={p.action === 'ADD' ? 'bull' : p.action === 'TRIM' || p.action === 'EXIT' ? 'bear' : 'caution'}>{p.action}</Badge>
                        <span className="font-semibold text-[var(--color-text-primary)]" data-numeric>{p.ticker}</span>
                        {p.asset_class && <Badge tone="caution">{String(p.asset_class).toUpperCase()}</Badge>}
                        <span className="text-xs text-[var(--color-text-tertiary)]" data-numeric>
                          {[p.target && `Target $${p.target}`, p.stop && `Stop $${p.stop}`, p.risk_reward && `R/R ${p.risk_reward}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </div>
                      {p.rationale && <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{p.rationale}</p>}
                    </div>
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
                    <div key={i} className="py-2.5 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge tone={o.direction === 'LONG' ? 'bull' : 'bear'}>{o.direction}</Badge>
                        <span className="font-semibold text-[var(--color-text-primary)]" data-numeric>{o.ticker}</span>
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          {[o.conviction && `${o.conviction} conviction`, o.timeframe].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                      {o.thesis && <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{o.thesis}</p>}
                      {!!o.entry_zone?.length && (
                        <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]" data-numeric>
                          Entry zone: ${o.entry_zone[0]}–${o.entry_zone[1]}
                          {o.catalyst ? ` · ${o.catalyst}` : ''}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {!!d.risk_alerts?.length && (
              <Card title="Risk Alerts">
                <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  {d.risk_alerts.map((r: Any, i: number) => (
                    <div key={i} className="py-2.5 first:pt-0 last:pb-0 text-sm">
                      <Badge tone={r.severity === 'high' ? 'bear' : r.severity === 'medium' ? 'caution' : 'bull'}>
                        {String(r.severity || '').toUpperCase()}
                      </Badge>{' '}
                      <span className="text-[var(--color-text-secondary)]">{r.alert}</span>
                      {!!r.affected_positions?.length && (
                        <p className="text-xs text-[var(--color-text-tertiary)]" data-numeric>Affects: {r.affected_positions.join(', ')}</p>
                      )}
                    </div>
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
              <Grid2>
                {d.transcripts.slice(0, 10).map((tr: Any, i: number) => (
                  <Card key={i} title={`${tr.ticker || ''} — ${tr.quarter || ''}`}>
                    <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                      {String(tr.summary || tr.content || '').substring(0, 600)}…
                    </p>
                  </Card>
                ))}
              </Grid2>
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
