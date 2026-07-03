/**
 * Screener — Stock screening page with filters, scoring, sortable table.
 * Scans 100 tickers with multi-factor scoring. Follows Watchlist.js patterns.
 */
const Screener = {
  _viewMode: 'table', // 'table' or 'treemap'
  _data: null,

  async render(app) {
    app.innerHTML = '<div class="loading">Loading screener data...</div>';

    const data = await State.get('screener', '/data/screener-data.json');
    if (!data || !data.tickers?.length) {
      app.innerHTML = '<div class="error-card">Failed to load screener data. Run the Pi script first.</div>';
      return;
    }

    this._data = data;
    this._viewMode = localStorage.getItem('screener-view') || 'table';
    this._showAll = false;

    let html = this._buildHeader(data);
    html += this._buildViewToggle();
    html += this._buildFilterBar(data.tickers);
    html += '<div id="screener-view-container">';
    html += this._viewMode === 'treemap' ? this._buildTreemap(data.tickers) : this._buildTable(data.tickers);
    html += '</div>';
    html += this._buildFooter(data);

    app.innerHTML = html;

    // Deep link from the sector heatmap: #/markets?filter=XLV → preselect sector
    const _q = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const _deepEtf = _q.get('filter');
    if (_deepEtf) {
      const _etfSector = {
        XLK: 'Technology', XLF: 'Financial Services', XLV: 'Healthcare',
        XLY: 'Consumer Cyclical', XLP: 'Consumer Defensive', XLE: 'Energy',
        XLI: 'Industrials', XLC: 'Communication Services', XLU: 'Utilities',
        XLRE: 'Real Estate', XLB: 'Basic Materials',
      };
      const _sectorSel = document.getElementById('filter-sector');
      if (_sectorSel && _etfSector[_deepEtf]) _sectorSel.value = _etfSector[_deepEtf];
    }

    // Wire up filter events (after DOM is rendered)
    this._wireFilters(data.tickers);
  },

  /** Page header with summary stats */
  _buildHeader(data) {
    const ms = data.market_summary || {};
    // The screener is a once-a-day scan (~10:30 AM ET, weekdays), so it's
    // only "stale" once it's from a prior trading day — not merely >6h old.
    const stale = State.isStaleDaily(data.generated_at);

    let html = '';
    if (stale) {
      const when = new Date(data.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      html += '<div class="stale-banner">⚠ Showing the ' + when + ' scan — the screener refreshes ~10:30 AM ET on trading days</div>';
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

  /** Filter bar — search + sort always visible, everything else in a drawer */
  _buildFilterBar(tickers) {
    // Collect unique sectors for dynamic population
    const sectors = [...new Set(tickers.filter(t => t.sector).map(t => t.sector))].sort();
    const sectorOpts = sectors.map(s => '<option value="' + s + '">' + s + '</option>').join('');
    const drawerOpen = localStorage.getItem('screener-drawer') === 'open';

    return '<div class="screener-filter-toolbar" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">' +
      '<button id="filter-drawer-toggle" class="screener-btn">Filters<span id="filter-active-count"></span> ' + (drawerOpen ? '▴' : '▾') + '</button>' +
      '<input type="text" id="filter-search" placeholder="Ticker or name..." style="min-width:170px" />' +
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
        '<option value="ticker-asc">Ticker (A→Z)</option>' +
        '<option value="ticker-desc">Ticker (Z→A)</option>' +
        '<option value="volume_ratio-asc">Vol Ratio (Low→High)</option>' +
        '<option value="volume_ratio-desc">Vol Ratio (High→Low)</option>' +
      '</select>' +
    '</div>' +
    '<div class="screener-filters" id="screener-filters"' + (drawerOpen ? '' : ' style="display:none"') + '>' +
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
        '<label>Universe</label>' +
        '<select id="filter-universe">' +
          '<option value="">All Universes</option>' +
          '<option value="S&P 500">S&P 500</option>' +
          '<option value="TSX 60">TSX 60</option>' +
          '<option value="Tech & Growth">Tech & Growth</option>' +
          '<option value="High Dividend">High Dividend</option>' +
          '<option value="Fixed Income & Commodities">Fixed Income & Commodities</option>' +
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
        '<label>Score Min</label>' +
        '<input type="number" id="filter-score-min" min="0" max="10" step="0.1" value="1" style="width:70px" />' +
      '</div>' +
      '<div class="filter-group">' +
        '<label>Score Max</label>' +
        '<input type="number" id="filter-score-max" min="0" max="10" step="0.1" value="10" style="width:70px" />' +
      '</div>' +
      '<div class="filter-group">' +
        '<label>Strategy</label>' +
        '<select id="filter-strategy">' +
          '<option value="">All</option>' +
          '<option value="momentum">Momentum</option>' +
          '<option value="breakout">Breakout</option>' +
          '<option value="mean_reversion">Mean Reversion</option>' +
          '<option value="support_resistance">Support/Resistance</option>' +
        '</select>' +
      '</div>' +
      '<div class="filter-group">' +
        '<label>Direction</label>' +
        '<select id="filter-direction">' +
          '<option value="">All</option>' +
          '<option value="long">Long</option>' +
          '<option value="short">Short</option>' +
        '</select>' +
      '</div>' +

      '<button id="filter-reset" class="screener-btn">Reset Filters</button>' +
    '</div>';
  },

  /** Table with sortable columns */
  _buildTable(tickers) {
    return '<div class="section"><div class="card table-wrap">' +
      '<table id="screener-table">' +
        '<thead><tr>' +
          '<th class="sortable" data-sort="ticker" style="cursor:pointer">Ticker <span class="sort-indicator"></span></th>' +
          '<th>Price</th>' +
          '<th class="sortable" data-sort="change" style="cursor:pointer">Chg% <span class="sort-indicator"></span></th>' +
          '<th class="sortable" data-sort="score" style="cursor:pointer">Score <span class="sort-indicator"></span></th>' +
          '<th>PE</th>' +
          '<th>Mkt Cap</th>' +
          '<th>Div%</th>' +
          '<th class="sortable" data-sort="rsi" style="cursor:pointer">RSI <span class="sort-indicator"></span></th>' +
          '<th class="sortable" data-sort="volume_ratio" style="cursor:pointer">Vol Ratio <span class="sort-indicator"></span></th>' +
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

  /** View toggle (table / treemap) */
  _buildViewToggle() {
    const activeTable = this._viewMode === 'table' ? 'active' : '';
    const activeTreemap = this._viewMode === 'treemap' ? 'active' : '';
    return '<div class="screener-view-toggle" id="screener-view-toggle">' +
      '<button class="view-btn ' + activeTable + '" data-view="table">📋 Table</button>' +
      '<button class="view-btn ' + activeTreemap + '" data-view="treemap">🗺 Treemap</button>' +
    '</div>';
  },

  /** Build Finviz-style CSS grid treemap */
  _buildTreemap(tickers) {
    if (!tickers || !tickers.length) {
      return '<div class="empty-state" style="padding:32px;text-align:center;color:var(--text-muted)">No tickers to display.</div>';
    }

    // Determine total volume for sizing (fall back to constant if none)
    const hasVolume = tickers.some(t => (t.volume || 0) > 0);
    const totalVolume = hasVolume ? tickers.reduce((s, t) => s + Math.max(1, t.volume || 1), 0) : tickers.length * 100;

    // Compute grid columns: aim for ~40-60 tiles per row, proportional to total count
    const tileCount = tickers.length;
    const gridCols = Math.max(8, Math.min(40, Math.ceil(Math.sqrt(tileCount * 2))));

    // Determine min/max change for color intensity scaling
    const changes = tickers.map(t => t.change_pct || 0);
    const maxPos = Math.max(0.01, ...changes.filter(c => c > 0));
    const maxNeg = Math.min(-0.01, ...changes.filter(c => c < 0));

    let html = '<div class="screener-treemap" id="screener-treemap" style="grid-template-columns:repeat(' + gridCols + ', 1fr)">';

    tickers.forEach(t => {
      const chg = t.change_pct || 0;
      const isPositive = chg >= 0;

      // Size based on volume (or market cap, or constant)
      const vol = hasVolume ? Math.max(1, t.volume || 1) : 100;
      const sizeRatio = vol / totalVolume;
      // Span: 1-4 columns and 1-3 rows based on volume percentile
      const colSpan = Math.max(1, Math.min(4, Math.ceil(sizeRatio * tileCount * 0.8)));
      const rowSpan = Math.max(1, Math.min(3, Math.ceil(sizeRatio * tileCount * 0.4)));

      // Color intensity
      const intensity = isPositive
        ? Math.min(1, chg / maxPos)
        : Math.min(1, Math.abs(chg) / Math.abs(maxNeg));

      const bgColor = isPositive
        ? 'rgba(76,175,80,' + (0.15 + intensity * 0.7) + ')'
        : 'rgba(239,83,80,' + (0.15 + intensity * 0.7) + ')';

      const borderColor = isPositive
        ? 'rgba(76,175,80,' + (0.2 + intensity * 0.5) + ')'
        : 'rgba(239,83,80,' + (0.2 + intensity * 0.5) + ')';

      html += '<a href="#/screener?filter=' + t.ticker + '" class="screener-tile" ' +
        'data-ticker="' + t.ticker + '" ' +
        'style="background:' + bgColor + ';border:1px solid ' + borderColor + ';' +
        'grid-column:span ' + colSpan + ';grid-row:span ' + rowSpan + '">';

      html += '<span class="tile-ticker">' + t.ticker + '</span>';
      html += '<span class="tile-change">' + (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%</span>';

      // Tooltip
      html += '<div class="tile-tooltip">';
      html += '<div class="tt-line"><span class="tt-label">Ticker</span><span class="tt-value">' + t.ticker + '</span></div>';
      html += '<div class="tt-line"><span class="tt-label">Score</span><span class="tt-value">' + Utils.scoreBadge(t.score) + '</span></div>';
      html += '<div class="tt-line"><span class="tt-label">Change</span><span class="tt-value">' + (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%</span></div>';
      html += '<div class="tt-line"><span class="tt-label">RSI</span><span class="tt-value">' + (t.rsi != null ? t.rsi.toFixed(1) : '—') + '</span></div>';
      html += '</div>';

      html += '</a>';
    });

    html += '</div>';
    return html;
  },

  /** Wire up all filter event handlers */
  _wireFilters(allTickers) {
    const filterIds = ['filter-pe', 'filter-mcap', 'filter-div', 'filter-rsi',
                       'filter-universe', 'filter-sector', 'filter-volume', 'filter-52w', 'filter-sma',
                       'filter-strategy', 'filter-direction', 'filter-score-min', 'filter-score-max',
                       'filter-sort', 'filter-search'];

    // Attach change/input handlers
    filterIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(id === 'filter-search' ? 'input' : 'change', () => {
        this._applyFilters(allTickers);
      });
      // Also listen for 'input' on number fields for real-time filtering
      if (el.type === 'number') {
        el.addEventListener('input', () => {
          this._applyFilters(allTickers);
        });
      }
    });

    // Clickable sort headers
    const table = document.getElementById('screener-table');
    if (table) {
      table.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
          const sortKey = th.dataset.sort;
          const currentSort = document.getElementById('filter-sort')?.value || '';
          const isAsc = currentSort === sortKey + '-asc';
          const newSort = isAsc ? sortKey + '-desc' : sortKey + '-asc';
          const sortEl = document.getElementById('filter-sort');
          if (sortEl) {
            sortEl.value = newSort;
            this._applyFilters(allTickers);
          }
        });
      });
    }

    // View toggle buttons
    const toggleContainer = document.getElementById('screener-view-toggle');
    if (toggleContainer) {
      toggleContainer.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const view = btn.dataset.view;
          if (view === this._viewMode) return;
          this._viewMode = view;
          localStorage.setItem('screener-view', view);
          // Update button active states
          toggleContainer.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          // Re-render the view container
          this._applyFilters(allTickers);
        });
      });
    }

    // Filter drawer toggle
    const drawerToggle = document.getElementById('filter-drawer-toggle');
    if (drawerToggle) {
      drawerToggle.addEventListener('click', () => {
        const drawer = document.getElementById('screener-filters');
        if (!drawer) return;
        const isOpen = drawer.style.display !== 'none';
        drawer.style.display = isOpen ? 'none' : '';
        localStorage.setItem('screener-drawer', isOpen ? 'closed' : 'open');
        drawerToggle.innerHTML = drawerToggle.innerHTML.replace(isOpen ? '▴' : '▾', isOpen ? '▾' : '▴');
      });
    }

    // Reset button
    const resetBtn = document.getElementById('filter-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        filterIds.forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            if (el.type === 'number') el.value = el.id === 'filter-score-min' ? '1' : el.id === 'filter-score-max' ? '10' : '';
            else el.value = '';
          }
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
    const strategyFilter = val('filter-strategy').toLowerCase().trim();
    const directionFilter = val('filter-direction').toLowerCase().trim();
    const sortBy       = val('filter-sort') || 'score-desc';
    const search       = val('filter-search').toLowerCase().trim();

    // Score range
    const scoreMin = parseFloat(document.getElementById('filter-score-min')?.value) || 0;
    const scoreMax = parseFloat(document.getElementById('filter-score-max')?.value) || 10;

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

      // Universe
      if (sectorFilter === '') {
        var universeFilter = val('filter-universe');
        if (universeFilter) {
          // Consolidate S&P 500 variant universes into one
          var tickerUniverse = t.universe || '';
          if (universeFilter === 'S&P 500' && tickerUniverse.startsWith('S&P 500')) {
            // match
          } else if (tickerUniverse !== universeFilter) {
            return false;
          }
        }
      }

      // Min/Max Score range
      const tScore = t.score || 0;
      if (tScore < scoreMin || tScore > scoreMax) return false;

      // Strategy filter
      if (strategyFilter && (t.signal || '').toLowerCase().replace(/[^a-z_]/g, '') !== strategyFilter) return false;

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
        const vr = t.volume_ratio != null ? t.volume_ratio : (t.vol_ratio != null ? t.vol_ratio : 0);
        if (volFilter === 'above' && vr < 1) return false;
        if (volFilter === 'below' && vr >= 1) return false;
        if (volFilter === '1.5x' && vr < 1.5) return false;
        if (volFilter === '2x' && vr < 2) return false;
      }

      // Direction filter
      if (directionFilter && (t.direction || '').toLowerCase() !== directionFilter) return false;

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
        case 'ticker-asc':  return (a.ticker || '').localeCompare(b.ticker || '');
        case 'ticker-desc': return (b.ticker || '').localeCompare(a.ticker || '');
        case 'volume_ratio-asc':  return (a.volume_ratio != null ? a.volume_ratio : (a.vol_ratio != null ? a.vol_ratio : 0)) - (b.volume_ratio != null ? b.volume_ratio : (b.vol_ratio != null ? b.vol_ratio : 0));
        case 'volume_ratio-desc': return (b.volume_ratio != null ? b.volume_ratio : (b.vol_ratio != null ? b.vol_ratio : 0)) - (a.volume_ratio != null ? a.volume_ratio : (a.vol_ratio != null ? a.vol_ratio : 0));
        default: return 0;
      }
    });

    // Active-filter count on the drawer button — "Filters (3)" beats
    // fifteen always-open dropdowns for telling you what's applied.
    const _activeCount = [peFilter, mcapFilter, divFilter, rsiFilter, sectorFilter, volFilter,
      w52Filter, smaFilter, strategyFilter, directionFilter, val('filter-universe')].filter(Boolean).length
      + ((scoreMin !== 0 && scoreMin !== 1) || (scoreMax !== 10) ? 1 : 0);
    const _countBadge = document.getElementById('filter-active-count');
    if (_countBadge) _countBadge.textContent = _activeCount ? ' (' + _activeCount + ')' : '';

    // Render
    const tbody = document.getElementById('screener-tbody');
    const countEl = document.getElementById('screener-count');
    const viewContainer = document.getElementById('screener-view-container');
    if (viewContainer) {
      if (this._viewMode === 'treemap') {
        viewContainer.innerHTML = this._buildTreemap(filtered);
      } else {
        viewContainer.innerHTML = this._buildTable(allTickers);
        // Re-wire sortable headers on the newly rendered table
        const newTable = document.getElementById('screener-table');
        if (newTable) {
          newTable.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
              const sortKey = th.dataset.sort;
              const currentSort = document.getElementById('filter-sort')?.value || '';
              const isAsc = currentSort === sortKey + '-asc';
              const newSort = isAsc ? sortKey + '-desc' : sortKey + '-asc';
              const sortEl = document.getElementById('filter-sort');
              if (sortEl) {
                sortEl.value = newSort;
                this._applyFilters(allTickers);
              }
            });
          });
        }
        // Populate the newly rendered table body with filtered data
        const newTbody = document.getElementById('screener-tbody');
        if (newTbody) {
          newTbody.innerHTML = this._renderRows(filtered);
          this._wireShowAll(allTickers);
        }
      }
      // Update count for both views
      const newCountEl = document.getElementById('screener-count');
      if (newCountEl) {
        newCountEl.textContent = filtered.length + ' of ' + allTickers.length + ' tickers';
      }
    }
    // Legacy fallback (for when viewContainer doesn't exist)
    if (!viewContainer) {
      const tbody = document.getElementById('screener-tbody');
      const countEl = document.getElementById('screener-count');
      if (tbody) {
        tbody.innerHTML = this._renderRows(filtered);
        this._wireShowAll(allTickers);
      }
      if (countEl) {
        countEl.textContent = filtered.length + ' of ' + allTickers.length + ' tickers';
      }
    }
  },

  /** Render table rows, capped at 150 until "Show all" is clicked —
      600 rows of DOM on initial paint helps nobody, least of all phones. */
  _renderRows(filtered) {
    const CAP = 150;
    const rows = (this._showAll ? filtered : filtered.slice(0, CAP)).map(t => this._tickerRow(t)).join('');
    let html = rows || '<tr><td colspan="11" class="empty-state" style="padding:32px;text-align:center">No tickers match your filters.</td></tr>';
    if (!this._showAll && filtered.length > CAP) {
      html += '<tr><td colspan="11" style="text-align:center;padding:10px"><button id="screener-show-all" class="screener-btn">Show all ' + filtered.length + ' tickers</button></td></tr>';
    }
    return html;
  },

  _wireShowAll(allTickers) {
    const btn = document.getElementById('screener-show-all');
    if (btn) {
      btn.addEventListener('click', () => {
        this._showAll = true;
        this._applyFilters(allTickers);
      });
    }
  },

  /** Format a single ticker row with color-coded cells */
  _tickerRow(t) {
    const cls = Utils.changeClass(t.change_pct);
    const mcap = t.marketCap ? Utils.formatPrice(t.marketCap / 1e9, 1) + 'B' : '—';
    const signals = (t.signals || []).map(s => {
      const bg = s.includes('over') || s.includes('bear') || s.includes('below') ||
                 s.includes('low') || s.includes('extended') || s.includes('death') || s.includes('premium') || s.includes('sell')
        ? 'badge-red' : 'badge-green';
      return '<span class="badge ' + bg + '" style="margin:1px">' + s.replace(/_/g, ' ') + '</span>';
    }).join(' ');

    // Score: green gradient (higher = darker green)
    const score = t.score || 0;
    const scoreOpacity = score / 10;
    const scoreStyle = 'background:rgba(76,175,80,' + (0.12 + scoreOpacity * 0.35) + ');font-weight:700;border-radius:4px;padding:2px 6px';

    // RSI: red when oversold (<30), green when overbought (>70)
    let rsiCell = '<td>' + (t.rsi != null ? t.rsi.toFixed(1) : '—') + '</td>';
    if (t.rsi != null) {
      if (t.rsi < 30) {
        rsiCell = '<td style="color:var(--red);font-weight:700;background:rgba(239,83,80,0.12);border-radius:4px">' + t.rsi.toFixed(1) + '</td>';
      } else if (t.rsi > 70) {
        rsiCell = '<td style="color:var(--green);font-weight:700;background:rgba(76,175,80,0.12);border-radius:4px">' + t.rsi.toFixed(1) + '</td>';
      }
    }

    // Volume ratio: blue highlight when > 2x average
    const volRatio = t.volume_ratio != null ? t.volume_ratio : (t.vol_ratio != null ? t.vol_ratio : null);
    let volCell = '<td>' + (volRatio != null ? volRatio.toFixed(2) + 'x' : '—') + '</td>';
    if (volRatio != null && volRatio > 2) {
      volCell = '<td style="color:var(--blue);font-weight:700;background:rgba(124,185,244,0.12);border-radius:4px">' + volRatio.toFixed(2) + 'x</td>';
    }

    return '<tr>' +
      '<td><a href="#/ticker/' + t.ticker + '" class="archive-date">' + t.ticker + '</a></td>' +
      '<td>' + Utils.formatPrice(t.price) + '</td>' +
      '<td class="' + cls + '">' + Utils.formatPct(t.change_pct) + '</td>' +
      '<td style="text-align:center"><span style="' + scoreStyle + '">' + Utils.scoreBadge(t.score) + '</span></td>' +
      '<td>' + (t.pe != null ? t.pe.toFixed(1) : '—') + '</td>' +
      '<td style="font-size:0.8rem">' + mcap + '</td>' +
      '<td>' + (t.divYield != null && t.divYield > 0 ? t.divYield.toFixed(2) + '%' : '—') + '</td>' +
      rsiCell +
      volCell +
      '<td style="font-size:0.75rem;color:var(--text-muted)">' + (t.sector ? t.sector.substring(0, 12) : '—') + '</td>' +
      '<td style="max-width:200px">' + (signals || '—') + '</td>' +
    '</tr>';
  },
};
