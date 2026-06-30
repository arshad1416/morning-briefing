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
  - Indicators: 20/50 EMA, VWAP, RSI (14), ATR (14)
  - Volume Profile (POC, VAH, VAL) — in progress
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

- [x] **Backtrader Backtesting Engine** 
  - 4 strategies: SMA cross, mean reversion, breakout, VWAP reversion
  - CLI with `--sizer-pct` allocation, JSON output
  - Deployed on Pi: June 29

- [x] **Trader Dev MCP** (crypto + forex backtests)
  - MCP server works from Claude Desktop
  - Pi bridge in progress (Playwright session persistence)

## 🚧 In Progress

- [ ] **Volume Profile on Charts** (POC, VAH, VAL horizontal lines) — delegated
- [ ] **Heatmap/Treemap** ([#2](https://github.com/arshad1416/morning-briefing/issues/2)) — delegated
- [ ] **Trading Journal** ([#6](https://github.com/arshad1416/morning-briefing/issues/6)) — delegated
- [ ] **Earnings Transcripts** ([#4](https://github.com/arshad1416/morning-briefing/issues/4)) — delegated
- [ ] **Tiingo/IEX Cloud API** ([#8](https://github.com/arshad1416/morning-briefing/issues/8)) — delegated
- [ ] **SEC EDGAR Filings** ([#9](https://github.com/arshad1416/morning-briefing/issues/9)) — delegated
- [ ] **Trader Dev MCP on Pi** (Playwright session bridge) — delegated

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
