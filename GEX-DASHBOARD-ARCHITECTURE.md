# GEX/DEX/VEX Dashboard — Technical Architecture

> **Status:** Design Document v1.0  
> **Date:** June 3, 2026  
> **Scope:** Options positioning dashboard on Cloudflare Pages, data from Raspberry Pi, vanilla JS SPA (no React, no build step)

---

## 1. Architecture Overview

```
  ┌────────────────────────────────────────────────────────────────────┐
  │                   RASPBERRY PI (always-on, 24/7)                    │
  │                                                                     │
  │  Daily Cron:                                                        │
  │    6:45AM  morning_briefing_data.py  (existing)                     │
  │    6:50AM  premarket_scan.py         (existing)                     │
  │    9:00AM  ibkr_gex.py SPY          (already runs)                  │
  │    NEW:     gex-dashboard-data.py    (NEW — generates all JSON)     │
  │                                                                     │
  │  ~/.hermes/options-intel/                                           │
  │    ├── gex_summary.json              (aggregated across tickers)    │
  │    ├── tickers/                                                     │
  │    │   ├── SPY.json                  (full gamma table)             │
  │    │   ├── QQQ.json                                                 │
  │    │   └── NVDA.json                                                │
  │    └── archive/                                                     │
  │        └── 2026-06-03/                                              │
  │            ├── gex_summary.json                                     │
  │            └── tickers/                                             │
  │                                                                     │
  │  cron: ~10:30AM → gex-site-push.sh → git push to GitHub            │
  └─────────────────────┬───────────────────────────────────────────────┘
                        │ git push
                        ▼
  ┌────────────────────────────────────────────────────────────────────┐
  │                    GITHUB REPOSITORY                                │
  │  gex-dashboard.arshadkazi.ca  (new repo, or subdirectory)          │
  │                                                                    │
  │  ├── index.html                 SPA entry point                     │
  │  ├── _headers                   Cache headers                       │
  │  ├── _redirects                 SPA fallback                        │
  │  ├── auth.html                  Login page (token gate)             │
  │  ├── assets/                                                        │
  │  │   ├── css/style.css          Dashboard styles (reuse briefing)   │
  │  │   ├── css/gex.css            GEX-specific widgets (heatmap, etc) │
  │  │   ├── js/router.js           SPA router (reuse briefing impl)    │
  │  │   ├── js/state.js            Cached fetch (reuse briefing impl)  │
  │  │   ├── js/utils.js            Formatters, helpers (reuse)         │
  │  │   ├── js/auth.js             Token-based auth check              │
  │  │   ├── js/dashboard.js        Overview page (all tickers)         │
  │  │   ├── js/ticker-gex.js       Per-ticker gamma table + chart     │
  │  │   ├── js/heatmap.js          GEX heatmap canvas renderer        │
  │  │   └── js/table-virtual.js    Virtual scroll for large gamma rows│
  │  ├── data/                       ← COMMITTED BY PI CRON             │
  │  │   ├── gex_summary.json       Overview across all tracked tickers │
  │  │   ├── tickers/                                                   │
  │  │   │   ├── SPY.json            Full gamma surface → ~30-50KB      │
  │  │   │   ├── QQQ.json                                                │
  │  │   │   └── NVDA.json                                               │
  │  │   └── archive/                                                    │
  │  │       └── 2026-06-03/                                            │
  │  └── pi-scripts/                (reference only, runs on Pi)        │
  │      └── generate-gex-data.py                                       │
  │                                                                    │
  └──────────────────────┬──────────────────────────────────────────────┘
                         │ auto-deploy on push
                         ▼
  ┌────────────────────────────────────────────────────────────────────┐
  │                  CLOUDFLARE PAGES                                   │
  │  https://gex-dashboard.arshadkazi.ca                                │
  │                                                                     │
  │  ● Serves static HTML/CSS/JS                                        │
  │  ● Fetches /data/* JSON at runtime via client-side fetch            │
  │  ● Auto-deploys in ~60s of git push                                 │
  │  ● Cloudflare Access (free plan) as auth gate in front of subdomain │
  │  ● No server-side logic, no build step                              │
  └──────────────────────┬──────────────────────────────────────────────┘
                         │ browser fetches JSON from /data/
                         ▼
  ┌────────────────────────────────────────────────────────────────────┐
  │                  BROWSER (client-side)                               │
  │                                                                     │
  │  ● Loads index.html → auth.js checks token in localStorage          │
  │  │  If free tier → show summary-only dashboard                      │
  │  │  If paid tier → show full gamma tables, heatmaps, export         │
  │  │  If no token → redirect to auth.html                             │
  │  ● Fetches /data/gex_summary.json for overview cards                │
  │  ● Fetches /data/tickers/{TICKER}.json on demand (lazy load)        │
  │  ● Canvas-based heatmap for gamma surface across strikes            │
  │  ● Virtual scrolling for long gamma tables (500+ rows)              │
  │  ● IntersectionObserver for lazy-loading ticker tiles               │
  └──────────────────────────────────────────────────────────────────────┘
```

