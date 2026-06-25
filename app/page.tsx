"use client";

import { Activity, BarChart3, Newspaper, Briefcase } from "lucide-react";
import { Surface, SurfaceHeader } from "@/components/primitives/surface";
import { Stat } from "@/components/primitives/stat";
import { DeltaBadge } from "@/components/primitives/delta-badge";
import { RegimeChip } from "@/components/primitives/regime-chip";
import { DataFreshness } from "@/components/primitives/data-freshness";
import { BentoGrid, BentoItem } from "@/components/primitives/bento-grid";
import { VerdictBar } from "@/components/verdict-bar";
import { EarningsIntelligence } from "@/components/features/earnings-intelligence";
import { ScenarioSimulator } from "@/components/features/scenario-simulator";
import { TimeMachine } from "@/components/features/time-machine";
import { CompareMode } from "@/components/features/compare-mode";
import { AlertRuleBuilder } from "@/components/features/alert-rule-builder";
import { useMarket, useOptions, useWatchlist, useNews } from "@/lib/queries";
import { fmtUsd } from "@/lib/format";

export default function Dashboard() {
  const market = useMarket();
  const options = useOptions();
  const watchlist = useWatchlist();
  const news = useNews();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">MapleGamma Dashboard</h1>

      <VerdictBar />

      <BentoGrid>
        <BentoItem span={8}>
          <Surface as="section" aria-labelledby="mkt-h" className="h-full">
            <SurfaceHeader title={<span id="mkt-h" className="flex items-center gap-2"><Activity className="size-4 text-brand" aria-hidden /> Market Overview</span>}>
              <DataFreshness asOf={market.data?.asOf} status={market.data?.status} />
            </SurfaceHeader>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 p-4 sm:grid-cols-4">
              {(market.data?.indices ?? []).map((ix) => (
                <Stat key={ix.symbol} label={ix.name} value={ix.last.toLocaleString()} delta={ix.changePct} />
              ))}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">VIX</span>
                <div className="flex items-center gap-2">
                  <span className="nums text-2xl font-semibold text-fg">{market.data?.vix.level ?? "—"}</span>
                  {market.data?.vix.regime ? <RegimeChip regime={market.data.vix.regime} /> : null}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border p-4 sm:grid-cols-4">
              <Stat label="Equity" value={fmtUsd(market.data?.account.equity, { compact: true })} hint="Total value of the $100K demo account." />
              <Stat label="Day P&L" value={fmtUsd(market.data?.account.dayPnl)} delta={market.data?.account.dayPnlPct} />
              <Stat label="Deployed" value={`${market.data?.account.deployedPct ?? "—"}%`} hint="Share of capital currently in open positions." />
            </div>
          </Surface>
        </BentoItem>

        <BentoItem span={4}>
          <Surface as="section" aria-labelledby="opt-h" className="h-full">
            <SurfaceHeader title={<span id="opt-h" className="flex items-center gap-2"><BarChart3 className="size-4 text-brand" aria-hidden /> Options &amp; GEX</span>}>
              {options.data?.regime ? <RegimeChip regime={options.data.regime} /> : null}
            </SurfaceHeader>
            <div className="grid grid-cols-2 gap-4 p-4">
              <Stat label="GEX" value={options.data?.gex?.toLocaleString() ?? "—"} hint="Gamma exposure: how dealer hedging dampens (positive) or amplifies (negative) moves." />
              <Stat label="DEX" value={options.data?.dex?.toLocaleString() ?? "—"} hint="Delta exposure — net directional positioning of dealers." />
              <Stat label="Max Pain" value={options.data?.maxPain?.toLocaleString() ?? "—"} hint="Strike where the most options expire worthless." />
              <Stat label="Zero Gamma" value={options.data?.zeroGamma?.toLocaleString() ?? "—"} hint="Level where dealer gamma flips sign — volatility regime pivot." />
            </div>
          </Surface>
        </BentoItem>

        <BentoItem span={6}>
          <Surface as="section" aria-labelledby="q-h" className="h-full">
            <SurfaceHeader title={<span id="q-h" className="flex items-center gap-2"><Briefcase className="size-4 text-brand" aria-hidden /> Action Queue</span>} />
            <ul className="divide-y divide-border">
              {(watchlist.data?.queue ?? []).slice(0, 6).map((it) => (
                <li key={it.ticker} className="flex items-center gap-3 px-4 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${it.type === "SETUP" ? "bg-brand/10 text-brand" : "bg-info/10 text-info"}`}>
                    {it.type}
                  </span>
                  <span className="nums w-14 text-sm font-semibold text-fg">{it.ticker}</span>
                  <span className="flex-1 text-sm text-fg-muted">{it.signal}</span>
                  <DeltaBadge value={it.changePct} />
                </li>
              ))}
              {(!watchlist.data || watchlist.data.queue.length === 0) && (
                <li className="px-4 py-6 text-center text-sm text-fg-subtle">No setups in the queue.</li>
              )}
            </ul>
          </Surface>
        </BentoItem>

        <BentoItem span={6}>
          <Surface as="section" aria-labelledby="news-h" className="h-full">
            <SurfaceHeader title={<span id="news-h" className="flex items-center gap-2"><Newspaper className="size-4 text-brand" aria-hidden /> Geopolitical News</span>} />
            <ul className="divide-y divide-border">
              {(news.data ?? []).slice(0, 6).map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center text-sm text-fg hover:text-brand">
                    <span className="line-clamp-1">{n.headline}</span>
                  </a>
                  <span className="text-xs text-fg-subtle">{n.source}</span>
                </li>
              ))}
              {(!news.data || news.data.length === 0) && (
                <li className="px-4 py-6 text-center text-sm text-fg-subtle">No headlines available.</li>
              )}
            </ul>
          </Surface>
        </BentoItem>
      </BentoGrid>

      <section aria-labelledby="labs-h" className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <h2 id="labs-h" className="text-sm font-semibold uppercase tracking-wide text-fg-muted">MapleGamma Labs</h2>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </div>
        <BentoGrid>
          <BentoItem span={4}><EarningsIntelligence /></BentoItem>
          <BentoItem span={4}><ScenarioSimulator /></BentoItem>
          <BentoItem span={4}><CompareMode /></BentoItem>
          <BentoItem span={6}><AlertRuleBuilder /></BentoItem>
          <BentoItem span={6}><TimeMachine /></BentoItem>
        </BentoGrid>
      </section>
    </div>
  );
}
