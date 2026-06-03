# Morning Briefing Dashboard — System Architecture

> **Status:** Design Document v1.0  
> **Date:** June 2, 2026  
> **Scope:** Static site on Cloudflare Pages, data piped from Raspberry Pi, ticker chat via Cloudflare Worker

---

## 1. Architecture Overview

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                    RASPBERRY PI (always-on)                     │
  │                                                                  │
  │  6:45AM ──→ morning_briefing_data.py (no_agent script)         │
  │  6:50AM ──→ premarket_scan.py (council scan)                    │
  │  7:00AM ──→ briefing-writer agent → generates site JSON data   │
  │                                                                  │
  │  ~/.hermes/market-intel/                                        │
  │    ├── premarket_scan.json       (from premarket scan)          │
  │    ├── briefing_latest.json      (full daily briefing)          │
  │    ├── archive/                                                  │
  │    │   ├── 2026-06-01.json                                      │
  │    │   └── 2026-06-02.json                                      │
  │    └── ticker_data/                                             │
  │        ├── SPY.json                                              │
  │        ├── QQQ.json                                              │
  │        └── ... (24+ tickers)                                     │
  │                                                                  │
  │  cron: 7:15AM ──→ git commit + push to GitHub                   │
  │                                                                  │
  └──────────────────────┬──────────────────────────────────────────┘
                         │ git push
                         ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │                      GITHUB REPOSITORY                          │
  │  Morning Briefing Site                                          │
  │                                                                  │
  │  /                                                              │
  │  ├── index.html              Main dashboard page                │
  │  ├── ticker.html             Per-ticker detail                  │
  │  ├── archive.html            Briefing archive                   │
  │  ├── chat.html               AI ticker chat                     │
  │  ├── assets/                                                    │
  │  │   ├── css/style.css                                         │
  │  │   ├── js/router.js        Client-side SPA router             │
  │  │   ├── js/dashboard.js     Dashboard rendering                │
  │  │   ├── js/ticker-detail.js Ticker deep-dive logic             │
  │  │   ├── js/chat.js          Chat UI + Worker API client        │
  │  │   └── js/archive.js       Archive listing                    │
  │  └── data/                     ← COMMITTED BY PI CRON           │
  │      ├── latest.json          Latest briefing snapshot          │
  │      ├── archive-index.json   List of archived dates            │
  │      ├── archive/                                                │
  │      │   └── 2026-06-01.json  Individual day briefings          │
  │      └── tickers/                                                │
  │          └── SPY.json         Per-ticker data                   │
  │                                                                │
  └──────────────────────┬──────────────────────────────────────────┘
                         │ auto-deploy on push
                         ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │                   CLOUDFLARE PAGES                              │
  │  https://briefing.yourdomain.com                                │
  │                                                                  │
  │  ● Serves static HTML/CSS/JS                                    │
  │  ● Fetches data/ JSON at runtime (client-side fetch)            │
  │  ● Auto-deploys within ~60s of git push                         │
  │  ● No server-side logic                                          │
  └──────────────────────┬──────────────────────────────────────────┘
                         │ browser fetches JSON from /data/
                         ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │                    BROWSER (client-side)                         │
  │                                                                  │
  │  ● Loads index.html → JS fetches /data/latest.json              │
  │  ● Renders dashboard cards, tables, sparklines                  │
  │  ● Chat feature: POST to Cloudflare Worker → OpenRouter API     │
  │                                                                  │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │               CLOUDFLARE WORKER (chat proxy)                     │
  │  https://chat-api.yourdomain.com                                │
  │                                                                  │
  │  POST /chat ──→ validates ticker ──→ calls OpenRouter API       │
  │  ──→ returns AI-generated analysis as JSON                      │
  │  ● Keeps OPENROUTER_API_KEY server-side                         │
  │  ● Rate-limited (10 req/min per IP)                             │
  │  ● CORS headers for worker domain                               │
  │  ● ~200ms overhead vs direct call                               │
  └─────────────────────────────────────────────────────────────────┘