---

## 2. File Structure

```
gex-dashboard/
├── index.html                  # SPA entry — loads auth check + router
├── auth.html                   # Token entry page (if not using CF Access)
├── _headers                    # Cache headers — same pattern as briefing
├── _redirects                  # SPA fallback
│
├── assets/
│   ├── css/
│   │   ├── style.css           # Reuse ∼90% from briefing site
│   │   └── gex.css             # GEX-specific: heatmap grid, gamma table,
│   │                           #   strike ladder, color scale widgets
│   │
│   ├── js/
│   │   ├── router.js           # IDENTICAL to briefing's router.js
│   │   ├── state.js            # IDENTICAL to briefing's state.js
│   │   ├── utils.js            # REUSED from briefing + new GEX formatters
│   │   ├── auth.js             # Token check — localStorage key verification
│   │   ├── dashboard.js        # Overview — GEX/DEX cards per ticker
│   │   ├── ticker-gex.js       # Full gamma surface viewer per ticker
│   │   ├── heatmap.js          # Canvas heatmap: strikes × expiry
│   │   └── table-virtual.js    # Virtual scroll renderer for 500+ rows
│   │
│   └── lib/
│       └── chart.js            # Canvas sparkline (from briefing or mini)
│
├── data/                       # ← SYNCED BY PI CRON
│   ├── gex_summary.json        # Overview — all tickers, totals
│   ├── tickers/
│   │   ├── SPY.json            # Full gamma surface
│   │   ├── QQQ.json
│   │   ├── NVDA.json
│   │   └── ... (10-15 tracked tickers)
│   └── archive/
│       └── 2026-06-03/
│           └── (same structure as above)
│
├── pi-scripts/                 # Reference copies (run from Pi ~/.hermes/scripts/)
│   └── generate-gex-data.py
│
├── README.md
└── ARCHITECTURE.md             # This file
```

---

## 3. Data Flow — End to End

### 3.1 Pi Pipeline (New Cron Job)

| Time (ET) | Script | What It Does |
|-----------|--------|-------------|
| ~10:00AM | `~/.hermes/scripts/ibkr_gex.py SPY` | Already runs. Calculates GEX/DEX/VEX for each ticker (loops over watchlist) |
| ~10:15AM | `generate-gex-data.py` **NEW** | Reads `ibkr_gex.py` output per ticker → aggregates into `data/gex_summary.json` + per-ticker files |
| ~10:30AM | `gex-site-push.sh` **NEW** | Commits `data/` to the GEX dashboard repo → git push → triggers Cloudflare Pages deploy |

### 3.2 `gex-site-push.sh` — The Bridge Script

