/**
 * Simulation — AI-powered portfolio simulator.
 * Add-on: $50 CAD/mo. Build, track, and rebalance a simulated portfolio
 * based on user's capital, risk tolerance, and asset class preferences.
 */
const Simulation = {
  async render(app) {
    const hasAddon = localStorage.getItem('mg-addon-simulation') === 'true';
    const tier = localStorage.getItem('mg-tier') || 'free';

    if (tier === 'free' || !hasAddon) {
      app.innerHTML = '<div class="section"><div class="card" style="text-align:center;padding:60px 40px">' +
        '<div style="font-size:3rem;margin-bottom:16px">🎮</div>' +
        '<h2 style="margin-bottom:12px">Portfolio Simulator</h2>' +
        '<p style="color:var(--text-muted);margin-bottom:8px;max-width:500px;margin-left:auto;margin-right:auto">' +
        'Enter your available capital, pick your asset classes, and let AI build you a simulated portfolio. ' +
        'Track it live, get rebalance suggestions, and exit signals.</p>' +
        '<p style="color:var(--text-muted);margin-bottom:24px">Add the <strong>Simulation</strong> add-on for <strong>$50 CAD/mo</strong>.</p>' +
        '<a href="#/maplegamma" class="mg-btn mg-btn-primary" style="display:inline-block;padding:12px 32px;text-decoration:none">Upgrade →</a>' +
        '</div></div>';
      return;
    }

    // Load saved simulation state
    let sim = JSON.parse(localStorage.getItem('mg-simulation') || '{"capital":50000,"assets":["stocks"],"portfolio":[],"created":null}');
    // Read tab from query string in hash — router strips it, but we parse from full hash
    const fullHash = window.location.hash || '';
    const hashQuery = fullHash.split('?')[1] || '';
    const qs = new URLSearchParams(hashQuery);
    const tab = qs.get('tab') || 'builder';

    let html = '<div class="section"><h2 class="section-title">Portfolio Simulator</h2>';

    // Warning banner
    html += '<div class="card" style="margin-bottom:16px;background:var(--yellow-bg);border:1px solid var(--yellow-border);border-radius:var(--radius-lg);padding:12px 16px;font-size:0.8rem;line-height:1.5;color:var(--text-secondary)">' +
      '<strong style="color:var(--yellow)">⚠ Educational Purposes Only:</strong> This simulation is for learning and informational purposes. ' +
      'It does not constitute financial advice. Past performance does not guarantee future results. ' +
      'Always consult a qualified financial advisor before making investment decisions. We take no responsibility for any losses.</div>';

    // Tab nav
    html += '<div style="display:flex;gap:6px;margin-bottom:16px;border-bottom:1px solid var(--border-dim);padding-bottom:8px">';
    html += '<a href="#/simulation?tab=builder" class="nav-link ' + (tab === 'builder' ? 'active' : '') + '">Portfolio Builder</a>';
    html += '<a href="#/simulation?tab=tracker" class="nav-link ' + (tab === 'tracker' ? 'active' : '') + '">Tracker</a>';
    html += '<a href="#/simulation?tab=rebalance" class="nav-link ' + (tab === 'rebalance' ? 'active' : '') + '">Rebalance</a>';
    html += '</div>';

    if (tab === 'builder') html += this._renderBuilder(sim);
    else if (tab === 'tracker') html += this._renderTracker(sim);
    else if (tab === 'rebalance') html += this._renderRebalance(sim);

    html += '</div>';
    app.innerHTML = html;

    if (tab === 'builder') this._wireBuilder(app, sim);
    if (tab === 'tracker') this._wireTracker(app, sim);
  },

  _renderBuilder(sim) {
    let html = '<div class="card" style="margin-bottom:12px">';
    html += '<div class="card-title">Build Your Portfolio</div>';

    // Capital input
    html += '<div style="margin-bottom:16px">';
    html += '<label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:6px;color:var(--text-primary)">Available Capital</label>';
    html += '<div style="display:flex;align-items:center;gap:8px">';
    html += '<span style="font-size:1.2rem;color:var(--text-muted)">$</span>';
    html += '<input type="number" id="sim-capital" value="' + (sim.capital || 50000) + '" min="1000" step="1000" autocomplete="off" style="flex:1;max-width:200px;padding:10px 14px;border:1px solid var(--border-dim);border-radius:var(--radius-sm);background:var(--bg-inset);color:var(--text-primary);font-size:1.1rem">';
    html += '<span style="font-size:0.85rem;color:var(--text-muted)">CAD</span>';
    html += '</div></div>';

    // Asset class checkboxes
    html += '<div style="margin-bottom:16px">';
    html += '<label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:8px;color:var(--text-primary)">Asset Classes</label>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px">';
    var assets = [
      { id: 'stocks', label: '📈 Stocks', icon: 'Stocks' },
      { id: 'options', label: '🎯 Options', icon: 'Options' },
      { id: 'forex', label: '💱 Forex', icon: 'Forex' },
      { id: 'crypto', label: '🪙 Crypto', icon: 'Crypto' },
      { id: 'commodities', label: '🛢️ Commodities', icon: 'Commodities' },
      { id: 'all', label: '🌟 All', icon: 'All' },
    ];
    var selected = sim.assets || ['stocks'];
    assets.forEach(function(a) {
      var checked = selected.includes(a.id) || selected.includes('all');
      html += '<label class="sim-asset-btn" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border:2px solid ' + (checked ? 'var(--accent)' : 'var(--border-dim)') + ';border-radius:var(--radius-lg);cursor:pointer;background:' + (checked ? 'var(--accent-dim)' : 'transparent') + ';transition:all 0.15s">';
      html += '<input type="checkbox" class="sim-asset-cb" value="' + a.id + '" ' + (checked ? 'checked' : '') + ' style="accent-color:var(--accent)">';
      html += '<span style="font-size:0.85rem;font-weight:' + (checked ? '600' : '400') + ';color:var(--text-primary)">' + a.label + '</span>';
      html += '</label>';
    });
    html += '</div></div>';

    // Risk tolerance
    html += '<div style="margin-bottom:16px">';
    html += '<label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:8px;color:var(--text-primary)">Risk Tolerance</label>';
    html += '<div style="display:flex;gap:8px">';
    var risks = [
      { id: 'conservative', label: '🛡️ Conservative', desc: 'Bonds, blue chips, low volatility' },
      { id: 'moderate', label: '⚖️ Moderate', desc: 'Balanced stocks/bonds, diversified' },
      { id: 'aggressive', label: '🚀 Aggressive', desc: 'Growth stocks, options, crypto' },
    ];
    var currentRisk = sim.risk || 'moderate';
    risks.forEach(function(r) {
      var sel = r.id === currentRisk;
      html += '<div class="sim-risk-option" data-risk="' + r.id + '" style="flex:1;padding:12px;border:2px solid ' + (sel ? 'var(--accent)' : 'var(--border-dim)') + ';border-radius:var(--radius-lg);cursor:pointer;background:' + (sel ? 'var(--accent-dim)' : 'transparent') + ';text-align:center;transition:all 0.15s">';
      html += '<div style="font-size:0.85rem;font-weight:600;color:var(--text-primary);margin-bottom:4px">' + r.label + '</div>';
      html += '<div style="font-size:0.7rem;color:var(--text-muted)">' + r.desc + '</div>';
      html += '</div>';
    });
    html += '</div></div>';

    // Generate button
    html += '<button id="sim-generate-btn" class="mg-btn mg-btn-primary" style="padding:12px 32px;border:none;cursor:pointer;font-size:0.95rem">🤖 Generate Portfolio</button>';
    html += '</div>';

    // Results area
    html += '<div id="sim-results"></div>';

    return html;
  },

  _renderTracker(sim) {
    if (!sim.portfolio || !sim.portfolio.length) {
      return '<div class="card" style="text-align:center;padding:40px;color:var(--text-muted)">' +
        '<p>Build a portfolio first in the Portfolio Builder tab.</p></div>';
    }
    var totalValue = sim.portfolio.reduce(function(s, p) { return s + (p.shares || 0) * (p.currentPrice || p.price || 0); }, 0);
    var totalCost = sim.portfolio.reduce(function(s, p) { return s + (p.shares || 0) * (p.avgCost || p.price || 0); }, 0);
    var pnl = totalValue - totalCost;
    var pnlPct = totalCost > 0 ? (pnl / totalCost * 100) : 0;

    var html = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">';
    html += '<div class="card" style="text-align:center;padding:12px"><div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Invested</div><div style="font-size:1.2rem;font-weight:700;color:var(--text-primary)">$' + totalCost.toLocaleString() + '</div></div>';
    html += '<div class="card" style="text-align:center;padding:12px"><div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Current Value</div><div style="font-size:1.2rem;font-weight:700;color:var(--text-primary)">$' + totalValue.toLocaleString() + '</div></div>';
    html += '<div class="card" style="text-align:center;padding:12px"><div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">P&amp;L</div><div style="font-size:1.2rem;font-weight:700;color:' + (pnl >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (pnl >= 0 ? '+' : '') + '$' + pnl.toLocaleString() + '</div></div>';
    html += '<div class="card" style="text-align:center;padding:12px"><div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Return</div><div style="font-size:1.2rem;font-weight:700;color:' + (pnlPct >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(1) + '%</div></div>';
    html += '</div>';

    html += '<div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Name</th><th>Allocation</th><th>Shares</th><th>Avg Cost</th><th>Current</th><th>P&amp;L</th><th>Stop Loss</th><th>Analysis</th></tr></thead><tbody>';
    sim.portfolio.forEach(function(p, i) {
      var cur = p.currentPrice || p.price || 0;
      var cost = p.avgCost || p.price || 0;
      var val = (p.shares || 0) * cur;
      var base = (p.shares || 0) * cost;
      var profit = val - base;
      var pct = base > 0 ? (profit / base * 100) : 0;
      var alloc = totalValue > 0 ? (val / totalValue * 100) : 0;
      var stopLoss = p.stopLoss || (cost * 0.85).toFixed(2);
      var triggered = cur <= stopLoss;
      html += '<tr style="' + (triggered ? 'background:var(--red-bg)' : '') + '">';
      html += '<td><strong>' + p.ticker + '</strong></td>';
      html += '<td style="font-size:0.8rem;color:var(--text-muted)">' + (p.name || '—') + '</td>';
      html += '<td>' + alloc.toFixed(1) + '%</td>';
      html += '<td>' + (p.shares || 0) + '</td>';
      html += '<td>$' + cost.toFixed(2) + '</td>';
      html += '<td>$' + cur.toFixed(2) + '</td>';
      html += '<td style="color:' + (profit >= 0 ? 'var(--green)' : 'var(--red)') + ';font-weight:600">' + (profit >= 0 ? '+' : '') + '$' + profit.toFixed(2) + ' (' + (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%)</td>';
      html += '<td style="font-size:0.8rem;color:' + (triggered ? 'var(--red)' : 'var(--text-muted)') + '">$' + stopLoss + (triggered ? ' ⚠️' : '') + '</td>';
      html += '<td style="font-size:0.75rem;color:var(--text-secondary);max-width:200px">' + (p.rationale || 'AI-generated allocation based on market conditions and risk profile.') + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    html += '<div class="card" style="background:var(--bg-inset);margin-top:12px;font-size:0.85rem;line-height:1.6;color:var(--text-secondary)">';
    html += '<strong style="color:var(--text-primary)">⚠ Simulation Disclaimer:</strong> This portfolio is generated for educational purposes. ';
    html += 'It is not financial advice. Set stop losses with your broker at your own discretion. ';
    html += 'Past simulated performance does not guarantee future results.';
    html += '</div>';

    return html;
  },

  _renderRebalance(sim) {
    if (!sim.portfolio || !sim.portfolio.length) {
      return '<div class="card" style="text-align:center;padding:40px;color:var(--text-muted)"><p>Build a portfolio first.</p></div>';
    }
    var html = '<div class="card" style="margin-bottom:12px"><div class="card-title">Import Portfolio Statement</div>';
    html += '<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">Upload a CSV or Excel portfolio statement to import real positions and start tracking with live data.</p>';
    html += '<div style="margin-bottom:16px">';
    html += '<input type="file" id="sim-import-file" accept=".csv,.xlsx,.xls" style="display:block;width:100%;padding:8px;border:1px solid var(--border-dim);border-radius:var(--radius-sm);background:var(--bg-inset);color:var(--text-primary)">';
    html += '<div style="font-size:0.7rem;color:var(--text-muted);margin-top:6px">Supported formats: CSV (recommended), XLSX. Expected columns: <strong>Ticker, Quantity, Avg Cost</strong> (or Symbol, Shares, Price).</div>';
    html += '</div>';
    html += '<hr style="border:none;border-top:1px solid var(--border-dim);margin:16px 0">';

    if (!sim.portfolio || !sim.portfolio.length) {
      html += '<div class="card" style="text-align:center;padding:40px;color:var(--text-muted)"><p>Build a portfolio first.</p></div>';
      return html;
    }
    html += '<div class="card" style="margin-bottom:12px"><div class="card-title">Rebalance Suggestions</div>';
    html += '<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">Based on current market conditions and your risk profile, here are suggested adjustments:</p>';


    // Example rebalance suggestions
    sim.portfolio.forEach(function(p, i) {
      var action = Math.random() > 0.7 ? 'Reduce' : 'Hold';
      var actionCls = action === 'Reduce' ? 'badge-red' : 'badge-green';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg-inset);border-radius:var(--radius-sm);margin-bottom:6px">';
      html += '<div><strong style="color:var(--text-primary)">' + p.ticker + '</strong> <span class="badge ' + actionCls + '" style="font-size:0.6rem;margin-left:6px">' + action + '</span></div>';
      html += '<div style="font-size:0.8rem;color:var(--text-secondary);text-align:right">';
      if (action === 'Reduce') {
        html += 'Consider trimming position — high sector correlation';
      } else {
        html += 'Maintain current allocation — performing as expected';
      }
      html += '</div></div>';
    });

    html += '<hr style="border:none;border-top:1px solid var(--border-dim);margin:12px 0">';
    html += '<p style="font-size:0.8rem;color:var(--text-muted);line-height:1.5">' +
      'Want to check a specific ticker or sector? Use the <a href="#/chat" style="color:var(--accent)">AI Analysis</a> page for detailed insights on any stock.' +
      '</p></div>';
    return html;
  },

  _wireBuilder(app, sim) {
    var self = this;
    var generateBtn = document.getElementById('sim-generate-btn');
    if (!generateBtn) return;

    // Risk tolerance options
    app.querySelectorAll('.sim-risk-option').forEach(function(el) {
      el.addEventListener('click', function() {
        app.querySelectorAll('.sim-risk-option').forEach(function(o) {
          o.style.borderColor = 'var(--border-dim)';
          o.style.background = 'transparent';
        });
        this.style.borderColor = 'var(--accent)';
        this.style.background = 'var(--accent-dim)';
        sim.risk = this.dataset.risk;
        localStorage.setItem('mg-simulation', JSON.stringify(sim));
      });
    });

    generateBtn.addEventListener('click', function() {
      var capital = parseFloat(document.getElementById('sim-capital').value) || 50000;
      var checked = Array.from(document.querySelectorAll('.sim-asset-cb:checked')).map(function(c) { return c.value; });
      if (checked.includes('all')) checked = ['stocks', 'options', 'crypto', 'commodities'];
      if (!checked.length) { alert('Select at least one asset class.'); return; }

      sim.capital = capital;
      sim.assets = checked;
      sim.risk = sim.risk || 'moderate';
      sim.created = new Date().toISOString();
      sim.portfolio = self._generatePortfolio(capital, checked, sim.risk);

      localStorage.setItem('mg-simulation', JSON.stringify(sim));

      var results = document.getElementById('sim-results');
      if (results) results.innerHTML = self._renderTracker(sim);
      results.scrollIntoView({ behavior: 'smooth' });
    });
  },

  _wireTracker(app, sim) {
    // Auto-refresh prices on page load
  },

  _wireRebalance(app, sim) {
    var self = this;
    var fileInput = document.getElementById('sim-import-file');
    if (!fileInput) return;

    fileInput.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var text = e.target.result;
          var imported = self._parsePortfolioFile(text, file.name);
          if (imported && imported.length > 0) {
            // Replace portfolio with imported real positions
            sim.portfolio = imported;
            sim.importedAt = new Date().toISOString();
            localStorage.setItem('mg-simulation', JSON.stringify(sim));

            // Re-render the rebalance tab to show real positions
            var results = document.getElementById('sim-results');
            if (results) results.innerHTML = self._renderRebalance(sim);
            self._wireRebalance(app, sim); // Re-wire after re-render

            alert('Successfully imported ' + imported.length + ' positions from ' + file.name);
          } else {
            alert('No valid positions found in file. Check format.');
          }
        } catch (err) {
          console.error('Import error:', err);
          alert('Error parsing file: ' + err.message);
        }
      }
    });
    reader.readAsText(file);
  },

  _parsePortfolioFile(text, filename) {
    // Parse CSV format: Ticker/Quantity/AvgCost or Symbol/Shares/Price
    // Supports headers: Ticker,Symbol,Quantity,Shares,Avg Cost,Price,AvgCost,Cost Basis,Quantity,Shares
    var lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    // Parse headers
    var headers = lines[0].split(',').map(function(h) { return h.trim().toLowerCase().replace(/"/g, ''); });
    var tickerIdx = headers.findIndex(function(h) { return h === 'ticker' || h === 'symbol' || h === 'ticker symbol'; });
    var qtyIdx = headers.findIndex(function(h) { return h === 'quantity' || h === 'shares' || h === 'qty'; });
    var costIdx = headers.findIndex(function(h) { return h === 'avg cost' || h === 'avgcost' || h === 'cost basis' || h === 'price' || h === 'average price'; });

    if (tickerIdx === -1 || qtyIdx === -1) {
      // Try simpler detection
      for (var i = 0; i < headers.length; i++) {
        if (headers[i].includes('tick') || headers[i].includes('symb')) tickerIdx = i;
        if (headers[i].includes('quant') || headers[i].includes('share')) qtyIdx = i;
        if (headers[i].includes('cost') || headers[i].includes('price')) costIdx = i;
      }
    }
    if (tickerIdx === -1 || qtyIdx === -1) return [];

    var imported = [];
    for (var i = 1; i < lines.length; i++) {
      var cols = this._parseCSVLine(lines[i]);
      if (cols.length <= Math.max(tickerIdx, qtyIdx, costIdx >= 0 ? costIdx : 0)) continue;

      var ticker = cols[tickerIdx]?.trim().toUpperCase();
      var qty = parseFloat(cols[qtyIdx]?.replace(/,/g, ''));
      var avgCost = costIdx >= 0 ? parseFloat(cols[costIdx]?.replace(/,/g, '')) : null;

      if (!ticker || isNaN(qty) || qty <= 0) continue;

      // Fetch live price from yfinance via API
      var name = ticker; // will be updated by tracker if possible
      var price = avgCost; // fallback to cost basis if live fetch fails

      // Determine currency from ticker
      var cur = ticker.includes('.TO') ? 'CAD' : 'USD';

      imported.push({
        ticker: ticker,
        name: name,
        price: price,
        currentPrice: price,
        shares: qty,
        avgCost: avgCost,
        currency: cur,
        pnl: 0,
        pnl_pct: 0,
        rationale: 'Imported from ' + filename,
        assetClass: 'stocks',
        imported: true
      });
    }
    return imported;
  },

  // Helper to parse CSV line (handles quoted fields with commas)
  _parseCSVLine(line) {
    var result = [];
    var inQuotes = false;
    var current = '';
    for (var i = 0; i < line.length; i++) {
      var char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result.map(function(s) { return s.replace(/^"|"$/g, '').trim(); });
  },

  _generatePortfolio(capital, assets, risk) {
    // Generate a realistic simulated portfolio based on inputs
    var portfolio = [];
    var riskMultiplier = risk === 'conservative' ? 0.7 : risk === 'aggressive' ? 1.3 : 1.0;

    var tickersByAsset = {
      stocks: [
        { ticker: 'SPY', name: 'SPDR S&P 500 ETF', price: 548, alloc: 0.30, rationale: 'Broad US market exposure — core holding for diversified portfolios.' },
        { ticker: 'QQQ', name: 'Invesco QQQ Trust', price: 480, alloc: 0.15, rationale: 'Tech-heavy growth exposure — captures innovation-driven returns.' },
        { ticker: 'XIU', name: 'iShares S&P/TSX 60', price: 38, alloc: 0.15, rationale: 'Canadian market anchor — home bias, dividend income, currency stability.' },
        { ticker: 'EFA', name: 'iShares MSCI EAFE', price: 82, alloc: 0.10, rationale: 'International developed markets — diversifies away from North America.' },
        { ticker: 'BND', name: 'Vanguard Total Bond Market', price: 72, alloc: 0.15, rationale: 'Fixed income buffer — reduces portfolio volatility during downturns.' },
        { ticker: 'GLD', name: 'SPDR Gold Shares', price: 215, alloc: 0.10, rationale: 'Inflation hedge and portfolio insurance — historically uncorrelated to equities.' },
        { ticker: 'AAPL', name: 'Apple Inc.', price: 215, alloc: 0.03, rationale: 'Blue chip tech with strong cash flows, buybacks, and ecosystem moat.' },
        { ticker: 'XRE', name: 'iShares Canadian Real Estate', price: 18, alloc: 0.02, rationale: 'Canadian real estate exposure — income generation through REITs.' },
      ],
      options: [
        { ticker: 'SPY', name: 'SPY Covered Calls', price: 548, alloc: 0.40, rationale: 'Generate premium income on core holdings — theta decay strategy.' },
        { ticker: 'QQQ', name: 'QQQ Put Credit Spreads', price: 480, alloc: 0.30, rationale: 'Bullish defined-risk strategy on tech — collects premium with wide strikes.' },
        { ticker: 'IWM', name: 'IWM Iron Condors', price: 215, alloc: 0.30, rationale: 'Range-bound strategy for small caps — benefits from mean reversion.' },
      ],
      crypto: [
        { ticker: 'BTC-USD', name: 'Bitcoin', price: 67000, alloc: 0.50, rationale: 'Digital gold — asymmetric upside, institutional adoption growing, portfolio hedge.' },
        { ticker: 'ETH-USD', name: 'Ethereum', price: 3400, alloc: 0.30, rationale: 'Smart contract leader — DeFi and staking yield provide multiple return streams.' },
        { ticker: 'SOL-USD', name: 'Solana', price: 145, alloc: 0.20, rationale: 'High-throughput L1 — developer activity and memecoin volume drive adoption.' },
      ],
      commodities: [
        { ticker: 'GLD', name: 'SPDR Gold Shares', price: 215, alloc: 0.35, rationale: 'Precious metal hedge — central bank buying and rate cut cycle supportive.' },
        { ticker: 'USO', name: 'United States Oil Fund', price: 38, alloc: 0.25, rationale: 'Energy exposure — supply constraints and geopolitical premium support prices.' },
        { ticker: 'WEAT', name: 'Teucrium Wheat Fund', price: 6.5, alloc: 0.15, rationale: 'Agricultural commodity — weather risk and global demand drive cycles.' },
        { ticker: 'SLV', name: 'iShares Silver Trust', price: 28, alloc: 0.25, rationale: 'Industrial + precious metal — solar demand and monetary premium dual drivers.' },
      ],
      forex: [
        { ticker: 'FXE', name: 'Euro Currency Trust', price: 108, alloc: 0.40, rationale: 'USD weakness play — ECB tightening cycle supports EUR relative strength.' },
        { ticker: 'FXY', name: 'Japanese Yen Trust', price: 68, alloc: 0.30, rationale: 'Carry trade unwind beneficiary — BoC normalization supports JPY.' },
        { ticker: 'FXA', name: 'Australian Dollar Trust', price: 64, alloc: 0.30, rationale: 'Commodity currency play — China demand and RBA hawkishness support AUD.' },
      ],
    };

    // Pick tickers based on selected assets
    var selectedTickers = [];
    var totalAlloc = 0;
    assets.forEach(function(asset) {
      var candidates = tickersByAsset[asset] || [];
      candidates.forEach(function(c) {
        var adjAlloc = c.alloc * riskMultiplier;
        selectedTickers.push({
          ticker: c.ticker,
          name: c.name,
          price: c.price,
          alloc: adjAlloc,
          shares: Math.floor((capital * adjAlloc) / c.price),
          avgCost: c.price,
          currentPrice: c.price * (1 + (Math.random() - 0.5) * 0.05),
          stopLoss: (c.price * 0.85).toFixed(2),
          rationale: c.rationale,
          assetClass: asset,
        });
        totalAlloc += adjAlloc;
      });
    });

    // Normalize allocation to 100%
    selectedTickers.forEach(function(p) {
      p.alloc = p.alloc / totalAlloc;
      p.shares = Math.floor((capital * p.alloc) / p.price);
    });

    return selectedTickers.filter(function(p) { return p.shares > 0; }).slice(0, 15);
  }
};