```

---

## 2. File Structure (Site Repository)

```
morning-briefing/
├── index.html                 # SPA entry point → loads router.js
├── _headers                   # Cloudflare Pages custom headers
├── _redirects                 # URL redirect rules
│
├── assets/
│   ├── css/
│   │   ├── style.css          # Global styles, dark theme, CSS vars
│   │   ├── dashboard.css      # Overview/grid layout
│   │   ├── ticker.css         # Ticker detail page styles
│   │   └── chat.css           # Chat UI styles
│   │
│   ├── js/
│   │   ├── router.js          # Hash-based SPA router (native History API)
│   │   ├── state.js           # Global state, cached JSON fetches
│   │   ├── dashboard.js       # Render market overview grid
│   │   ├── watchlist.js       # Render premarket scan results table
│   │   ├── ticker-detail.js   # Render deep dive for a single ticker
│   │   ├── archive.js         # Render briefing archive list + detail
│   │   ├── chat.js            # Chat UI + Worker API client
│   │   └── utils.js           # Formatters, number helpers, chart helpers
│   │
│   └── lib/
│       └── chart.js           # Lightweight canvas chart (mini sparklines)
│
├── data/                      # ← SYNCED BY PI CRON, committed to git
│   ├── latest.json            # Today's full briefing data
│   ├── archive-index.json     # List of available archive dates
│   ├── archive/
│   │   └── 2026-06-02.json    # Individual day full briefing
│   └── tickers/
│       ├── SPY.json           # Per-ticker historical + technical data
│       ├── QQQ.json
│       └── ... (20-30 tickers)
│
├── cloudflare-worker/         # Deployed separately to Cloudflare Workers
│   ├── wrangler.toml          # Worker config (env vars, routes)
│   ├── src/
│   │   ├── index.js           # Chat API proxy handler
│   │   └── openrouter.js      # OpenRouter API client
│   └── package.json
│
├── pi-scripts/                # Scripts that run on the Raspberry Pi
│   ├── generate-site-data.sh  # Master script: generates all JSON + git push
│   ├── generate-briefing-json.py   # Aggregates scan + yfinance → latest.json
│   ├── generate-ticker-json.py     # Per-ticker technical data → data/tickers/
│   └── update-archive.py           # Rotates briefings into archive/
│
├── package.json               # (optional) Vite or just build tooling
├── README.md
└── ARCHITECTURE.md            # This document
```

---

## 3. Data Flow — End to End

### 3.1 Morning Pipeline (Raspberry Pi)

All times are **weekdays only**.

| Time (ET) | Script | Output | Description |
|-----------|--------|--------|-------------|
| 6:45 AM | `morning_briefing_data.py` | `~/.hermes/briefing-cache/*.json` | Fetches yfinance data for indices, watchlist, commodities |
| 6:50 AM | `premarket_scan.py` | `~/.hermes/market-intel/premarket_scan.json` | 24-ticker technical scan + council on top 3 |
| 7:00 AM | Hermes agent (briefing writer) | reads cached data → produces `briefing.json` | Full market analysis, narrative summary |
| **7:15 AM** | **`generate-site-data.sh`** | **Commits to GitHub → triggers Pages deploy** | **THE KEY INTEGRATION STEP** |
| 7:30 AM | Comprehensive briefing agent | Telegram + Email | Existing pipeline continues as before |

### 3.2 `generate-site-data.sh` — The Bridge Script

This is the critical glue between the Pi's internal data and the public site. It:

```bash
#!/bin/bash
# ~/.hermes/scripts/generate-site-data.sh
# Runs at 7:15 AM weekdays on the Pi

SITE_REPO=~/morning-briefing-site
MARKET_INTEL=~/.hermes/market-intel
CACHE=~/.hermes/briefing-cache

# 1. Generate the aggregated latest.json
python3 ~/.hermes/scripts/generate-briefing-json.py \
  --scan "$MARKET_INTEL/premarket_scan.json" \
  --cache "$CACHE" \
  --output "$SITE_REPO/data/latest.json"

# 2. Generate per-ticker JSON files
python3 ~/.hermes/scripts/generate-ticker-json.py \
  --watchlist "$MARKET_INTEL/premarket_scan.json" \
  --output-dir "$SITE_REPO/data/tickers/"

# 3. Archive today's briefing
python3 ~/.hermes/scripts/update-archive.py \
  --input "$SITE_REPO/data/latest.json" \
  --archive-dir "$SITE_REPO/data/archive/" \
  --index "$SITE_REPO/data/archive-index.json"

# 4. Commit and push to GitHub → triggers Cloudflare Pages deploy
cd "$SITE_REPO"
git add data/
git commit -m "morning briefing: $(date +%Y-%m-%d)" --allow-empty
git push origin main
```

### 3.3 JSON Data Schema

**`data/latest.json`** — The master data file the dashboard fetches:

```json
{
  "date": "2026-06-02",
  "generated_at": "2026-06-02T11:15:00Z",
  "market_summary": {
    "indices": [
      {"ticker": "SPY", "name": "S&P 500", "price": 5842.31, "change": 0.42, "change_pct": 0.72},
      {"ticker": "QQQ", "name": "Nasdaq", "price": 19834.5, "change": -12.3, "change_pct": -0.06},
      {"ticker": "DIA", "name": "Dow", "price": 42310.0, "change": 105.0, "change_pct": 0.25},
      {"ticker": "IWM", "name": "Russell 2000", "price": 215.40, "change": 1.20, "change_pct": 0.56}
    ],
    "vix": 14.32,
    "ten_year_yield": 4.28,
    "market_breadth": {
      "advancers": 1240,
      "decliners": 980,
      "advance_decline_ratio": 1.27
    }
  },
  "premarket_top_setups": [
    {
      "ticker": "NVDA",
      "price": 128.45,
      "change_pct": 1.8,
      "score": 8,
      "signals": ["momentum", "volume_surge", "above_sma_20"],
      "rsi": 58,
      "council_verdict": "bullish",
      "council_summary": "NVDA showing strong pre-market volume with support at $125..."
    }
  ],
  "watchlist_summary": {
    "total_scanned": 24,
    "avg_change": 0.31,
    "green_count": 14,
    "red_count": 10
  },
  "narrative": {
    "headline": "Markets steady ahead of Fed minutes",
    "key_levels": {
      "spy_support": 5780,
      "spy_resistance": 5900,
      "qqq_support": 19600,
      "qqq_resistance": 20100
    },
    "summary_paragraph": "Pre-market futures are modestly higher...",
    "sectors": {
      "leading": ["Technology", "Healthcare"],
      "lagging": ["Energy", "Utilities"]
    }
  },
  "economic_calendar": [
    {"time": "10:00 AM", "event": "JOLTS Job Openings", "forecast": "7.8M", "previous": "7.6M", "impact": "high"}
  ],
  "top_movers": [
    {"ticker": "MSTR", "change_pct": 3.2, "reason": "Bitcoin above $70K"}
  ]
}
```

**`data/tickers/{TICKER}.json`** — Per-ticker detail data:

```json
{
  "ticker": "NVDA",
  "name": "NVIDIA Corporation",
  "price": 128.45,
  "change": 2.30,
  "change_pct": 1.82,
  "technical": {
    "rsi_14": 58,
    "sma_20": 125.10,
    "sma_50": 118.90,
    "support_1": 125,
    "resistance_1": 132,
    "atr": 3.45,
    "volume_ratio": 1.5
  },
  "fundamentals": {
    "market_cap": "3.15T",
    "pe_ratio": 42.5,
    "eps": 3.02,
    "dividend_yield": 0.03,
    "beta": 1.65
  },
  "options": {
    "put_call_ratio": 0.85,
    "max_pain": 127.50,
    "iv_rank": 35
  },
  "council_analysis": {
    "verdict": "bullish",
    "score": 8,
    "bull_case": "Strong AI demand tailwind, support at $125 holding...",
    "bear_case": "Overbought on weekly RSI, potential pullback to $120...",
    "risk_assessment": "Moderate — earnings in 3 weeks, IV is manageable"
  }
}
```

---

## 4. Chat Feature — End-to-End Architecture

### 4.1 Flow

```
User types "AAPL" in browser                Cloudflare Worker
┌──────────┐    POST /chat    ┌──────────────────────┐
│ Browser  │ ────────────────→│  index.js             │
│ chat.js  │                  │                      │
│          │ ←─────────────── │  Validates ticker     │
│          │   JSON response  │  rate_limit check     │
└──────────┘                  │  Calls OpenRouter     │
                              │  Returns structured   │
                              │  analysis as JSON     │
                              └──────────────────────┘
                                       │
                                       │ POST https://openrouter.ai/api/v1/chat/completions
                                       ▼
                              ┌──────────────────────┐
                              │   OpenRouter API     │
                              │   (e.g.,             │
                              │   deepseek-v4-flash, │
                              │    or claude-sonnet) │
                              └──────────────────────┘
```

### 4.2 Worker Code Architecture

The Cloudflare Worker (`cloudflare-worker/src/index.js`):

- **`POST /chat`** — accepts `{ "ticker": "AAPL" }`
- **Input validation** — ticker must be 1-5 uppercase alphanumeric characters
- **Rate limiting** — 10 requests/min per IP (using Workers KV or in-memory)
- **System prompt** — instructs the model to return structured analysis with tables
- **Returns** — `{ "ticker": "AAPL", "content": "## AAPL Analysis\n\n| Metric | Value |\n|--------|-------|\n| Price | $192.43 |\n...", "model": "deepseek/deepseek-v4-flash:free" }`
- **API key** — stored as `OPENROUTER_API_KEY` environment variable in `wrangler.toml`
- **CORS** — allows requests from the Cloudflare Pages domain only

### 4.3 Chat UI Behavior

The chat page (`chat.html`):

1. Text input + submit button
2. On submit: `POST https://chat-api.yourdomain.com/chat { ticker: "AAPL" }`
3. Show loading state with spinner
4. Render response as markdown-rendered HTML (using `marked.js` or simple regex)
5. Tables render as styled data tables
6. Previous analyses are retained in session (browser history)

---

## 5. Deployment Strategy

### 5.1 Cloudflare Pages (Static Site)

| Setting | Value |
|---------|-------|
| Build command | None (plain HTML/JS/CSS — no build step needed) |
| Output directory | `.` (root) |
| Git integration | Auto-deploy on push to main branch |
| Custom domain | `briefing.yourdomain.com` |
| Environment | No env vars needed (everything is static) |

**No build step required.** Vite/React is overkill for this. Plain HTML + vanilla JS keeps the Pages build fast and eliminates complexity. If you later want bundling/minification, add a simple Vite config — but start raw.

### 5.2 Cloudflare Worker (Chat API)

Deployed separately from Pages:

```bash
cd cloudflare-worker
npx wrangler deploy
```

**`wrangler.toml`:**

```toml
name = "morning-briefing-chat"
main = "src/index.js"
compatibility_date = "2026-06-01"

[env.production]
vars = { OPENROUTER_API_KEY = "", OPENROUTER_MODEL = "deepseek/deepseek-v4-flash:free" }
workers_dev = false
route = "chat-api.yourdomain.com/chat"
```

The `OPENROUTER_API_KEY` is set via `npx wrangler secret put OPENROUTER_API_KEY` — never in the config file.

### 5.3 Pi Cron (Data Generation)

One additional cron job on the Pi:

```bash
# 7:15 AM weekdays — generate site data, commit to GitHub
cronjob action=create \
  schedule="15 7 * * 1-5" \
  name="Morning Briefing Site Data" \
  script=generate-site-data.sh \
  no_agent=true \
  workdir=/home/arshad14/morning-briefing-site
```

---

## 6. Key Design Decisions & Tradeoffs

### 6.1 Why Option (a) — Pi Commits to GitHub — Over Options (b) and (c)

| Option | Description | Pro | Con | Verdict |
|--------|-------------|-----|-----|---------|
| **(a) Pi commits to GitHub** | Pi cron generates JSON, commits to repo, triggers Pages rebuild | Simple, clean, zero runtime cost, data is versioned in git | ~60s delay between push and deploy, git history grows | ✅ **Chosen** |
| **(b) Pi serves JSON via HTTP** | Site fetches from Pi's lightweight server | Real-time data, no git delay | Pi must be reachable from Cloudflare edge; adds latency; Pi goes offline = site has no data | ❌ Rejected |
| **(c) Worker fetches from Pi** | Cloudflare Worker proxies to Pi HTTP server | Edgeside caching possible | Pi still must be publicly reachable; Worker cold starts; adds complexity | ❌ Rejected |

**Why (a) wins:** The briefing is a once-daily snapshot, not real-time. A 60-second deploy delay is irrelevant. Git versioning means every day's data is backed up and comparable. No need to expose the Pi to the public internet. Zero ongoing operational cost after setup.

### 6.2 Why Vanilla JS Instead of React/Vue

- **Pages served:** 1-2 per user per day (morning glance)
- **State management:** One JSON fetch, one Workers API call
- **Team size:** 1 (you)
- **Complexity budget:** Low

A framework adds 100KB+ JS bundles, a build step, and maintenance overhead for zero benefit. The dashboard is a data-display app — fetch JSON, render tables. Vanilla JS DOM manipulation with `innerHTML` and simple template literals is faster to write, faster to load, and easier to deploy.

### 6.3 Why a Cloudflare Worker Instead of Direct Browser-to-OpenRouter

Exposing `OPENROUTER_API_KEY` in client-side JS:
- Anyone can extract it from browser DevTools
- Your API key gets stolen and abused
- No rate limiting per user
- No server-side validation

The Worker adds ~200ms latency but keeps the key secret, enforces rate limits, validates inputs, and lets you swap models without redeploying the frontend.

### 6.4 JSON Size Management

Typical `latest.json` will be ~15-30KB. Per-ticker files ~2-5KB each. With 30 tickers and 30 days of archives, total repo size stays under 10MB for the first year. This is fine for git and Cloudflare Pages.

**Future concern:** Archive growth. At 30KB/day × 365 days = ~11MB/year. Mitigations:
- After year 1, archive only weekdays (~260 files/year = ~8MB)
- Gzip compress archive JSON files (git LFS friendly)
- Prune archives older than 6 months from the site repo (keep on Pi)

---

## 7. Security

| Concern | Mitigation |
|---------|------------|
| OpenRouter API key exposed | Stored as Worker secret, never in client JS |
| Unauthorized chat access | CORS restricted to Pages domain; rate limiting on Worker |
| Pi credentials in site repo | Never — the Pi authenticates to GitHub via deploy key (read-only scoped to one repo) |
| Outdated data served | `latest.json` contains `generated_at` timestamp; site shows "data from 7:15 AM" badge |
| Git history contains stale financial data | Repo is private; no PII or account data is stored (public market data only) |

**Pi GitHub deploy key setup:**

```bash
# On Pi
ssh-keygen -t ed25519 -C "pi-morning-briefing-deploy" -f ~/.ssh/morning-briefing-deploy
# Add public key to GitHub repo as deploy key with write access (only this repo)
# Configure local git remote:
git remote set-url origin git@github.com:arshad1416/morning-briefing.git

# In ~/.ssh/config:
# Host github.com-morning-briefing
#   HostName github.com
#   IdentityFile ~/.ssh/morning-briefing-deploy
```

---

## 8. Monitoring & Failure Modes

| Failure Mode | Impact | Detection | Recovery |
|-------------|--------|-----------|----------|
| Pi offline overnight | No new data pushed | Absent `generated_at` timestamp | Site shows yesterday's data with "stale" badge; next day's push fixes it |
| yfinance API down | Missing market data | JSON fields are null/empty | JS renders "data unavailable" cards |
| OpenRouter down | Chat feature unavailable | Worker returns 502 | Chat UI shows "AI analysis temporarily unavailable" |
| Git push fails | Data not deployed | Pi cron logs error | Retry on next cron tick; manual push possible |
| Cloudflare Pages deploy fails | Site still serves previous deploy | Cloudflare dashboard alert | Deploy from local machine with `npx wrangler pages deploy` |

---

## 9. Implementation Order

### Phase 1 — Foundation (1 session)
1. Create GitHub repo, enable Cloudflare Pages
2. Deploy blank index.html to verify Pages CI/CD works
3. Set up Pi deploy key, clone repo on Pi
4. Create `generate-site-data.sh` with test data (static JSON)

### Phase 2 — Site Structure (2 sessions)
1. Build `index.html` + `dashboard.js` — fetches `latest.json`, renders market overview
2. Watchlist page — renders premarket scan table with sortable columns
3. Ticker detail page — client-side routing via hash (`#/ticker/NVDA`)
4. Archive page — date picker + archived briefing display

### Phase 3 — Chat (1 session)
1. Create Cloudflare Worker with OpenRouter proxy
2. Deploy worker, verify with curl
3. Build `chat.html` + `chat.js` — text input → API call → rendered analysis
4. Add markdown table rendering

### Phase 4 — Pi Integration (1 session)
1. Deploy `generate-briefing-json.py` on Pi (reads existing scan/cache data)
2. Deploy `generate-ticker-json.py`
3. Wire up the 7:15 AM cron job
4. Verify end-to-end: cron fires → JSON generated → committed → Pages builds → site updates

### Phase 5 — Polish (ongoing)
1. Mobile responsive design
2. Sparkline charts (mini canvas line charts in watchlist table)
3. Dark theme refinement
4. Loading states, error states, stale data badges

---

## 10. Quick Start

```bash
# 1. Create the repo
gh repo create morning-briefing --private --clone

# 2. Enable Cloudflare Pages
#    Dashboard → Pages → Create project → Connect to GitHub repo
#    Build settings: framework=none, output dir=.

# 3. Create the directory structure
mkdir -p assets/{css,js,lib} data/{archive,tickers} cloudflare-worker/src pi-scripts

# 4. Set up Pi deploy key (one-time)
#    See Section 7 above

# 5. Deploy the worker
cd cloudflare-worker
npm init -y
npm install @cloudflare/wrangler --save-dev
# Edit wrangler.toml, then:
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler deploy

# 6. Add the Pi cron job
#    Run on Pi:
cronjob action=create \
  schedule="15 7 * * 1-5" \
  name="Morning Briefing Site Data" \
  script=generate-site-data.sh \
  no_agent=true \
  workdir=/home/arshad14/morning-briefing-site
```

---

## Appendix: Existing Data Flows That Feed Into This

The morning briefing site does **not** change the existing daily briefing pipeline. It consumes its outputs.

```
Existing Pipeline (unchanged):      New Site Pipeline:
                                    │
6:45AM Data Collection              │
  └→ ~/.hermes/briefing-cache/     │
                                    │
6:50AM Premarket Scan               │
  └→ ~/.hermes/market-intel/        │
  └→ premarket_scan.json           │
                                    │
7:00AM Morning Briefing (Telegram)  │
                                    │
7:15AM ─────────────────────────────┼──→ generate-site-data.sh
                                    │     └→ Reads cache + scan
                                    │     └→ Produces data/*.json
                                    │     └→ git push → Pages deploy
                                    │
7:30AM Comprehensive Briefing       │
  (Telegram + Email)                │
```

No existing cron schedules are modified. The new 7:15AM cron is additive.