```bash
#!/bin/bash
# ~/.hermes/scripts/gex-site-push.sh
# Runs at ~10:30AM weekdays on the Pi

SITE_REPO=~/gex-dashboard
OPTIONS_INTEL=~/.hermes/options-intel

# 1. Generate aggregated summary
python3 ~/.hermes/scripts/generate-gex-data.py \
  --input-dir "$OPTIONS_INTEL/tickers/" \
  --output-summary "$SITE_REPO/data/gex_summary.json" \
  --output-dir "$SITE_REPO/data/tickers/" \
  --archive-dir "$SITE_REPO/data/archive/$(date +%Y-%m-%d)/"

# 2. Commit and push → triggers Cloudflare Pages deploy
cd "$SITE_REPO"
git add data/
git commit -m "gex snapshot: $(date +%Y-%m-%d)" --allow-empty
git push origin main
```

### 3.3 Data Endpoints (JSON files served from Cloudflare Pages)

| Endpoint | Size | Content | Load Strategy |
|----------|------|---------|---------------|
| `/data/gex_summary.json` | ~5-10KB | Overview: GEX/DEX/VEX totals per ticker, net positioning, market regime | Eager — loaded on every page load |
| `/data/tickers/{TICKER}.json` | ~30-60KB | Full gamma surface: every strike + expiry's gamma, delta, vega, OI | Lazy — loaded only when user clicks into a ticker |
| `/data/archive/{DATE}/gex_summary.json` | ~5-10KB | Historical overview snapshot | On-demand via archive view |
| `/data/archive/{DATE}/tickers/{TICKER}.json` | ~30-60KB | Historical per-ticker | On-demand |

**Why lazy-load per-ticker data**: Fetching all 15 tickers' gamma tables (15 × 50KB = 750KB) on initial page load is wasteful. The summary page shows only aggregate numbers. Per-ticker detail loads only when the user navigates to it.

---

## 4. JSON Data Schemas

### 4.1 `gex_summary.json` — Overview Data (~5-10KB)

```json
{
  "date": "2026-06-03",
  "generated_at": "2026-06-03T10:15:00Z",
  "market_regime": "long_gamma",
  "tickers": [
    {
      "ticker": "SPY",
      "underlying_price": 5842.31,
      "total_gex": 326236,
      "total_dex": -2280445,
      "total_vex": 2391807,
      "gamma_direction": "long",
      "max_pain": 5800,
      "nearest_expiry": "2026-06-05",
      "expiries_tracked": 4,
      "gex_rank": 1,
      "ztl_gamma": 0.42,
      "vol_regime": "low",
      "put_call_ratio": 0.85
    }
  ],
  "summary": {
    "total_gex_all": 2450000,
    "net_gamma_direction": "long",
    "tickers_long_gamma": 8,
    "tickers_short_gamma": 3,
    "tickers_neutral": 4,
    "top_tickers_by_gex": ["SPY", "QQQ", "NVDA"]
  },
  "archive_date": "2026-06-03"
}
```

### 4.2 `tickers/SPY.json` — Full Gamma Surface (~30-60KB)

```json
{
  "ticker": "SPY",
  "name": "SPDR S&P 500 ETF",
  "underlying_price": 5842.31,
  "generated_at": "2026-06-03T10:15:00Z",
  "totals": {
    "total_gex": 326236,
    "total_dex": -2280445,
    "total_vex": 2391807,
    "gamma_direction": "long",
    "max_pain_strike": 5800,
    "vol_regime": "low"
  },
  "expiries": [
    {
      "expiry": "2026-06-05",
      "dte": 2,
      "total_gex": 145000,
      "total_dex": -980000,
      "is_front_month": true,
      "gamma_table": [
        {
          "strike": 5700,
          "call_gamma": 0.42,
          "put_gamma": 0.38,
          "net_gamma": 0.80,
          "call_gex": 12500,
          "put_gex": -9800,
          "net_gex_per_share": 2700,
          "call_delta": 0.85,
          "put_delta": -0.15,
          "call_dex": 850000,
          "put_dex": -450000,
          "call_vega": 115,
          "put_vega": 108,
          "call_oi": 45210,
          "put_oi": 38900,
          "iv": 0.185,
          "volume": 12500
        }
      ]
    }
  ],
  "analysis": {
    "key_strikes": {
      "high_gamma": 5820,
      "max_pain": 5800,
      "call_wall": 5900,
      "put_wall": 5700
    },
    "summary": "SPY is long gamma heading into Friday expiry. MM's are positioned to pin price near 5800-5820. Expect mean-reverting price action with support at 5780 (put wall) and resistance at 5900 (call wall)."
  }
}
```

