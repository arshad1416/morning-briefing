# Stock Screener — Architecture & Implementation Plan

> **Status:** Design Document  
> **Scope:** Stock screener page for briefing.arshadkazi.ca  
> **Pattern:** Matches existing SPA: Pi generates JSON → git push → Cloudflare Pages → client-side JS renders

---

## 1. File Structure — What to Create/Modify

### New files (9 total):
```
morning-briefing/
├── pi-scripts/
│   └── generate-screener-data.py       # NEW — Pi-side: fetches yfinance, computes metrics, writes JSON
│
├── data/
│   └── screener-data.json              # NEW — Generated daily by Pi, committed to git
│
├── assets/
│   ├── js/
│   │   └── screener.js                 # NEW — Page object: Screener.render(app), filters, table, scoring
│   └── css/
│       └── screener.css                # NEW — Screener-specific styles (filter bar, range inputs, mobile)
```

### Files to modify (3 total):
```
morning-briefing/
├── index.html                          # MODIFY — Add 'screener' to script list
├── assets/js/app.js                    # MODIFY — Add Router.register('/screener', ...)
```

### Files that DO NOT change:
- router.js, state.js, utils.js — Reused as-is
- style.css — Global styles reused, no changes needed
- All other pages — untouched

---

## 2. Pi-Side Python Script: `pi-scripts/generate-screener-data.py`

### Functionality
Runs daily via cron (~6:30 AM ET before other scripts). Fetches 100 tickers via yfinance, computes technical metrics, writes `/data/screener-data.json`.

### Ticker Universe (100 tickers)
```python
TICKERS = [
    # Major Indices (4)
    "SPY", "QQQ", "IWM", "DIA",
    # Sector ETFs (12)
    "XLF", "XLK", "XLE", "XLV", "XLI", "XLB", "XLU", "XLRE", "XLY", "XLP", "XLC", "XLG",
    # Large Cap US (25)
    "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "BRK-B", "JPM", "V",
    "JNJ", "WMT", "MA", "PG", "UNH", "HD", "DIS", "NFLX", "ADBE", "CRM",
    "AMD", "INTC", "BAC", "PFE", "KO",
    # Mid Cap / High Volume (20)
    "PLTR", "MSTR", "TSM", "AVGO", "COST", "ABNB", "UBER", "SNAP", "DDOG", "CRWD",
    "PANW", "SHOP", "SQ", "MCD", "NKE", "BA", "CAT", "GE", "IBM", "ORCL",
    # Top Gainers / High Beta / Popular (15)
    "MARA", "COIN", "RKLB", "ASTS", "SOFI", "HOOD", "RDDT", "CVNA", "DKNG", "TTD",
    "CMG", "LULU", "SBUX", "TGT", "LOW",
    # Canadian (14)
    "XIU.TO", "TD.TO", "RY.TO", "SHOP.TO", "ENB.TO", "BNS.TO", "BMO.TO", "CNQ.TO",
    "SU.TO", "CP.TO", "CNR.TO", "TRP.TO", "FTS.TO", "POW.TO",
    # Fixed Income / Commodity ETFs (6)
    "TLT", "AGG", "BND", "GLD", "SLV", "USO",
    # Bitcoin proxys (4)
    "IBIT", "FBTC", "BITB", "GBTC",
]
```

### Metrics Computed Per Ticker

```python
{
    "ticker": "NVDA",
    "name": "NVIDIA Corporation",
    "price": 128.45,
    "change_pct": 1.82,
    "pe": 42.5,                   # trailing PE
    "forwardPe": 35.2,            # forward PE
    "marketCap": 3150000000000,   # raw number
    "divYield": 0.03,             # percentage (0.03 = 0.03%)
    "sector": "Technology",
    "industry": "Semiconductors",
    "recommendation": "BUY",      # Analyst consensus
    "targetPrice": 145.00,
    "beta": 1.65,
    "volume": 45000000,
    "avgVolume": 38000000,
    "rsi": 58.3,                  # 14-day RSI
    "sma20": 125.10,              # 20-day SMA
    "sma50": 118.90,              # 50-day SMA
    "high52w": 145.80,            # 52-week high
    "low52w": 98.20,              # 52-week low
    "institutionPct": 72.5,       # % held by institutions
    # Computed signals
    "above_sma20": True,          # price > sma20
    "above_sma50": True,          # price > sma50
    "above_52w_high_pct": 12.0,   # % below 52w high (0 = at high)
    "below_52w_low_pct": 30.7,    # % above 52w low
    "volume_ratio": 1.18,         # volume / avgVolume
    "score": 7,                   # computed from strategy scoring
}
```

