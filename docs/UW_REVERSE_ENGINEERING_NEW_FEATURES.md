# MapleGamma — New Feature Ideas from UW Reverse Engineering

> Created: July 22, 2026
> Source: Unusual Whales API 7-day trial (expires July 28, 2026)
> Seed data: `compceiling/uw_reverse_engineering/seed_data/` — 1,306 JSON files, 46.5 MB, 50 tickers
> Reverse-engineering report: `compceiling/uw_reverse_engineering/REVERSE_ENGINEERING_REPORT.md`

---

## Shipped (July 22, 2026)

| Feature | Tier | Status | Files |
|---|---|---|---|
| **Max Pain Calculator** | Pro ($99/mo) | ✅ Shipped — ProGate-wrapped, verified 5/5 SPY expiries match UW exactly | `pi-scripts/options-intelligence/max_pain_calculator.py`, `src/components/feature/options/MaxPainCard.tsx` |
| **MaxPainCard** | Pro ($99/mo) | ✅ Shipped — follows NopeCard pattern, uses gexQuery() | `src/components/feature/options/MaxPainCard.tsx` |

### Verfied correct (already existed)

| Feature | Tier | Status |
|---|---|---|
| NOPE Calculator + NopeCard | Pro ($99/mo) | ✅ Verified — formula `(call_delta + put_delta) / stock_vol`, R²=1.0000 |
| Market Tide Calculator | Pro ($99/mo) | ✅ Verified — sign convention (ask +, bid −, mid 0), $2M cap left as design choice |
| GEX/Dex/Vex + calibration | Pro ($99/mo) | ✅ Verified — R²>95% from July 14 calibration |

---

## Premium Tier ($150/mo) — Feature Ideas (data harvested, frontend NOT built)

The harvested seed data is ready to power a future Premium tier. These become shippable features once frontend cards/charts are built to consume the data.

### Volatility Suite (primary Premium bundle)

| Feature | Seed data ready? | Frontend built? | UW endpoint that was harvested |
|---|---|---|---|
| **IV Rank indicator** | ✅ 1-yr rolling × 50 tickers | ❌ | `/api/stock/{t}/iv-rank` |
| **IV Term Structure chart** | ✅ 34 expiries × 50 tickers | ❌ | `/api/stock/{t}/volatility/term-structure` |
| **Risk Reversal Skew chart** | ✅ 90-day history × 50 tickers | ❌ | `/api/stock/{t}/historical-risk-reversal-skew` |
| **Realized Vol chart** | ✅ 1-yr daily × 50 tickers | ❌ | `/api/stock/{t}/volatility/realized` |
| **Volatility Anomaly alerts** | ✅ per ticker | ❌ | `/api/stock/{t}/volatility/anomaly` |
| **Volatility Character** | ✅ per ticker | ❌ | `/api/stock/{t}/volatility/character` |
| **Variance Risk Premium chart** | ✅ ~36KB/ticker | ❌ | `/api/stock/{t}/volatility/variance-risk-premium` |
| **VIX Term Structure** | ✅ market-wide | ❌ | `/api/volatility/vix-term-structure` |
| **Vol regime classifier (ML)** | ✅ all vol data harvested | ❌ — needs ML model | Train on 1-yr realized vol + IV rank |

### Flow & Darkpool Suite (secondary Premium bundle)

| Feature | Seed data ready? | Frontend built? | UW endpoint |
|---|---|---|---|
| **Darkpool blocks card** | ✅ 500 trades × 50 tickers | ❌ | `/api/darkpool/{t}` |
| **Options flow feed** | ✅ full intraday × 50 tickers | ❌ | `/api/stock/{t}/flow-recent` |
| **Flow per strike heatmap** | ✅ per ticker | ❌ | `/api/stock/{t}/flow-per-strike` |
| **Greek flow (dir delta/vega)** | ✅ per ticker | ❌ | `/api/stock/{t}/greek-flow` |
| **Lit flow** | ✅ market-wide | ❌ | `/api/lit-flow/recent` |
| **Options Pulse** | ✅ top/sectors | ❌ | `/api/options-pulse/*` |
| **Net flow per expiry** | ✅ market-wide | ❌ | `/api/net-flow/expiry` |

### GEX Advanced (already partially in Pro — could be elevated)

| Feature | Seed data ready? | Frontend built? | Notes |
|---|---|---|---|
| **GEX levels tracker (flip/walls/magnet)** | ✅ per ticker | Partial — GammaWallChart exists in Pro | Could add magnet + historical flip tracking |
| **Spot exposures by strike** | ✅ per ticker | Partial — GexDexVexCard exists | Could add deeper strike-level drilldown |
| **Greek exposure by expiry** | ✅ per ticker | ❌ | New expiry-based GEX view |

---

## Tier Strategy Recommendation

### Current live tiers (from `LandingPage.tsx`)
- **Free** ($0) — daily regime, GEX/DEX/VEX snapshot
- **Basic** ($49/mo CAD) — screener, research desk, predictions
- **Pro** ($99/mo CAD) — charts, gamma walls, NOPE, **Max Pain** (new), calibration, prediction engine

### Recommendation: Don't create a new tier yet

**Only one genuinely new user-facing feature shipped (Max Pain).** NOPE, Market Tide, and GEX already existed — they were verified against the institutional engine, not newly created. That's not enough to justify a new tier.

- **Max Pain → Pro** (already done — ProGate-wrapped as `maxPain`)
- **Volatility Suite → future Premium ($150/mo)** — but only once frontend is built
- **Flow/Darkpool Suite → future Premium or Pro** — once frontend is built

**Trigger for a new $150/mo Premium tier:** Ship the Volatility Suite (IV Rank + IV Term Structure + Skew + VRP as frontend cards/charts). At that point you'd have a cohesive premium feature bundle worth $150/mo, and the 50-ticker seed data is already harvested to power it. Right now the data is ready but no frontend exists to put behind a paywall.

---

## Key Files

| File | Location |
|---|---|
| Reverse-engineering report | `compceiling/uw_reverse_engineering/REVERSE_ENGINEERING_REPORT.md` |
| Seed data (50 tickers) | `compceiling/uw_reverse_engineering/seed_data/` |
| NOPE replicator | `compceiling/uw_reverse_engineering/replicate_nope.py` |
| Max Pain replicator | `compceiling/uw_reverse_engineering/replicate_max_pain.py` |
| Market Tide replicator | `compceiling/uw_reverse_engineering/replicate_market_tide.py` |
| GEX replicator | `compceiling/uw_reverse_engineering/replicate_gex.py` |
| Max Pain calculator (production) | `morning-briefing/pi-scripts/options-intelligence/max_pain_calculator.py` |
| MaxPainCard (production) | `morning-briefing/src/components/feature/options/MaxPainCard.tsx` |

## UW API Catalog

Full 197-route OpenAPI spec saved at `compceiling/uw_reverse_engineering/uw_openapi.yaml` (parsed from `/api/openapi`). All routes documented for future feature mining.