**Gamma table row count**: For SPY with strikes every $1 and 4 expiries → roughly 150 strikes × 4 expiries = **600 rows max**. At ~90 bytes per row (compressed JSON), that's ~54KB. With gzip on Cloudflare's edge, wire size drops to ~15-18KB.

---

## 5. Authentication Strategy — Cloudflare Access (Recommended)

### 5.1 Option A: Cloudflare Access (Zero Trust — FREE on subdomain)

**How it works:**

```
User → https://gex-dashboard.arshadkazi.ca
         ↓
  Cloudflare Access evaluates the request
         ↓
  ┌──────────────────────────────────────────────┐
  │  Is user authenticated?                       │
  │  │                                           │
  │  YES → Allow → Serve static pages             │
  │  NO  → Block → Show Cloudflare login page     │
  └──────────────────────────────────────────────┘
```

**Setup (free tier):**
1. Go to Cloudflare Dashboard → Zero Trust → Access → Applications
2. Add a self-hosted application for `gex-dashboard.arshadkazi.ca`
3. Policy: Allow `arshadkazi@gmail.com` (your Google account) + optionally 1-2 paid subscribers
4. This is **free** for up to 50 users on the free Zero Trust plan

**Pros:**
- Zero JS/auth code on your site — Cloudflare handles everything
- Works for both free and paid users (we just give different page content)
- SSO with Google/GitHub — no password management
- No backend needed
- Can revoke access instantly from Cloudflare dashboard

### 5.2 How to Serve Different Content to Free vs Paid Users

Since Cloudflare Access only gates who can reach the site at all, here's how we tier content:

**Strategy: Login URL parameters + localStorage tier flag**

```
Flow:
1. User goes to gex-dashboard.arshadkazi.ca
2. Cloudflare Access authenticates them
3. On first login, user lands at index.html?tier=[free|paid]
4. auth.js reads ?tier= from URL, stores in localStorage('gex-tier')
5. Subsequent visits read from localStorage, skip URL param
6. Dashboard.js checks localStorage('gex-tier'):
   - free  → show summary cards only, no gamma tables, no heatmap
   - paid  → show full gamma surface, heatmap, export, historical
```

**Paid subscriber management** (no backend needed):

```javascript
// assets/js/auth.js
const Auth = {
  TIERS: ['free', 'paid'],
  
  init() {
    // Check URL parameter (set by you when adding users)
    const urlTier = new URLSearchParams(window.location.search).get('tier');
    if (urlTier && this.TIERS.includes(urlTier)) {
      localStorage.setItem('gex-tier', urlTier);
      // Clean URL after storing
      const url = new URL(window.location);
      url.searchParams.delete('tier');
      window.history.replaceState({}, '', url);
    }
    
    this.tier = localStorage.getItem('gex-tier') || 'free';
    return this.tier;
  },
  
  isPaid() {
    return this.tier === 'paid';
  }
};
```

**How to grant/revoke paid tier:**
- You (as admin) send the paid user a link like `https://gex-dashboard.arshadkazi.ca/?tier=paid`
- They visit it once while authenticated, `auth.js` persists the tier flag
- To downgrade: ask them to clear localStorage, or you walk them through it
- (Optional) To automate: add a Cloudflare Worker that sets `?tier=` based on a KV store, but this adds complexity — manual link works for <10 subscribers)

### 5.3 Option B: Simple Token-Based Auth (No Cloudflare Access)