### yfinance API Calls (per ticker)
```python
import yfinance as yf
import pandas as pd
import numpy as np

def fetch_ticker_data(ticker):
    """Fetch data for one ticker, compute metrics."""
    try:
        t = yf.Ticker(ticker)
        info = t.info
        
        # Get 1 year of daily data for technicals
        hist = t.history(period="1y")
        if hist.empty:
            return None
            
        price = hist['Close'][-1]
        
        # RSI (14-day)
        delta = hist['Close'].diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss
        rsi = round(100 - (100 / (1 + rs.iloc[-1])), 1) if rs.iloc[-1] != 0 else 50
        
        # SMAs
        sma20 = round(hist['Close'].rolling(20).mean().iloc[-1], 2)
        sma50 = round(hist['Close'].rolling(50).mean().iloc[-1], 2)
        
        # Volume
        volume = int(hist['Volume'][-1])
        avg_vol = int(hist['Volume'].rolling(50).mean().iloc[-1])
        
        # 52-week high/low
        high_52w = round(hist['High'].rolling(252).max().iloc[-1], 2)
        low_52w = round(hist['Low'].rolling(252).min().iloc[-1], 2)
        
        return {
            "ticker": ticker,
            "name": info.get("longName", ""),
            "price": round(price, 2),
            "change_pct": round(hist['Close'].pct_change().iloc[-1] * 100, 2) if len(hist) > 1 else 0,
            "pe": info.get("trailingPE"),
            "forwardPe": info.get("forwardPE"),
            "marketCap": info.get("marketCap"),
            "divYield": round(info.get("dividendYield", 0) * 100, 2) if info.get("dividendYield") else 0,
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "recommendation": info.get("recommendationKey", "").upper(),
            "targetPrice": info.get("targetMeanPrice"),
            "beta": info.get("beta"),
            "volume": volume,
            "avgVolume": avg_vol,
            "rsi": rsi,
            "sma20": sma20,
            "sma50": sma50,
            "high52w": high_52w,
            "low52w": low_52w,
            "institutionPct": info.get("heldPercentInstitutions", 0) * 100 if info.get("heldPercentInstitutions") else None,
            # Computed
            "above_sma20": price > sma20,
            "above_sma50": price > sma50,
            "above_52w_high_pct": round((1 - price / high_52w) * 100, 1) if high_52w else None,
            "below_52w_low_pct": round((price / low_52w - 1) * 100, 1) if low_52w else None,
            "volume_ratio": round(volume / avg_vol, 2) if avg_vol else 1.0,
        }
    except Exception as e:
        print(f"Error fetching {ticker}: {e}")
        return None
```

### Scoring Computation
```python
def compute_score(data):
    """Compute score 1-10 based on backtest strategies."""
    score = 5  # neutral baseline
    reasons = []
    
    # 1. RSI Strategy: oversold bounce (30-40) = bullish, overbought (70+) = bearish
    if data['rsi'] and data['rsi'] < 35:
        score += 2
        reasons.append("oversold_rsi")
    elif data['rsi'] and data['rsi'] < 45:
        score += 1
        reasons.append("rsi_dip")
    elif data['rsi'] and data['rsi'] > 75:
        score -= 2
        reasons.append("overbought_rsi")
    elif data['rsi'] and data['rsi'] > 65:
        score -= 1
        reasons.append("extended_rsi")
    
    # 2. SMA Crossover: price above both = bullish
    if data['above_sma20'] and data['above_sma50']:
        score += 1
        reasons.append("above_ma")
    elif not data['above_sma20'] and not data['above_sma50']:
        score -= 1
        reasons.append("below_ma")
    
    # 3. Volume Surge: volume > 1.5x average = momentum
    if data['volume_ratio'] and data['volume_ratio'] > 1.5:
        score += 1
        reasons.append("volume_surge")
    
    # 4. Near 52w High: price within 5% of 52w high = strength
    if data['above_52w_high_pct'] is not None and data['above_52w_high_pct'] < 5:
        score += 1
        reasons.append("near_high")
    elif data['below_52w_low_pct'] is not None and data['below_52w_low_pct'] < 5:
        score -= 1
        reasons.append("near_low")
    
    # 5. Value: P/E < 20 and positive = undervalued
    if data['pe'] and 0 < data['pe'] < 15:
        score += 1
        reasons.append("value_pe")
    elif data['pe'] and data['pe'] > 30:
        score -= 1
        reasons.append("premium_pe")
    
    # 6. Analyst recommendation
    rec = data.get('recommendation', '')
    if rec == 'BUY' or rec == 'STRONG_BUY':
        score += 1
        reasons.append("analyst_buy")
    elif rec == 'SELL' or rec == 'STRONG_SELL':
        score -= 1
    
    # Clamp 1-10
    score = max(1, min(10, score))
    
    return score, reasons
```

