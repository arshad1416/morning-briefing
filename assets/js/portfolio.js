/**
 * Portfolio — Track holdings, AI rebalancing, API key management.
 * For Pro subscribers. Manual entry or file upload.
 */
const Portfolio = {
  async render(app) {
    // Check if user has access (stored in localStorage for now)
    const tier = localStorage.getItem('mg-tier') || 'free';
    
    let html = '<div class="section"><h2 class="section-title">Portfolio Dashboard</h2>';

    if (tier === 'free') {
      html += '<div class="card" style="text-align:center;padding:40px">';
      html += '<div style="font-size:2rem;margin-bottom:12px">🔒</div>';
      html += '<h3 style="margin-bottom:8px">Portfolio Tracking Requires Pro</h3>';
      html += '<p style="color:var(--text-muted);margin-bottom:16px">Upgrade to track your holdings, get AI-powered rebalancing, and API access.</p>';
      html += '<a href="#/maplegamma" class="mg-btn mg-btn-primary" style="display:inline-block;padding:10px 24px;text-decoration:none">View Pricing →</a>';
      html += '</div>';
      app.innerHTML = html;
      return;
    }

    // Get stored portfolio data
    let portfolio = JSON.parse(localStorage.getItem('mg-portfolio') || '{"holdings":[],"apikeys":[]}');

    // Active tab
    const tab = window.location.hash.split('?')[1] || 'holdings';

    // Tab navigation
    html += '<div style="display:flex;gap:6px;margin-bottom:16px;border-bottom:1px solid var(--border-dim);padding-bottom:8px">';
    html += '<a href="#/portfolio?holdings" class="nav-link ' + (tab === 'holdings' ? 'active' : '') + '">Holdings</a>';
    html += '<a href="#/portfolio?rebalance" class="nav-link ' + (tab === 'rebalance' ? 'active' : '') + '">AI Rebalance</a>';
    html += '<a href="#/portfolio?apikeys" class="nav-link ' + (tab === 'apikeys' ? 'active' : '') + '">API Keys</a>';
    html += '</div>';

    if (tab === 'holdings') {
      html += this._renderHoldings(portfolio);
    } else if (tab === 'rebalance') {
      html += this._renderRebalance(portfolio);
    } else if (tab === 'apikeys') {
      html += this._renderApiKeys(portfolio);
    }

    html += '</div>';
    app.innerHTML = html;

    // Wire up buttons
    if (tab === 'holdings') this._wireHoldings(app, portfolio);
    if (tab === 'apikeys') this._wireApiKeys(app, portfolio);
  },

  _renderHoldings(portfolio) {
    let html = '<div class="card" style="margin-bottom:12px">';
    html += '<div class="card-title">Your Holdings</div>';
    html += '<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">Add tickers manually or upload a CSV/PDF statement. We will extract your positions automatically.</p>';
    
    // Add ticker form
    html += '<div style="display:flex;gap:8px;margin-bottom:16px">';
    html += '<input type="text" id="portfolio-ticker-input" placeholder="e.g., SPY,AAPL,MSFT" style="flex:1;padding:8px 12px;border:1px solid var(--border-dim);border-radius:var(--radius-sm);background:var(--bg-inset);color:var(--text-primary)">';
    html += '<button id="portfolio-add-btn" class="mg-btn mg-btn-primary" style="padding:8px 16px;border:none;cursor:pointer">Add</button>';
    html += '<button id="portfolio-upload-btn" class="mg-btn mg-btn-secondary" style="padding:8px 16px;border:none;cursor:pointer">Upload</button>';
    html += '</div>';

    // Holdings table
    if (portfolio.holdings.length) {
      html += '<div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Shares</th><th>Avg Cost</th><th>Current</th><th>P&L</th><th>% of Portfolio</th><th></th></tr></thead><tbody>';
      var total = portfolio.holdings.reduce(function(s, h) { return s + (h.shares || 0) * (h.currentPrice || h.avgCost || 0); }, 0);
      portfolio.holdings.forEach(function(h, i) {
        var cur = h.currentPrice || h.avgCost || 0;
        var val = (h.shares || 0) * cur;
        var cost = (h.shares || 0) * (h.avgCost || 0);
        var pnl = val - cost;
        var pnlPct = cost > 0 ? (pnl / cost * 100) : 0;
        var pct = total > 0 ? (val / total * 100) : 0;
        var cls = pnl >= 0 ? 'positive' : 'negative';
        html += '<tr>';
        html += '<td><strong>' + h.ticker + '</strong></td>';
        html += '<td><input type="number" class="holding-shares" data-idx="' + i + '" value="' + (h.shares || '') + '" style="width:60px;padding:2px 6px;border:1px solid var(--border-dim);border-radius:4px;background:var(--bg-inset);color:var(--text-primary)"></td>';
        html += '<td>$' + (h.avgCost || 0).toFixed(2) + '</td>';
        html += '<td>$' + cur.toFixed(2) + '</td>';
        html += '<td class="' + cls + '">' + (pnl >= 0 ? '+' : '') + pnl.toFixed(2) + '</td>';
        html += '<td>' + pct.toFixed(1) + '%</td>';
        html += '<td><button class="holding-remove" data-idx="' + i + '" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:1.2rem">&times;</button></td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      html += '<div style="margin-top:8px;font-size:0.85rem;color:var(--text-muted);text-align:right">Total Value: $' + total.toFixed(2) + '</div>';
    } else {
      html += '<div style="padding:20px;text-align:center;color:var(--text-muted);border:2px dashed var(--border-dim);border-radius:var(--radius-lg)">';
      html += '<div style="font-size:1.5rem;margin-bottom:8px">📊</div>';
      html += '<p>No holdings yet. Add tickers above or upload a brokerage statement.</p>';
      html += '</div>';
    }

    html += '</div>';

    // Upload modal (hidden)
    html += '<div id="upload-modal" class="modal-overlay" style="display:none">';
    html += '<div class="modal-content" style="max-width:500px"><span class="modal-close" id="upload-modal-close">&times;</span>';
    html += '<h3 style="margin-bottom:12px">Upload Portfolio Statement</h3>';
    html += '<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">Paste your holdings text below (from Wealthsimple, Questrade, IBKR, or any brokerage). We will extract the tickers and quantities.</p>';
    html += '<textarea id="upload-text" style="width:100%;height:150px;padding:8px;border:1px solid var(--border-dim);border-radius:var(--radius-sm);background:var(--bg-inset);color:var(--text-primary);font-family:monospace;font-size:0.8rem" placeholder="Paste statement text here..."></textarea>';
    html += '<div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end">';
    html += '<button id="upload-cancel" class="mg-btn mg-btn-secondary" style="padding:6px 16px;border:none;cursor:pointer">Cancel</button>';
    html += '<button id="upload-parse" class="mg-btn mg-btn-primary" style="padding:6px 16px;border:none;cursor:pointer">Parse Holdings</button>';
    html += '</div></div></div>';

    return html;
  },

  _renderRebalance(portfolio) {
    var hasRebalance = localStorage.getItem('mg-addon-rebalance') === 'true';
    if (!hasRebalance) {
      return '<div class="card" style="text-align:center;padding:40px"><div style="font-size:2rem;margin-bottom:12px">🤖</div><h3 style="margin-bottom:8px">AI Portfolio Rebalancing</h3><p style="color:var(--text-muted);margin-bottom:16px">Add the AI Rebalance add-on for $50 CAD/mo. Our AI will analyze your holdings and suggest optimal allocations.</p><a href="#/maplegamma" class="mg-btn mg-btn-primary" style="display:inline-block;padding:10px 24px;text-decoration:none">Upgrade →</a></div>';
    }
    if (!portfolio.holdings.length) {
      return '<div class="card" style="text-align:center;padding:40px;color:var(--text-muted)"><p>Add holdings first on the Holdings tab.</p></div>';
    }
    return '<div class="card" style="padding:24px"><div class="card-title">AI Rebalance Suggestions</div><p style="color:var(--text-muted)">Analysis running... (hook into MiMo council for portfolio recommendations)</p></div>';
  },

  _renderApiKeys(portfolio) {
    var hasApi = localStorage.getItem('mg-addon-api') === 'true';
    if (!hasApi) {
      return '<div class="card" style="text-align:center;padding:40px"><div style="font-size:2rem;margin-bottom:12px">🔑</div><h3 style="margin-bottom:8px">API Access</h3><p style="color:var(--text-muted);margin-bottom:16px">Add the API Access add-on for $100 CAD/mo. Generate API keys to pull GEX/DEX/VEX and market data programmatically.</p><a href="#/maplegamma" class="mg-btn mg-btn-primary" style="display:inline-block;padding:10px 24px;text-decoration:none">Upgrade →</a></div>';
    }
    var keys = portfolio.apikeys || [];
    var html = '<div class="card" style="margin-bottom:12px">';
    html += '<div class="card-title">Your API Keys</div>';
    html += '<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">Keys are prefixed with <code>mg_</code>. You can generate and revoke keys at any time.</p>';
    
    if (keys.length) {
      html += '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Key</th><th>Created</th><th>Last Used</th><th></th></tr></thead><tbody>';
      keys.forEach(function(k, i) {
        html += '<tr><td>' + (k.name || 'Key ' + (i+1)) + '</td><td><code style="font-size:0.75rem;background:var(--bg-inset);padding:2px 6px;border-radius:4px">' + k.keyPrefix + '...' + k.keySuffix + '</code></td><td style="font-size:0.8rem;color:var(--text-muted)">' + (k.created || '—') + '</td><td style="font-size:0.8rem;color:var(--text-muted)">' + (k.lastUsed || 'Never') + '</td><td><button class="apikey-revoke" data-idx="' + i + '" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:0.8rem">Revoke</button></td></tr>';
      });
      html += '</tbody></table></div>';
    } else {
      html += '<div style="padding:20px;text-align:center;color:var(--text-muted);border:2px dashed var(--border-dim);border-radius:var(--radius-lg)"><p>No API keys yet. Generate one below.</p></div>';
    }

    html += '<div style="display:flex;gap:8px;margin-top:12px">';
    html += '<input type="text" id="apikey-name-input" placeholder="Key name (e.g., My Trading Bot)" style="flex:1;padding:8px 12px;border:1px solid var(--border-dim);border-radius:var(--radius-sm);background:var(--bg-inset);color:var(--text-primary)">';
    html += '<button id="apikey-generate-btn" class="mg-btn mg-btn-primary" style="padding:8px 16px;border:none;cursor:pointer">Generate Key</button>';
    html += '</div></div>';

    html += '<div class="card" style="background:var(--bg-inset);font-size:0.8rem;color:var(--text-muted)">';
    html += '<strong style="color:var(--text-primary)">API Endpoints:</strong><br>';
    html += '<code style="font-size:0.75rem">GET https://api.briefing.arshadkazi.ca/v1/gex/{ticker}?key=mg_xxx</code><br>';
    html += '<code style="font-size:0.75rem">GET https://api.briefing.arshadkazi.ca/v1/briefing/latest?key=mg_xxx</code><br>';
    html += '<code style="font-size:0.75rem">GET https://api.briefing.arshadkazi.ca/v1/scan?key=mg_xxx</code><br>';
    html += '<code style="font-size:0.75rem">GET https://api.briefing.arshadkazi.ca/v1/options/{ticker}?key=mg_xxx</code>';
    html += '</div>';

    return html;
  },

  _wireHoldings(app, portfolio) {
    var self = this;

    // Add ticker
    var addBtn = document.getElementById('portfolio-add-btn');
    var input = document.getElementById('portfolio-ticker-input');
    if (addBtn && input) {
      addBtn.addEventListener('click', function() {
        var tickers = input.value.split(',').map(function(t) { return t.trim().toUpperCase(); }).filter(function(t) { return t; });
        tickers.forEach(function(t) {
          if (!portfolio.holdings.some(function(h) { return h.ticker === t; })) {
            portfolio.holdings.push({ ticker: t, shares: 0, avgCost: 0 });
          }
        });
        localStorage.setItem('mg-portfolio', JSON.stringify(portfolio));
        window.location.reload();
      });
    }

    // Remove holding
    app.querySelectorAll('.holding-remove').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.dataset.idx);
        if (!isNaN(idx)) {
          portfolio.holdings.splice(idx, 1);
          localStorage.setItem('mg-portfolio', JSON.stringify(portfolio));
          window.location.reload();
        }
      });
    });

    // Update shares on change
    app.querySelectorAll('.holding-shares').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var idx = parseInt(this.dataset.idx);
        if (!isNaN(idx)) {
          portfolio.holdings[idx].shares = parseFloat(this.value) || 0;
          localStorage.setItem('mg-portfolio', JSON.stringify(portfolio));
        }
      });
    });

    // Upload modal
    var uploadBtn = document.getElementById('portfolio-upload-btn');
    var modal = document.getElementById('upload-modal');
    var close = document.getElementById('upload-modal-close');
    var cancel = document.getElementById('upload-cancel');
    var parseBtn = document.getElementById('upload-parse');
    var textArea = document.getElementById('upload-text');

    if (uploadBtn && modal) {
      uploadBtn.addEventListener('click', function() { modal.style.display = 'flex'; });
    }
    if (close) close.addEventListener('click', function() { modal.style.display = 'none'; });
    if (cancel) cancel.addEventListener('click', function() { modal.style.display = 'none'; });
    if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) modal.style.display = 'none'; });

    if (parseBtn && textArea) {
      parseBtn.addEventListener('click', function() {
        var text = textArea.value;
        // Simple parser: look for ticker patterns (1-5 uppercase letters) near numbers
        var lines = text.split('\n');
        lines.forEach(function(line) {
          var match = line.match(/\b([A-Z]{1,5})\b.*?(\d+[\.\d]*)/);
          if (match) {
            var ticker = match[1];
            var shares = parseFloat(match[2]) || 0;
            if (!portfolio.holdings.some(function(h) { return h.ticker === ticker; })) {
              portfolio.holdings.push({ ticker: ticker, shares: shares, avgCost: 0 });
            }
          }
        });
        localStorage.setItem('mg-portfolio', JSON.stringify(portfolio));
        modal.style.display = 'none';
        window.location.reload();
      });
    }
  },

  _wireApiKeys(app, portfolio) {
    var generateBtn = document.getElementById('apikey-generate-btn');
    var nameInput = document.getElementById('apikey-name-input');

    if (generateBtn) {
      generateBtn.addEventListener('click', function() {
        var name = nameInput ? nameInput.value.trim() : '';
        var prefix = 'mg_' + Math.random().toString(36).substring(2, 8);
        var suffix = Math.random().toString(36).substring(2, 6);
        var key = prefix + suffix;
        
        portfolio.apikeys.push({
          name: name || 'Key ' + (portfolio.apikeys.length + 1),
          keyPrefix: prefix,
          keySuffix: suffix,
          fullKey: key,
          created: new Date().toISOString().slice(0, 10),
          lastUsed: null
        });
        localStorage.setItem('mg-portfolio', JSON.stringify(portfolio));
        alert('Your new API key: ' + key + '\n\nSave this — it will not be shown again.');
        window.location.reload();
      });
    }

    // Revoke
    app.querySelectorAll('.apikey-revoke').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.dataset.idx);
        if (!isNaN(idx) && confirm('Revoke this API key?')) {
          portfolio.apikeys.splice(idx, 1);
          localStorage.setItem('mg-portfolio', JSON.stringify(portfolio));
          window.location.reload();
        }
      });
    });
  }
};