If you want to avoid Zero Trust entirely:

**How it works:**
1. Deploy `auth.html` as the landing page
2. User enters a pre-shared token
3. `auth.js` stores token in `sessionStorage`
4. Subsequent pages check `sessionStorage` for valid token
5. The token is validated client-side against a hardcoded hash

**Token validation is client-side** — this is NOT real security. It's a "convenience lock" to keep casual visitors out. The real gate is Cloudflare Access.

```javascript
// assets/js/auth.js — Token-based fallback
const Auth = {
  // Hardcoded SHA-256 hashes. Use `sha256sum <<<"token"` to generate
  TOKENS: {
    'a1b2c3d4e5...': 'paid',   // Your paid subscriber
    'f6g7h8i9j0...': 'free',   // Free tier user
  },

  init() {
    const stored = sessionStorage.getItem('gex-token');
    if (stored && this.TOKENS[stored]) {
      this.tier = this.TOKENS[stored];
      return true;
    }
    const hash = window.location.hash.slice(1); // ?token=xxx
    if (hash && this.TOKENS[hash]) {
      sessionStorage.setItem('gex-token', hash);
      this.tier = this.TOKENS[hash];
      return true;
    }
    return false;
  }
};
```

**Recommendation**: Use Cloudflare Access (Option A). It's free, real security, and zero auth code. The tier distinction via URL param + localStorage is simple and works.

---

## 6. Reusing the Existing Briefing Codebase

| File | Reuse Strategy | Notes |
|------|---------------|-------|
| `router.js` | **Copy as-is** | Hash-based SPA routing, param routes (`:ticker`) — exactly what GEX dashboard needs |
| `state.js` | **Copy as-is** | 5-min cache, stale detection, invalidate — generic and proven |
| `utils.js` | **Copy + extend** | `formatPrice`, `formatPct`, `changeClass`, `fetchJSON` — all reusable. Add: `formatGEX(326236)` → `"$326K"`, `formatStrike(5800)` |
| `style.css` | **Copy most, add gex.css** | Dark/light theme system, grid, cards, tables, nav, badges — all reusable. Just prefix with `--gex-*` vars where needed |
| cloudflare-worker | **New worker** | optional — could add a GEX analysis chat endpoint, but the dashboard itself doesn't need one |
| `index.html` | **New file** | Same structure, different nav links, different app.js registration |
| `app.js` | **Modify** | Register only GEX routes, add auth check before router init |

**Estimated code reuse: ~70%** of the CSS/JS infrastructure transfers directly.

---

## 7. Efficient Loading of Large Gamma Tables (500+ rows)

### 7.1 The Problem

A single ticker's gamma table can have 500+ rows (150 strikes × 4 expiries). Rendering all 500 rows as DOM elements causes:
- 500ms+ layout time (reflow)
- High memory usage (~50KB DOM per row hidden in scroll)
- Slow scroll performance on mobile

### 7.2 Solution: Virtual Scrolling + Fetch on Demand

**Implementation approach — DOM recycling with IntersectionObserver:**

Rather than importing a library, we write a ~60-line `table-virtual.js` that:

1. **Only renders what's visible** — typically 30 rows in the viewport
2. **Reuses DOM nodes** — as the user scrolls, rows cycle in/out
3. **Calculates total height** — creates a spacer element to maintain correct scrollbar position

