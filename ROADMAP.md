# MapleGamma Feature Roadmap

> Kanban tracking all gap items from the retail ecosystem competitive analysis.
> **[View issues →](https://github.com/arshad1416/morning-briefing/issues)**
> Last updated: June 30, 2026

---

## ✅ Done

- [x] **Dashboard Sentiment Widget** ([#10](https://github.com/arshad1416/morning-briefing/issues/10))
  - Reddit Pulse section on main Dashboard
  - Deployed: June 29

- [x] **Polymarket Prediction Markets** ([#11](https://github.com/arshad1416/morning-briefing/issues/11))
  - Prediction Markets tab in Research page
  - Deployed: June 29

- [x] **Charts Page — Phase 1: OHLCV Pipeline** ([#1](https://github.com/arshad1416/morning-briefing/issues/1))
  - Pi cron: `fetch_ohlcv.py` — 60 V3 tickers, 4 timeframes, 20s run time
  - Cron: `10 7 * * 1-5` (daily at 07:10)
  - Deployed: June 29

- [x] **Charts Page — Phase 2: Frontend** ([#1](https://github.com/arshad1416/morning-briefing/issues/1))
  - `#/charts` route with ticker selector, timeframe toggle
  - Candlestick + volume via lightweight-charts
  - Indicators: 20/50 EMA, VWAP, RSI (14), ATR (14), Volume Profile (POC, VAH, VAL)
  - Dark/light theme, localStorage persistence
  - Deployed: June 29

- [x] **IBKR Portfolio Tab** ([#3](https://github.com/arshad1416/morning-briefing/issues/3))
  - Account summary, positions table, recent trades on Positions page
  - Deployed: June 29

- [x] **Screener Upgrade — Filters + Color + Sorting** ([#7](https://github.com/arshad1416/morning-briefing/issues/7))
  - Filter bar: ticker search, strategy, score range, direction
  - Color-coded cells, sortable columns
  - Deployed: June 29

- [x] **MapleGamma Route Fix** (F06)
  - `#/maplegamma` now shows GEX dashboard, not marketing page
  - Deployed: June 29

- [x] **Audio News Squawk** ([#5](https://github.com/arshad1416/morning-briefing/issues/5))
  - TTS pipeline via edge-tts on Pi, briefing MP3 at 07:08
  - Audio player on Research → Overview tab
  - Deployed: June 29

- [x] **Sector Heatmap / Treemap** ([#2](https://github.com/arshad1416/morning-briefing/issues/2))
  - Finviz-style grid on Dashboard, color-coded by performance
  - Clickable tiles linking to screener
  - Deployed: June 29

- [x] **Trading Journal** ([#6](https://github.com/arshad1416/morning-briefing/issues/6))
  - Pi CLI: `add_journal_entry.py` with emotion/grade/lesson fields
  - Frontend tab on Positions page with inline form + stats
  - Deployed: June 29

- [x] **Earnings Transcripts** ([#4](https://github.com/arshad1416/morning-briefing/issues/4))
  - Pi script: `fetch_earnings.py` via FMP API
  - Research tab for transcript display
  - Deployed: June 29

- [x] **Tiingo/IEX Cloud API** ([#8](https://github.com/arshad1416/morning-briefing/issues/8))
  - Pi script: `fetch_alternative_data.py` for fallback price data
  - Deployed: June 29

- [x] **SEC EDGAR Filings** ([#9](https://github.com/arshad1416/morning-briefing/issues/9))
  - Pi script: `fetch_sec_filings.py` with CIK mapping for 60+ tickers
  - Research tab for 10-K/10-Q filings
  - Deployed: June 29

- [x] **Backtrader Backtesting Engine**
  - 4 strategies: SMA cross, mean reversion, breakout, VWAP reversion
  - CLI with `--sizer-pct` allocation, JSON output
  - Deployed on Pi: June 29

- [x] **Trader Dev MCP** (crypto + forex backtests)
  - MCP server works from Claude Desktop
  - Pi bridge scripts built (Playwright session persistence)

- [x] **V3 Engine Retraining**
  - Fixed 4 root causes: MR entry, pullback detection, cooldown periods, strategy deadlock
  - All asset classes now generate valid signals
  - Deployed: June 29

## 🚧 In Progress

- [ ] **Volume Profile on Charts** (POC, VAH, VAL horizontal lines) — delegated
- [ ] **Trader Dev MCP on Pi** (Playwright session bridge — needs one-time sign-in)

## 📋 Backlog

- [ ] **Stock screener treemap** — heatmap component for Screener page (deferred from #7)
- [ ] **TradingView-style drawing tools** — annotations, trendlines on charts
- [ ] **Real-time price updates** — WebSocket or polling for live prices

---

## Labels Legend
- `charting` — Charting/visualization features
- `data-pipeline` — Pi cron jobs, data fetching, JSON generation
- `frontend` — SPA pages, components, JS/CSS
- `integration` — Third-party API connections
- `feature` — Major feature addition
