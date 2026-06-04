/**
 * Screener — Stock screening page with filters, scoring, sortable table.
 * Scans 100 tickers with multi-factor scoring. Follows Watchlist.js patterns.
 */
const Screener = {
  async render(app) {
    app.innerHTML = '<div class="loading">Loading screener data...</div>';

    const data = await State.get('screener', '/data/screener-data.json');
    if (!data || !data.tickers?.length) {
      app.innerHTML = '<div class="error-card">Failed to load screener data. Run the Pi script first.</div>';
      return;
    }

    let html = this._buildHeader(data);
    html += this._buildFilterBar(data.tickers);
    html += this._buildTable(data.tickers);
    html += this._buildFooter(data);

    app.innerHTML = html;

    // Wire up filter events (after DOM is rendered)
    this._wireFilters(data.tickers);
  },

  /** Page header with summary stats */
  _buildHeader(data) {
    const ms = data.market_summary || {};
    const stale = State.isStale(data.generated_at);

    let html = '';
    if (stale) {
      html += '<div class="stale-banner">⚠ Data from ' + new Date(data.generated_at).toLocaleTimeString() + ' — may be stale</div>';
    }

    html += '<div class="section"><h2 class="section-title">Stock Screener</h2>';

    html += '<div class="grid-4" style="margin-bottom:16px">';
    html += '<div class="card"><div class="card-title">Scanned</div><div class="index-price">' + data.ticker_count + '</div></div>';
    html += '<div class="card"><div class="card-title">Avg Score</div><div class="index-price">' + (ms.avg_score != null ? Utils.scoreBadge(Math.round(ms.avg_score)) : '—') + '</div></div>';
    html += '<div class="card"><div class="card-title">Green</div><div class="index-price" style="color:var(--green)">' + (ms.green_count || 0) + '</div></div>';
    html += '<div class="card"><div class="card-title">Red</div><div class="index-price" style="color:var(--red)">' + (ms.red_count || 0) + '</div></div>';
    html += '</div>';

    html += '</div>';
    return html;
  },

  /** Filter bar with all filter controls */
  _buildFilterBar(tickers) {
    // Collect unique sectors for dynamic population
    const sectors = [...new Set(tickers.filter(t => t.sector).map(t => t.sector))].sort();
    const sectorOpts = sectors.map(s => '<option value="' + s + '">' + s + '</option>').join('');

    return '<div class="screener-filters" id="screener-filters">' +
      '<div class="filter-group">' +
        '<label>PE Ratio</label>' +
        '<select id="filter-pe">' +
          '<option value="">Any</option>' +
          '<option value="0-15">Value (&lt;15)</option>' +
          '<option value="15-25">Moderate (15-25)</option>' +
          '<option value="25-50">Premium (25-50)</option>' +
          '<option value="50-">High (&gt;50)</option>' +
        '</select>' +
      '</div>' +

      '<div class="filter-group">' +
        '<label>Market Cap</label>' +
        '<select id="filter-mcap">' +
          '<option value="">Any</option>' +
          '<option value="0-2B">Micro</option>' +
          '<option value="2B-10B">Small</option>' +
          '<option value="10B-200B">Mid</option>' +
          '<option value="200B-">Large</option>' +
          '<option value="1T-">Mega (&gt;1T)</option>' +
        '</select>' +
      '</div>' +

      '<div class="filter-group">' +
        '<label>Dividend Yield</label>' +
        '<select id="filter-div">' +
          '<option value="">Any</option>' +
          '<option value="0-1">Low (&lt;1%)</option>' +
          '<option value="1-3">Moderate (1-3%)</option>' +
          '<option value="3-">High (&gt;3%)</option>' +
        '</select>' +
      '</div>' +

      '<div class="filter-group">' +
        '<label>RSI</label>' +
        '<select id="filter-rsi">' +
          '<option value="">Any</option>' +
          '<option value="0-30">Oversold (&lt;30)</option>' +
          '<option value="30-45">Weak (30-45)</option>' +
          '<option value="45-55">Neutral (45-55)</option>' +
          '<option value="55-70">Strong (55-70)</option>' +
          '<option value="70-">Overbought (&gt;70)</option>' +
        '</select>' +
      '</div>' +

      '<div class="filter-group">' +
        '<label>Sector</label>' +
        '<select id="filter-sector">' +
          '<option value="">All Sectors</option>' +
          sectorOpts +
        '</select>' +
      '</div>' +

      '<div class="filter-group">' +
        '<label>Volume vs Avg</label>' +
        '<select id="filter-volume">' +
          '<option value="">Any</option>' +
          '<option value="above">Above Average</option>' +
          '<option value="below">Below Average</option>' +
          '<option value="1.5x">1.5x+ Surge</option>' +
          '<option value="2x">2x+ Surge</option>' +
        '</select>' +
      '</div>' +

      '<div class="filter-group">' +
        '<label>Price vs 52w</label>' +
        '<select id="filter-52w">' +
          '<option value="">Any</option>' +
          '<option value="near-high">Near High (&lt;5%)</option>' +
          '<option value="near-low">Near Low (&lt;5%)</option>' +
          '<option value="mid-range">Mid Range</option>' +
        '</select>' +
      '</div>' +

      '<div class="filter-group">' +
        '<label>Price vs SMAs</label>' +
        '<select id="filter-sma">' +
          '<option value="">Any</option>' +
          '<option value="above-both">Above 20 &amp; 50</option>' +
          '<option value="below-both">Below 20 &amp; 50</option>' +
          '<option value="golden-cross">Golden Cross</option>' +
          '<option value="death-cross">Death Cross</option>' +
        '</select>' +
      '</div>' +

      '<div class="filter-group">' +
        '<label>Min Score</label>' +
        '<select id="filter-score">' +
          '<option value="0">Any Score</option>' +
          '<option value="7">7+ (Strong)</option>' +
          '<option value="5">5+ (Positive)</option>' +
          '<option value="3">3+ (Weak)</option>' +
        '</select>' +
      '</div>' +

      '<div class="filter-group">' +
        '<label>Sort By</label>' +
        '<select id="filter-sort">' +
          '<option value="score-desc">Score (High→Low)</option>' +
          '<option value="score-asc">Score (Low→High)</option>' +
          '<option value="change-desc">Change (High→Low)</option>' +
          '<option value="change-asc">Change (Low→High)</option>' +
          '<option value="rsi-asc">RSI (Low→High)</option>' +
          '<option value="rsi-desc">RSI (High→Low)</option>' +
          '<option value="mcap-desc">Market Cap (Large→Small)</option>' +
          '<option value="mcap-asc">Market Cap (Small→Large)</option>' +
          '<option value="pe-asc">PE (Low→High)</option>' +
          '<option value="pe-desc">PE (High→Low)</option>' +
        '</select>' +
      '</div>' +

      '<div class="filter-group filter-search">' +
        '<label>Search</label>' +
        '<input type="text" id="filter-search" placeholder="Ticker or name..." />' +
      '</div>' +

      '<button id="filter-reset" class="screener-btn">Reset Filters</button>' +
    '</div>';
  },

  /** Table with sortable columns */
  _buildTable(tickers) {
    return '<div class="section"><div class="card table-wrap">' +
      '<table>' +
        '<thead><tr>' +
          '<th>Ticker</th>' +
          '<th>Price</th>' +
          '<th>Chg%</th>' +
          '<th>Score</th>' +
          '<th>PE</th>' +
          '<th>Mkt Cap</th>' +
          '<th>Div%</th>' +
          '<th>RSI</th>' +
          '<th>Vol Ratio</th>' +
          '<th>Sector</th>' +
          '<th>Signals</th>' +
        '</tr></thead>' +
        '<tbody id="screener-tbody">' +
          '<!-- Populated by _applyFilters() -->' +
        '</tbody>' +
      '</table>' +
      '<div id="screener-count" class="screener-count"></div>' +
    '</div></div>';
  },

  /** Timestamp footer */
  _buildFooter(data) {
    if (!data.generated_at) return '';
    return '<div style="text-align:center;color:var(--text-muted);font-size:0.8rem;padding:16px">Generated ' +
      new Date(data.generated_at).toLocaleString() + '</div>';
  },

  /** Wire up all filter event handlers */
  _wireFilters(allTickers) {
    const filterIds = ['filter-pe', 'filter-mcap', 'filter-div', 'filter-rsi',
                       'filter-sector', 'filter-volume', 'filter-52w', 'filter-sma',
                       'filter-score', 'filter-sort', 'filter-search'];

    // Attach change/input handlers
    filterIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(id === 'filter-search' ? 'input' : 'change', () => {
        this._applyFilters(allTickers);
      });
    });

    // Reset button
    const resetBtn = document.getElementById('filter-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        filterIds.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
        document.getElementById('filter-search') && (document.getElementById('filter-search').value = '');
        this._applyFilters(allTickers);
      });
    }

    // Initial render
    this._applyFilters(allTickers);
  },

  /** Apply current filter state to tickers and re-render table */
  _applyFilters(allTickers) {
    const val = id => document.getElementById(id)?.value || '';

    const peFilter     = val('filter-pe');
    const mcapFilter   = val('filter-mcap');
    const divFilter    = val('filter-div');
    const rsiFilter    = val('filter-rsi');
    const sectorFilter = val('filter-sector');
    const volFilter    = val('filter-volume');
    const w52Filter    = val('filter-52w');
    const smaFilter    = val('filter-sma');
    const scoreFilter  = parseInt(val('filter-score')) || 0;
    const sortBy       = val('filter-sort') || 'score-desc';
    const search       = val('filter-search').toLowerCase().trim();

    // Helper: test a range filter like "0-15" or "50-"
    const inRange = (value, filter) => {
      if (!filter) return true;
      if (value == null) return false;
      const parts = filter.split('-');
      if (parts.length !== 2) return true;
      let [lo, hi] = parts;
      if (lo !== '' && parseFloat(lo) && value < parseFloat(lo)) return false;
      if (hi !== '' && parseFloat(hi) && value > parseFloat(hi)) return false;
      // Handle open-ended (e.g., "50-" only lo, or "0-15" both)
      if (lo !== '' && hi === '') {
        // open-ended upper: value >= lo
        // Actually we want "50-" = value > 50
        // But in the filter parsing, "50-" means lo=50, hi=''
        // Already handled above: if lo is set and value < lo, reject
        // But what about lo='' ? That'd be "-50" which means <50 — handled by hi
      }
      return true;
    };

    let filtered = allTickers.filter(t => {
      // Search
      if (search && !t.ticker.toLowerCase().includes(search) &&
          !(t.name || '').toLowerCase().includes(search)) return false;

      // PE filter
      if (!inRange(t.pe, peFilter)) return false;

      // Sector
      if (sectorFilter && t.sector !== sectorFilter) return false;

      // Min Score
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
        : '<tr><td colspan="11" class="empty-state" style="padding:32px;text-align:center">No tickers match your filters.</td></tr>';
    }
    if (countEl) {
      countEl.textContent = filtered.length + ' of ' + allTickers.length + ' tickers';
    }
  },

  /** Format a single ticker row */
  _tickerRow(t) {
    const cls = Utils.changeClass(t.change_pct);
    const mcap = t.marketCap ? Utils.formatPrice(t.marketCap / 1e9, 1) + 'B' : '—';
    const signals = (t.signals || []).map(s => {
      const bg = s.includes('over') || s.includes('bear') || s.includes('below') ||
                 s.includes('low') || s.includes('extended') || s.includes('death') || s.includes('premium') || s.includes('sell')
        ? 'badge-red' : 'badge-green';
      return '<span class="badge ' + bg + '" style="margin:1px">' + s.replace(/_/g, ' ') + '</span>';
    }).join(' ');

    return '<tr>' +
      '<td><a href="#/ticker/' + t.ticker + '" class="archive-date">' + t.ticker + '</a></td>' +
      '<td>' + Utils.formatPrice(t.price) + '</td>' +
      '<td class="' + cls + '">' + Utils.formatPct(t.change_pct) + '</td>' +
      '<td>' + Utils.scoreBadge(t.score) + '</td>' +
      '<td>' + (t.pe != null ? t.pe.toFixed(1) : '—') + '</td>' +
      '<td style="font-size:0.8rem">' + mcap + '</td>' +
      '<td>' + (t.divYield != null && t.divYield > 0 ? t.divYield.toFixed(2) + '%' : '—') + '</td>' +
      '<td>' + (t.rsi != null ? t.rsi.toFixed(1) : '—') + '</td>' +
      '<td>' + (t.volume_ratio != null ? t.volume_ratio.toFixed(2) + 'x' : '—') + '</td>' +
      '<td style="font-size:0.75rem;color:var(--text-muted)">' + (t.sector ? t.sector.substring(0, 12) : '—') + '</td>' +
      '<td style="max-width:200px">' + (signals || '—') + '</td>' +
    '</tr>';
  },
};