### Main Script Flow
```python
def main():
    tickers = TICKERS  # 100 tickers from the list above
    results = []
    failed = 0
    
    for ticker in tickers:
        data = fetch_ticker_data(ticker)
        if data:
            score, signals = compute_score(data)
            data['score'] = score
            data['signals'] = signals
            results.append(data)
        else:
            failed += 1
        time.sleep(0.2)  # Rate limit: 5 req/sec
    
    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "ticker_count": len(results),
        "failed_count": failed,
        "market_summary": compute_market_summary(results),
        "tickers": results,
    }
    
    with open("data/screener-data.json", "w") as f:
        json.dump(output, f, indent=2)
```

### Market Summary Computed
```python
def compute_market_summary(tickers):
    """Aggregate statistics across all scanned tickers."""
    prices = [t['price'] for t in tickers if t.get('price')]
    changes = [t['change_pct'] for t in tickers if t.get('change_pct') is not None]
    scores = [t['score'] for t in tickers if t.get('score')]
    
    sectors = {}
    for t in tickers:
        s = t.get('sector', 'Unknown')
        if s not in sectors:
            sectors[s] = {'count': 0, 'avg_change': 0}
        sectors[s]['count'] += 1
    
    return {
        "avg_price": round(np.mean(prices), 2) if prices else 0,
        "avg_change": round(np.mean(changes), 2) if changes else 0,
        "avg_score": round(np.mean(scores), 1) if scores else 0,
        "green_count": sum(1 for c in changes if c > 0),
        "red_count": sum(1 for c in changes if c < 0),
        "sector_breakdown": sectors,
    }
```

---

## 3. JSON Data Format: `data/screener-data.json`

```json
{
  "generated_at": "2026-06-04T10:30:00-04:00",
  "ticker_count": 98,
  "failed_count": 2,
  "market_summary": {
    "avg_price": 128.45,
    "avg_change": 0.31,
    "avg_score": 5.8,
    "green_count": 54,
    "red_count": 44,
    "sector_breakdown": {
      "Technology": { "count": 28, "avg_change": 0.52 },
      "Financial Services": { "count": 15, "avg_change": -0.12 }
    }
  },
  "tickers": [
    {
      "ticker": "NVDA",
      "name": "NVIDIA Corporation",
      "price": 128.45,
      "change_pct": 1.82,
      "score": 7,
      "signals": ["above_ma", "volume_surge", "analyst_buy"],
      "pe": 42.5,
      "forwardPe": 35.2,
      "marketCap": 3150000000000,
      "divYield": 0.03,
      "sector": "Technology",
      "industry": "Semiconductors",
      "recommendation": "BUY",
      "targetPrice": 145.00,
      "beta": 1.65,
      "volume": 45000000,
      "avgVolume": 38000000,
      "rsi": 58.3,
      "sma20": 125.10,
      "sma50": 118.90,
      "high52w": 145.80,
      "low52w": 98.20,
      "institutionPct": 72.5,
      "above_sma20": true,
      "above_sma50": true,
      "above_52w_high_pct": 12.0,
      "below_52w_low_pct": 30.7,
      "volume_ratio": 1.18
    }
  ]
}
```

Key decisions:
- `marketCap` is raw number (not formatted string) — frontend formats using `Utils.formatPrice()` with `{ notation: "compact" }` style
- `score` is integer 1-10 (matches existing `scoreBadge` utility)
- `signals` array of short kebab-case strings (matches existing pattern in `watchlist.js`)
- `generated_at` ISO timestamp (matches existing pattern for stale data detection)

---

## 4. JS Page Structure: `assets/js/screener.js`