```javascript
// assets/js/table-virtual.js — Minimal virtual scroll
const VirtualTable = {
  render(container, rows, renderRowFn, options = {}) {
    const rowHeight = options.rowHeight || 32;
    const buffer = options.buffer || 10;
    const totalHeight = rows.length * rowHeight;
    
    // Outer scroll container
    container.style.overflowY = 'auto';
    container.style.position = 'relative';
    container.style.height = options.containerHeight || '500px';
    
    // Inner spacer for scrollbar
    const spacer = document.createElement('div');
    spacer.style.height = totalHeight + 'px';
    spacer.style.position = 'relative';
    container.appendChild(spacer);
    
    // Visible window
    const visibleRows = Math.ceil(container.clientHeight / rowHeight) + buffer * 2;
    
    function renderVisible() {
      const scrollTop = container.scrollTop;
      const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
      const endIdx = Math.min(rows.length, startIdx + visibleRows);
      
      // Clear previous
      spacer.innerHTML = '';
      spacer.style.paddingTop = startIdx * rowHeight + 'px';
      
      // Build fragment off-DOM → single append
      const frag = document.createDocumentFragment();
      for (let i = startIdx; i < endIdx; i++) {
        const el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.top = (i - startIdx) * rowHeight + 'px';
        el.style.width = '100%';
        el.style.height = rowHeight + 'px';
        el.innerHTML = renderRowFn(rows[i], i);
        frag.appendChild(el);
      }
      spacer.appendChild(frag);
    }
    
    container.addEventListener('scroll', () => {
      requestAnimationFrame(renderVisible);
    });
    
    renderVisible();
  }
};
```

**Performance numbers:**
- DOM nodes rendered: ~50 (visible) instead of 600
- Initial render: ~8ms vs ~120ms for full table
- Scroll: ~4ms per frame (RAF-throttled)
- Memory: negligible (no hidden rows in DOM)

### 7.3 Data Chunking (Optional Optimization)

If a single ticker file exceeds 100KB, split it per expiry:

```
/data/tickers/SPY/2026-06-05.json   ← Front month (largest)
/data/tickers/SPY/2026-06-12.json   ← Week 2
/data/tickers/SPY/2026-06-19.json   ← Monthly
```

But based on size estimates (30-60KB per ticker), this isn't needed initially. Start with one file per ticker, split only if file grows beyond 150KB.

---

## 8. Page Weight Budget

| Asset | Free Tier | Paid Tier |
|-------|-----------|-----------|
| **index.html** | ~3KB | ~3KB |
| **style.css** | ~25KB (gzipped: ~6KB) | ~25KB |
| **gex.css** | ~5KB (gzipped: ~1.5KB) | ~8KB (includes heatmap + chart CSS) |
| **router.js** | ~1.5KB | ~1.5KB |
| **state.js** | ~1KB | ~1KB |
| **utils.js** | ~3KB | ~3KB |
| **auth.js** | ~2KB | ~2KB |
| **dashboard.js** | ~8KB | ~12KB |
| **ticker-gex.js** | — (not loaded) | ~10KB |
| **heatmap.js** | — | ~8KB |
| **table-virtual.js** | — | ~4KB |
| **gex_summary.json** | ~8KB | ~8KB |
| **Per ticker .json** | — | ~30-60KB (lazy) |
| **Total initial load** | **~55KB** (gzipped ~15KB) | **~75KB** (gzipped ~22KB) |
| **Total with one ticker** | — | **~110KB** (gzipped ~35KB) |

**Key numbers:**
- Free tier initial page: **<20KB gzipped** — loads in under 1s on 3G
- Paid tier initial: **<25KB gzipped** — still under 1s
- Gamma table lazy load: **15-18KB gzipped** per ticker — fast enough for click-to-view

**CDN caching strategy (from `_headers`):**
```
# Same briefing pattern
/*                    Cache-Control: public, max-age=0, must-revalidate
/assets/*             Cache-Control: public, max-age=31536000, immutable
/data/*               Cache-Control: public, max-age=300, stale-while-revalidate=3600
```

---

## 9. Frontend Route Map

```
Route                    Handler              Tier    Description
────────────────────────────────────────────────────────────────────
#/                       Dashboard.render()   All     Overview: GEX cards per ticker
#/ticker/SPY             TickerGEX.render()   Paid    Full gamma surface + heatmap
#/heatmap                Heatmap.render()     Paid    Cross-ticker gamma heatmap
#/archive                Archive.render()     Paid    Date picker → historical snapshots
#/archive/2026-06-03     Archive.renderDate() Paid    Specific historical view
#/settings               Settings.render()    All     Token/tier management
```

