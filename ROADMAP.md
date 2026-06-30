# MapleGamma Feature Roadmap

> Kanban tracking all gap items from the retail ecosystem competitive analysis.
> **[View issues →](https://github.com/arshad1416/morning-briefing/issues)**

---

## ✅ Done

- [x] **Dashboard Sentiment Widget** ([#10](https://github.com/arshad1416/morning-briefing/issues/10))
  - Reddit Pulse section on main Dashboard with mood indicator and top tickers
  - Deployed: June 29, 2026

- [x] **Polymarket Prediction Markets** ([#11](https://github.com/arshad1416/morning-briefing/issues/11))
  - Prediction Markets tab in Research page
  - Deployed: June 29, 2026

## 🎯 Priority — Next Up

- [ ] **TradingView-style charts** ([#1](https://github.com/arshad1416/morning-briefing/issues/1))
  - **Phase 1 — Pi pipeline:** daily OHLCV JSON for all 60 V3 tickers
  - **Phase 2 — Frontend:** dedicated Charts page with:
    - [ ] Charting library integration (lightweight-charts recommended — DS Pro researching)
    - [ ] Ticker selector + timeframe toggle (1D, 1W, 1M, 1Y)
    - [ ] Candlestick series + volume bars
    - **Indicator overlays:** Volume Profile, VWAP, 20/50 EMA, RSI (14), ATR
    - Charting library: **lightweight-charts** (TradingView) — CDN script tag, no build step
  - **Phase 3 — Polish:** loading states, responsive, theme support

## 📋 Backlog

- [ ] **Finviz-style market heatmap / treemap** ([#2](https://github.com/arshad1416/morning-briefing/issues/2))

- [ ] **IBKR portfolio on frontend** ([#3](https://github.com/arshad1416/morning-briefing/issues/3))
  - [ ] Verify IBKR agent produces fresh JSON files
  - [ ] Frontend tab: account summary, positions, P&L
  - [ ] Integration with existing Positions page

- [ ] **Earnings transcripts search** ([#4](https://github.com/arshad1416/morning-briefing/issues/4))

- [ ] **Audio news squawk** ([#5](https://github.com/arshad1416/morning-briefing/issues/5))
  - [ ] TTS pipeline on Pi → audio files
  - [ ] Frontend audio player
  - [ ] Morning briefing audio digest

- [ ] **Trading journal** ([#6](https://github.com/arshad1416/morning-briefing/issues/6))

- [ ] **Stock screener upgrade — Finviz filters + treemap** ([#7](https://github.com/arshad1416/morning-briefing/issues/7))

- [ ] **Tiingo/IEX Cloud API pipeline** ([#8](https://github.com/arshad1416/morning-briefing/issues/8))

- [ ] **SEC EDGAR filings** ([#9](https://github.com/arshad1416/morning-briefing/issues/9))

---

## Labels Legend
- `charting` — Charting/visualization features
- `data-pipeline` — Pi cron jobs, data fetching, JSON generation
- `frontend` — SPA pages, components, JS/CSS
- `integration` — Third-party API connections
- `feature` — Major feature addition