### Pattern — Matches Existing Pages
```javascript
/**
 * Screener — Stock screening page with filters, scoring, sortable table.
 */
const Screener = {
  async render(app) {
    app.innerHTML = '<div class="loading">Loading screener data...</div>';

    const data = await State.get('screener', '/data/screener-data.json');
    if (!data || !data.tickers?.length) {
      app.innerHTML = '<div class="error-card">Failed to load screener data. Run the Pi script first.</div>';
      return;
    }

    // Build entire page HTML
    let html = this._buildHeader(data);
    html += this._buildFilterBar();
    html += this._buildTable(data.tickers);
    html += this._buildFooter(data);
    
    app.innerHTML = html;

    // Wire up filter events (after DOM is rendered)
    this._wireFilters(data.tickers);
  },

  /** Page header with summary stats */
  _buildHeader(data) { /* ... */ },

  /** Filter bar with all filter controls */
  _buildFilterBar() { /* ... */ },

  /** Table body with sortable columns */
  _buildTable(tickers, filters) { /* ... */ },

  /** Timestamp footer */
  _buildFooter(data) { /* ... */ },

  /** Wire up all filter event handlers */
  _wireFilters(allTickers) { /* ... */ },

  /** Apply current filter state to tickers and re-render table */
  _applyFilters() { /* ... */ },

  /** Format a single ticker row */
  _tickerRow(t) { /* ... */ },

  /** Compute score badge HTML (reuses Utils.scoreBadge) */
  _scoreCell(score) { /* ... */ },
};
```

### Key Methods Detail

**_buildFilterBar()** — Renders the filter controls as a card at the top:
```html
<div class="screener-filters" id="screener-filters">
  <!-- Row 1: Range sliders -->
  <div class="filter-group">
    <label>PE Ratio</label>
    <select id="filter-pe">
      <option value="">Any</option>
      <option value="0-15">Value (&lt;15)</option>
      <option value="15-25">Moderate (15-25)</option>
      <option value="25-50">Premium (25-50)</option>
      <option value="50-">High (&gt;50)</option>
    </select>
  </div>
  
  <div class="filter-group">
    <label>Market Cap</label>
    <select id="filter-mcap">
      <option value="">Any</option>
      <option value="0-2B">Micro</option>
      <option value="2B-10B">Small</option>
      <option value="10B-200B">Mid</option>
      <option value="200B-">Large</option>
      <option value="1T-">Mega (&gt;1T)</option>
    </select>
  </div>

  <div class="filter-group">
    <label>Dividend Yield</label>
    <select id="filter-div">
      <option value="">Any</option>
      <option value="0-1">Low (&lt;1%)</option>
      <option value="1-3">Moderate (1-3%)</option>
      <option value="3-">High (&gt;3%)</option>
    </select>
  </div>

  <div class="filter-group">
    <label>RSI</label>
    <select id="filter-rsi">
      <option value="">Any</option>
      <option value="0-30">Oversold (&lt;30)</option>
      <option value="30-45">Weak (30-45)</option>
      <option value="45-55">Neutral (45-55)</option>
      <option value="55-70">Strong (55-70)</option>
      <option value="70-">Overbought (&gt;70)</option>
    </select>
  </div>

  <div class="filter-group">
    <label>Sector</label>
    <select id="filter-sector">
      <option value="">All Sectors</option>
      <!-- Populated dynamically from data -->
    </select>
  </div>

  <!-- Row 2: Checkboxes + score -->
  <div class="filter-group">
    <label>Volume vs Avg</label>
    <select id="filter-volume">
      <option value="">Any</option>
      <option value="above">Above Average</option>
      <option value="below">Below Average</option>
      <option value="1.5x">1.5x+ Surge</option>
      <option value="2x">2x+ Surge</option>
    </select>
  </div>

  <div class="filter-group">
    <label>Price vs 52w</label>
    <select id="filter-52w">
      <option value="">Any</option>
      <option value="near-high">Near High (&lt;5%)</option>
      <option value="near-low">Near Low (&lt;5%)</option>
      <option value="mid-range">Mid Range</option>
    </select>
  </div>

  <div class="filter-group">
    <label>Price vs SMAs</label>
    <select id="filter-sma">
      <option value="">Any</option>
      <option value="above-both">Above 20 & 50</option>
      <option value="below-both">Below 20 & 50</option>
      <option value="golden-cross">Golden Cross</option>
      <option value="death-cross">Death Cross</option>
    </select>
  </div>

  <div class="filter-group">
    <label>Min Score</label>
    <select id="filter-score">
      <option value="0">Any Score</option>
      <option value="7">7+ (Strong)</option>
      <option value="5">5+ (Positive)</option>
      <option value="3">3+ (Weak)</option>
    </select>
  </div>

  <!-- Sort -->
  <div class="filter-group">
    <label>Sort By</label>
    <select id="filter-sort">
      <option value="score-desc">Score (High→Low)</option>
      <option value="score-asc">Score (Low→High)</option>
      <option value="change-desc">Change (High→Low)</option>
      <option value="change-asc">Change (Low→High)</option>
      <option value="rsi-asc">RSI (Low→High)</option>
      <option value="rsi-desc">RSI (High→Low)</option>
      <option value="mcap-desc">Market Cap (Large→Small)</option>
      <option value="mcap-asc">Market Cap (Small→Large)</option>
      <option value="pe-asc">PE (Low→High)</option>
      <option value="pe-desc">PE (High→Low)</option>
    </select>
  </div>

  <!-- Search -->
  <div class="filter-group filter-search">
    <label>Search</label>
    <input type="text" id="filter-search" placeholder="Ticker or name..." />
  </div>

  <!-- Reset button -->
  <button id="filter-reset" class="screener-btn">Reset Filters</button>
</div>
```