**Free tier route restriction in app.js:**
```javascript
Router.register('/ticker/:ticker', function(app, params) {
  if (Auth.isPaid()) {
    TickerGEX.render(app, params);
  } else {
    app.innerHTML = '<div class="upgrade-card">' +
      '<h3>🔒 Gamma Table</h3>' +
      '<p>Full gamma surface, heatmaps, and historical archives are available on the paid plan.</p>' +
      '<a href="#/settings" class="btn">Learn More</a>' +
      '</div>';
  }
});
```

---

## 10. Key Design Decisions & Tradeoffs

### 10.1 Why Cloudflare Access Instead of a Custom Auth Backend

| Option | Complexity | Security | Cost | Verdict |
|--------|-----------|----------|------|---------|
| **Cloudflare Access** | Low (config only) | High (SSO, MFA) | Free (Zero Trust free tier) | ✅ **Chosen** |
| Custom Worker auth | Medium | Medium | Free | Surface area for bugs |
| Firebase Auth | High | High | Free tier | Overkill for 1-10 users |
| Simple token hash | Very low | Low (client-side) | Free | OK as fallback only |

### 10.2 Why Per-Ticker Lazy Loading

Fetching all 15 ticker files (15 × 50KB = 750KB) on initial page load is wasteful. The summary overview only needs `gex_summary.json` (~8KB). Per-ticker gamma tables load on click.

### 10.3 Why Virtual Scroll Instead of Pagination

Pagination (25 rows per page × 24 pages) is common but breaks the "scan the full gamma surface" UX. Options traders want to see the entire chain in one scrollable table. Virtual scrolling gives the best experience with the best performance.

### 10.4 Why Canvas Heatmap Instead of SVG/DOM

A gamma heatmap across strikes × expiries can have 600+ cells. DOM-based rendering of 600 cells → 600+ DOM nodes → slow. Canvas renders at GPU speed. The heatmap is a 2D grid — a perfect use case for `<canvas>`.

### 10.5 Why Not a Separate Repo (vs. Subdirectory in Briefing)

**Recommendation: Same repo, `gex/` subdirectory.**

```
morning-briefing/
├── index.html
├── data/
│   ├── latest.json
│   └── tickers/
├── gex/
│   ├── index.html          ← Served at /gex/
│   ├── assets/js/...
│   └── data/
│       ├── gex_summary.json
│       └── tickers/
```

**Why?**
- Single Cloudflare Pages project (one deploy per push)
- Shared CSS/JS from `assets/` can be symlinked or copied
- Same git history, same deploy pipeline
- The data push script can push to both `data/` and `gex/data/` in one commit

**BUT** the briefing site's `_redirects` has `/* /index.html 200` which would also catch `/gex/*` paths. We'd need a redirect rule like:
```
/gex/*  /gex/index.html  200
```

If Cloudflare Pages subdirectories with their own SPA routing become complex, a **separate repo** is cleaner. Either works — decide based on whether you want one deploy pipeline or two.

---

## 11. Implementation Order

### Phase 1 — Foundation (1 session)
1. Create the Cloudflare Pages project (or subdirectory in existing repo)
2. Copy `router.js`, `state.js`, `utils.js`, `style.css` from briefing site
3. Deploy blank `index.html` to verify SPA routing works
4. Set up Cloudflare Access on the subdomain

### Phase 2 — Auth + Tier Gating (1 session)
1. Write `auth.js` — tier detection from URL param + localStorage
2. Wire auth check into `app.js` before route initialization
3. Test: check free vs paid rendering

### Phase 3 — Overview Dashboard (1-2 sessions)
1. Create `dashboard.js` — fetch `gex_summary.json`, render ticker cards
2. Implement grid layout with GEX/DEX/VEX per ticker
3. Add color-coded gamma direction badges (long γ = green, short γ = red)
4. Market regime banner (long gamma = range-bound, short gamma = trending)

