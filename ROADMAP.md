# MapleGamma Feature Roadmap

> Kanban tracking all gap items from the retail ecosystem competitive analysis.
> **[View issues →](https://github.com/arshad1416/morning-briefing/issues)**
> Last updated: June 30, 2026

---

## ✅ Done

- [x] **Dashboard Sentiment Widget** ([#10](https://github.com/arshad1416/morning-briefing/issues/10))
- [x] **Polymarket Prediction Markets** ([#11](https://github.com/arshad1416/morning-briefing/issues/11))
- [x] **Charts Page** ([#1](https://github.com/arshad1416/morning-briefing/issues/1))
  - Phase 1: OHLCV pipeline (60 tickers, 4 timeframes, cron 07:10)
  - Phase 2: Frontend (candlestick, EMA, VWAP, RSI, ATR, Volume Profile)
- [x] **IBKR Portfolio Tab** ([#3](https://github.com/arshad1416/morning-briefing/issues/3))
- [x] **Screener Upgrade** ([#7](https://github.com/arshad1416/morning-briefing/issues/7))
- [x] **MapleGamma Route Fix** — GEX dashboard at `/maplegamma`
- [x] **Audio News Squawk** ([#5](https://github.com/arshad1416/morning-briefing/issues/5))
- [x] **Sector Heatmap** ([#2](https://github.com/arshad1416/morning-briefing/issues/2))
- [x] **Trading Journal** ([#6](https://github.com/arshad1416/morning-briefing/issues/6))
- [x] **Earnings Transcripts** ([#4](https://github.com/arshad1416/morning-briefing/issues/4))
- [x] **Tiingo/IEX Cloud API** ([#8](https://github.com/arshad1416/morning-briefing/issues/8))
- [x] **SEC EDGAR Filings** ([#9](https://github.com/arshad1416/morning-briefing/issues/9))
- [x] **Stock Screener Treemap** — Finviz-style grid toggle on Screener page
- [x] **Drawing Tools** — Trendline, Horizontal Line, Rectangle on Charts page
- [x] **Real-Time Price Updates** — 60s polling, custom DOM events, `/data/latest.json`
- [x] **Backtrader Backtesting Engine** — 4 strategies, Pi-based, JSON output
- [x] **Trader Dev MCP Bridge** — `mcp-remote` on Pi connects to SSE endpoint
- [x] **V3 Engine Retraining** — All asset classes now generating valid signals

## 🚧 In Progress

- [ ] **Trader Dev full backtest automation on Pi** — `authenticate` tool requires interactive approval (taskSupport: forbidden)

## 📋 Backlog

*(All items from competitive analysis are now addressed. New ideas will go here.)*

---

## Labels Legend
- `charting` — Charting/visualization features
- `data-pipeline` — Pi cron jobs, data fetching, JSON generation
- `frontend` — SPA pages, components, JS/CSS
- `integration` — Third-party API connections
- `feature` — Major feature addition