**_buildTable(tickers, filters)** — Renders filtered + sorted results:
```html
<div class="card table-wrap">
  <table>
    <thead>
      <tr>
        <th>Ticker</th>
        <th>Price</th>
        <th>Chg%</th>
        <th>Score</th>
        <th>PE</th>
        <th>Mkt Cap</th>
        <th>Div%</th>
        <th>RSI</th>
        <th>Vol Ratio</th>
        <th>Sector</th>
        <th>Signals</th>
      </tr>
    </thead>
    <tbody id="screener-tbody">
      <!-- Populated by _applyFilters() -->
    </tbody>
  </table>
  <div id="screener-count" class="screener-count"></div>
</div>
```

**_tickerRow(t)** — Single table row:
```javascript
_tickerRow(t) {
  const cls = Utils.changeClass(t.change_pct);
  const mcap = t.marketCap ? Utils.formatPrice(t.marketCap / 1e9, 1) + 'B' : '—';
  const signals = (t.signals || []).map(s => {
    const bg = s.includes('over') || s.includes('bear') || s.includes('below') || s.includes('low') || s.includes('extended') || s.includes('death') ? 'badge-red' : 'badge-green';
    return `<span class="badge ${bg}" style="margin:1px">${s.replace(/_/g, ' ')}</span>`;
  }).join(' ');
  
  return `<tr>
    <td><a href="#/ticker/${t.ticker}" class="archive-date">${t.ticker}</a></td>
    <td>${Utils.formatPrice(t.price)}</td>
    <td class="${cls}">${Utils.formatPct(t.change_pct)}</td>
    <td>${Utils.scoreBadge(t.score)}</td>
    <td>${t.pe != null ? t.pe.toFixed(1) : '—'}</td>
    <td style="font-size:0.8rem">${mcap}</td>
    <td>${t.divYield != null && t.divYield > 0 ? t.divYield.toFixed(2) + '%' : '—'}</td>
    <td>${t.rsi != null ? t.rsi.toFixed(1) : '—'}</td>
    <td>${t.volume_ratio != null ? t.volume_ratio.toFixed(2) + 'x' : '—'}</td>
    <td style="font-size:0.75rem;color:var(--text-muted)">${t.sector ? t.sector.substring(0, 12) : '—'}</td>
    <td style="max-width:200px">${signals || '—'}</td>
  </tr>`;
}
```

**_wireFilters(allTickers)** — Event-driven filtering (no debounce needed for select changes):
```javascript
_wireFilters(allTickers) {
  const filterIds = ['filter-pe', 'filter-mcap', 'filter-div', 'filter-rsi',
                     'filter-sector', 'filter-volume', 'filter-52w', 'filter-sma',
                     'filter-score', 'filter-sort', 'filter-search'];
  
  // Populate sector dropdown dynamically
  const sectorSelect = document.getElementById('filter-sector');
  const sectors = [...new Set(allTickers.filter(t => t.sector).map(t => t.sector))].sort();
  sectors.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    sectorSelect.appendChild(opt);
  });

  // Attach change/input handlers
  filterIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(id === 'filter-search' ? 'input' : 'change', () => {
      this._applyFilters(allTickers);
    });
  });

  // Reset button
  document.getElementById('filter-reset')?.addEventListener('click', () => {
    filterIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    this._applyFilters(allTickers);
  });

  // Initial render
  this._applyFilters(allTickers);
}
```