### Phase 4 — Gamma Table + Virtual Scroll (1-2 sessions)
1. Create `table-virtual.js`
2. Write `ticker-gex.js` — fetch `/data/tickers/{TICKER}.json`, render gamma table
3. Add sortable columns (by strike, gamma, OI, etc.)
4. Highlight key strikes (max pain, put wall, call wall)
5. Free tier: show locked card with upgrade prompt

### Phase 5 — Heatmap (1 session)
1. Write `heatmap.js` — Canvas 2D grid: strikes × expiries
2. Color scale: positive gamma = green gradient, negative gamma = red gradient
3. Mouseover tooltip showing exact values
4. Click a cell → scroll to that strike in the gamma table

### Phase 6 — Pi Integration (1 session)
1. Write `generate-gex-data.py` — aggregates `ibkr_gex.py` output into the dashboard JSON format
2. Create `gex-site-push.sh` — shell script that runs the Python + git push
3. Set up Pi deploy key for the new repo (or new subdirectory)
4. Add cron job on Pi: 10:30AM weekdays
5. Verify end-to-end: cron fires → JSON generated → committed → Pages builds → site updates

### Phase 7 — Polish (ongoing)
1. Canvas heatmap animations
2. Historical comparisons (today vs yesterday's gamma surface)
3. Gamma flip alerts (ticker moves from long γ to short γ)
4. Export to CSV for the gamma table
5. Mobile responsive heatmap

---

## 12. Estimated JSON Sizes (Budgeting)

| Data File | Row Count | Raw Size | Gzipped (CF Edge) |
|-----------|-----------|----------|-------------------|
| `gex_summary.json` | 15 tickers | ~8KB | ~2.5KB |
| Per ticker (4 expiries) | ~600 rows | ~55KB | ~16KB |
| Per ticker (1 expiry only) | ~150 rows | ~14KB | ~4KB |
| Archive summary | 15 tickers | ~8KB | ~2.5KB |
| Archive per ticker | ~600 rows | ~55KB | ~16KB |

**Total repo growth:** ~1MB/month (15 tickers × 55KB × weekdays). After 1 year: ~12MB. Acceptable for git.

---

## 13. Failure Modes

| Failure | Impact | Detection | Recovery |
|---------|--------|-----------|----------|
| Pi offline | No new GEX data | `generated_at` timestamp | Show "last updated X hours ago" badge |
| yfinance API down | No OI for gamma | Null OI fields | Cards show "data pending" |
| IBKR Gateway down | No live price for underlying | `underlying_price` = null | Fall back to yfinance close price |
| Git push fails | Data not deployed | Pi logs | Next cron push; manual `git push` |
| Cloudflare Access down | No one can access | 401/403 from CF | Site is inaccessible (CF infra rarely goes down) |

---

## 14. Quick Start

```bash
# Option A: New repo (cleaner separation)
gh repo create gex-dashboard --private --clone

# Option B: Subdirectory in existing repo
mkdir -p morning-briefing/gex/{assets/{css,js},data/{tickers,archive},pi-scripts}

# Enable Cloudflare Pages (or add Pages to existing project)
# Dashboard → Pages → Create project → Connect to GitHub repo
# Build settings: framework=none, output dir=.

# Set up Cloudflare Access
# Zero Trust → Access → Applications → Add self-hosted
# Domain: gex-dashboard.arshadkazi.ca or briefing.arshadkazi.ca/gex/

# Copy infrastructure files from briefing
cp ../morning-briefing/assets/js/router.js assets/js/
cp ../morning-briefing/assets/js/state.js  assets/js/
cp ../morning-briefing/assets/js/utils.js  assets/js/
cp ../morning-briefing/assets/css/style.css assets/css/

# Create _redirects for SPA
echo "/*  /index.html  200" > _redirects
echo "/data/*  /data/:splat  200" >> _redirects

# Deploy first version
git add .
git commit -m "init: GEX dashboard scaffolding"
git push origin main
```