**_applyFilters(allTickers)** — Filter logic:
```javascript
_applyFilters(allTickers) {
  const val = id => document.getElementById(id)?.value || '';

  const peFilter      = val('filter-pe');
  const mcapFilter    = val('filter-mcap');
  const divFilter     = val('filter-div');
  const rsiFilter     = val('filter-rsi');
  const sectorFilter  = val('filter-sector');
  const volFilter     = val('filter-volume');
  const w52Filter     = val('filter-52w');
  const smaFilter     = val('filter-sma');
  const scoreFilter   = parseInt(val('filter-score')) || 0;
  const sortBy        = val('filter-sort') || 'score-desc';
  const search        = val('filter-search').toLowerCase().trim();

  // Helper: test a range filter like "0-15"
  const inRange = (value, filter) => {
    if (!filter) return true;
    if (value == null) return false;
    const [lo, hi] = filter.split('-');
    if (lo && value < parseFloat(lo)) return false;
    if (hi && value > parseFloat(hi)) return false;
    // Handle open-ended (e.g., "50-")
    if (hi === '' && value < parseFloat(lo)) return false;
    return true;
  };

  let filtered = allTickers.filter(t => {
    if (search && !t.ticker.toLowerCase().includes(search) && !(t.name || '').toLowerCase().includes(search)) return false;
    if (!inRange(t.pe, peFilter)) return false;
    if (sectorFilter && t.sector !== sectorFilter) return false;
    if (scoreFilter && (t.score || 0) < scoreFilter) return false;
    
    // Market cap filter
    if (mcapFilter) {
      const mcap = t.marketCap || 0;
      const mcapB = mcap / 1e9;
      if (mcapFilter === '0-2B' && (mcapB < 0 || mcapB > 2)) return false;
      if (mcapFilter === '2B-10B' && (mcapB < 2 || mcapB > 10)) return false;
      if (mcapFilter === '10B-200B' && (mcapB < 10 || mcapB > 200)) return false;
      if (mcapFilter === '200B-' && mcapB < 200) return false;
      if (mcapFilter === '1T-' && mcapB < 1000) return false;
    }

    // RSI filter
    if (!inRange(t.rsi, rsiFilter)) return false;

    // Dividend yield
    if (!inRange(t.divYield, divFilter)) return false;

    // Volume vs avg
    if (volFilter) {
      const vr = t.volume_ratio || 0;
      if (volFilter === 'above' && vr < 1) return false;
      if (volFilter === 'below' && vr >= 1) return false;
      if (volFilter === '1.5x' && vr < 1.5) return false;
      if (volFilter === '2x' && vr < 2) return false;
    }

    // 52-week position
    if (w52Filter) {
      if (w52Filter === 'near-high' && (t.above_52w_high_pct == null || t.above_52w_high_pct > 5)) return false;
      if (w52Filter === 'near-low' && (t.below_52w_low_pct == null || t.below_52w_low_pct > 5)) return false;
      if (w52Filter === 'mid-range') {
        if (t.above_52w_high_pct == null || t.below_52w_low_pct == null) return false;
        if (t.above_52w_high_pct < 10 && t.below_52w_low_pct < 10) return false;
      }
    }

    // SMA position
    if (smaFilter) {
      if (smaFilter === 'above-both' && !(t.above_sma20 && t.above_sma50)) return false;
      if (smaFilter === 'below-both' && !(!t.above_sma20 && !t.above_sma50)) return false;
      if (smaFilter === 'golden-cross' && !(t.above_sma50 && !t.above_sma20)) return false;
      if (smaFilter === 'death-cross' && !(!t.above_sma50 && t.above_sma20)) return false;
    }

    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'score-desc': return (b.score || 0) - (a.score || 0);
      case 'score-asc':  return (a.score || 0) - (b.score || 0);
      case 'change-desc': return (b.change_pct || 0) - (a.change_pct || 0);
      case 'change-asc':  return (a.change_pct || 0) - (b.change_pct || 0);
      case 'rsi-asc':     return (a.rsi || 0) - (b.rsi || 0);
      case 'rsi-desc':    return (b.rsi || 0) - (a.rsi || 0);
      case 'mcap-desc':   return (b.marketCap || 0) - (a.marketCap || 0);
      case 'mcap-asc':    return (a.marketCap || 0) - (b.marketCap || 0);
      case 'pe-asc':      return (a.pe || Infinity) - (b.pe || Infinity);
      case 'pe-desc':     return (b.pe || 0) - (a.pe || 0);
      default: return 0;
    }
  });

  // Render
  const tbody = document.getElementById('screener-tbody');
  const countEl = document.getElementById('screener-count');
  if (tbody) {
    tbody.innerHTML = filtered.length
      ? filtered.map(t => this._tickerRow(t)).join('')
      : '<tr><td colspan="11" class="empty-state" style="padding:32px">No tickers match your filters.</td></tr>';
  }
  if (countEl) {
    countEl.textContent = `${filtered.length} of ${allTickers.length} tickers`;
  }
}
```

---

## 5. Filters — Summary Table

| Filter ID | Control Type | Options | Notes |
|-----------|-------------|---------|-------|
| `filter-pe` | `<select>` | Any, Value (<15), Moderate (15-25), Premium (25-50), High (>50) | Uses `inRange()` helper |
| `filter-mcap` | `<select>` | Any, Micro, Small, Mid, Large, Mega | Custom logic comparing raw marketCap to thresholds |
| `filter-div` | `<select>` | Any, Low (<1%), Moderate (1-3%), High (>3%) | Uses `inRange()` |
| `filter-rsi` | `<select>` | Any, Oversold (<30), Weak (30-45), Neutral (45-55), Strong (55-70), Overbought (>70) | Uses `inRange()` |
| `filter-sector` | `<select>` | All Sectors + dynamic list from data | Populated from unique sectors on load |
| `filter-volume` | `<select>` | Any, Above Avg, Below Avg, 1.5x+ Surge, 2x+ Surge | Checks volume_ratio |
| `filter-52w` | `<select>` | Any, Near High, Near Low, Mid Range | Uses above_52w_high_pct / below_52w_low_pct |
| `filter-sma` | `<select>` | Any, Above Both, Below Both, Golden Cross, Death Cross | Uses above_sma20 / above_sma50 booleans |
| `filter-score` | `<select>` | Any Score, 7+ (Strong), 5+ (Positive), 3+ (Weak) | Min score threshold |
| `filter-sort` | `<select>` | By Score, Change, RSI, Market Cap, PE (asc/desc) | JS sort comparator |
| `filter-search` | `<input>` | Free text | Matches ticker or name (case-insensitive) |
| `filter-reset` | `<button>` | — | Clears all filters |

---

## 6. Screener-Specific CSS: `assets/css/screener.css`

```css
/* ─────────────────────────────────────────────────────────────
   SCREENER FILTER BAR
   ───────────────────────────────────────────────────────────── */
.screener-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  background: var(--bg-card);
  border: 1px solid var(--border-dim);
  border-radius: var(--card-radius);
  padding: 16px 18px;
  margin-bottom: 16px;
  align-items: flex-end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 130px;
  flex: 1 0 auto;
}

.filter-group label {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.filter-group select,
.filter-group input[type="text"] {
  background: var(--bg-inset);
  border: 1px solid var(--border-dim);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  padding: 6px 10px;
  font-size: 0.8rem;
  font-family: var(--font-ui);
  min-height: 36px;
  outline: none;
  transition: border-color 0.15s;
}

.filter-group select:focus,
.filter-group input[type="text"]:focus {
  border-color: var(--accent);
}

.filter-group select option {
  background: var(--bg-card);
  color: var(--text-primary);
}

.screener-btn {
  background: var(--accent-dim);
  border: 1px solid var(--accent-border);
  color: var(--accent);
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  cursor: pointer;
  min-height: 36px;
  transition: background 0.12s;
  align-self: flex-end;
}

.screener-btn:hover {
  background: var(--accent);
  color: var(--accent-on);
}

.screener-count {
  text-align: right;
  padding: 8px 4px 0;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* Mobile: stack filters 2-col */
@media (max-width: 768px) {
  .screener-filters {
    gap: 8px;
    padding: 12px;
  }
  .filter-group {
    min-width: calc(50% - 8px);
    flex: 1 1 45%;
  }
  .filter-search {
    min-width: 100%;
  }
  .screener-btn {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .filter-group {
    min-width: 100%;
  }
}
```

---

## 7. Scoring System — Full Detail

The scoring algorithm runs in the Python script, NOT in the browser. Score is 1-10.

| Signal | Condition | Score Delta | Reason |
|--------|-----------|-------------|--------|
| RSI Oversold | RSI < 35 | +2 | `oversold_rsi` |
| RSI Weak | RSI 35-45 | +1 | `rsi_dip` |
| RSI Overbought | RSI > 75 | -2 | `overbought_rsi` |
| RSI Extended | RSI 65-75 | -1 | `extended_rsi` |
| Above SMAs | Price > SMA20 & SMA50 | +1 | `above_ma` |
| Below SMAs | Price < SMA20 & SMA50 | -1 | `below_ma` |
| Volume Surge | Volume Ratio > 1.5x | +1 | `volume_surge` |
| Near 52w High | Within 5% of 52w high | +1 | `near_high` |
| Near 52w Low | Within 5% of 52w low | -1 | `near_low` |
| Value PE | PE 1-15 | +1 | `value_pe` |
| Premium PE | PE > 30 | -1 | `premium_pe` |
| Analyst Buy | Recommended BUY/STRONG_BUY | +1 | `analyst_buy` |
| Analyst Sell | Recommended SELL/STRONG_SELL | -1 | `analyst_sell` |

Base score: 5. Clamped to 1-10. Max possible: 5+2+1+1+1+1+1 = 12 → clamped to 10. Min: 5-2-1-1-1-1 = -1 → clamped to 1.

---

## 8. Index.html Modification

In the scripts array (around line 73-78 of `index.html`), add `'screener'`:

```javascript
var scripts = [
  'utils', 'state', 'dashboard', 'watchlist', 'ticker-detail',
  'archive', 'paper-trades', 'prediction-engine', 'chat',
  'maplegamma', 'backtest-research', 'portfolio', 'simulation',
  'screener',          // ← ADD THIS
  'router', 'app'
];
```

Also add the screener CSS:
```javascript
var sheets = ['/assets/css/style.css', '/assets/css/maplegamma.css', '/assets/css/screener.css'];
```

---

## 9. app.js Modification

Add route registration (around line 60):
```javascript
Router.register('/screener',       function (app)         { Screener.render(app); });
```

Also add nav link in index.html:
```html
<a href="#/screener" class="nav-link">Screener</a>
```

---

## 10. Integration with Site Pipeline

### Pi Cron Addition
Add to the morning pipeline in `generate-site-data.sh`:
```bash
# 4. Generate screener data
python3 ~/.hermes/scripts/generate-screener-data.py \
  --output "$SITE_REPO/data/screener-data.json"
```

Or as a standalone cron:
```bash
# 6:30 AM weekdays — stock screener (before main briefing)
cronjob action=create \
  schedule="30 6 * * 1-5" \
  name="Stock Screener Data" \
  script=generate-screener-data.py \
  no_agent=true \
  workdir=/home/arshad14/morning-briefing-site
```

### Data Flow
```
Pi (6:30 AM)
  └─ generate-screener-data.py
       └─ yfinance (100 tickers)
            ├─ info (fundamentals)
            └─ history (technicals: RSI, SMA, volume)
       └─ compute scores (10 factors)
       └─ write data/screener-data.json
       └─ git commit + push → Cloudflare Pages deploy

Browser
  └─ index.html → loads screener.js
  └─ State.get('screener', '/data/screener-data.json')
  └─ Renders filter bar + sortable table
  └─ User selects filters → JS filters in-memory → re-renders tbody
```

---

## 11. Implementation Order (Buildable by Solo Dev)

| Step | File | Effort |
|------|------|--------|
| 1 | `pi-scripts/generate-screener-data.py` | ~150 lines — hardest part, test on Pi first |
| 2 | `data/screener-data.json` | Generated by step 1 (or create sample manually for dev) |
| 3 | `assets/css/screener.css` | ~80 lines — straightforward styling |
| 4 | `assets/js/screener.js` | ~300 lines — most frontend work |
| 5 | `index.html` | Add 2 lines (script + CSS + nav link) |
| 6 | `assets/js/app.js` | Add 1 route registration |
| 7 | **Test** | Load page, verify filters, check mobile responsive |

### YFinane Install on Pi
```bash
pip install yfinance pandas numpy
```

### First-run test
```bash
cd /Users/arshadkazi/morning-briefing
python3 pi-scripts/generate-screener-data.py --test-run  # fetches just 5 tickers to verify
```

---

## 12. Key Design Decisions

1. **No real-time data** — Screener uses EOD yfinance data, same as everything else. Stale by up to 18h during market hours? Yes, but acceptable for a morning briefing tool. The screener is a scan for ideas, not an execution tool.

2. **Scoring on Pi side** — Scores computed in Python so they're deterministic and consistent. The JS never recomputes scores — just filters on pre-computed values.

3. **Filters are client-side** — With 100 tickers and simple pattern matching, there's zero need for server-side filtering. All filtering is O(n) array operations in the browser, instant even on mobile.

4. **No ticker detail page** — Already exists at `#/ticker/X`. Screener links to it. Don't duplicate.

5. **Signals are kebab-case strings** — Matches existing `watchlist.js` pattern. Green badges for positive signals, red for negative. Renders via same logic.

6. **Market cap as raw number** — Keeps JSON portable. Frontend formats as "3.15T" or "45.2B". Avoid string-based comparisons in filtering.

7. **Same stale-data banner pattern** — `State.isStale(data.generated_at)` → yellow warning if >6 hours old. No extra work.
