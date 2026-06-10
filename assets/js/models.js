/**
 * Models — merged Simulation + Predictions.
 * Simulation is the primary view, Predictions data shown as a section.
 */
const Models = {
  async render(app) {
    app.innerHTML = '<div class="loading">Loading models...</div>';
    
    // Load simulation data
    const simData = await Utils.fetchJSON('/data/simulation.json').catch(() => null);
    
    let html = '<div class="section">';
    html += '<h2 class="section-title">Strategy Models</h2>';
    
    // ── Sub-navigation ──
    html += '<div class="research-tabs" style="display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap">';
    html += '<button class="research-tab active" data-subtab="simulation">Simulation</button>';
    html += '<button class="research-tab" data-subtab="predictions">Predictions</button>';
    html += '</div>';
    
    html += '<div class="models-content">';
    
    // ── Simulation tab ──
    html += '<div class="models-pane" id="subtab-simulation">';
    if (simData) {
      html += this._renderSimulation(simData);
    } else {
      html += '<div class="card"><div class="card-title">Simulation</div><div style="font-size:0.9rem;color:var(--text-secondary)">Run a simulation to see results here.</div></div>';
      html += '<div style="margin-top:12px">';
      html += '<div class="card" style="margin-bottom:12px"><div class="card-title">Paper Trading Account</div>';
      html += '<div style="font-size:0.85rem;color:var(--text-secondary)">The paper trading account tracks live simulated trades. View open positions and trade history in the <a href="#/positions" style="color:var(--accent)">Positions</a> tab.</div></div>';
      html += '</div>';
    }
    html += '</div>';
    
    // ── Predictions tab ──
    html += '<div class="models-pane" id="subtab-predictions" style="display:none">';
    html += '<div id="prediction-engine-content"></div>';
    html += '</div>';
    
    html += '</div></div>';
    app.innerHTML = html;
    
    // Load predictions on demand
    const predPane = app.querySelector('#subtab-predictions #prediction-engine-content');
    if (predPane && PredictionEngine) {
      PredictionEngine.render(predPane);
    }
    
    // Wire sub-tab switching
    app.querySelectorAll('.research-tab').forEach(tab => {
      tab.addEventListener('click', function() {
        app.querySelectorAll('.research-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        app.querySelectorAll('.models-pane').forEach(p => p.style.display = 'none');
        const pane = app.querySelector('#subtab-' + this.dataset.subtab);
        if (pane) pane.style.display = 'block';
      });
    });
  },

  _renderSimulation(data) {
    let html = '';
    
    // Performance summary
    if (data.summary) {
      const s = data.summary;
      html += '<div class="card" style="margin-bottom:12px"><div class="card-title">Performance Summary</div>';
      html += '<div class="grid-3" style="margin-top:8px">';
      const metrics = [
        ['Total Return', (s.total_return != null ? (s.total_return * 100).toFixed(1) + '%' : '—')],
        ['Sharpe Ratio', s.sharpe != null ? s.sharpe.toFixed(2) : '—'],
        ['Max Drawdown', s.max_drawdown != null ? (s.max_drawdown * 100).toFixed(1) + '%' : '—'],
        ['Win Rate', s.win_rate != null ? (s.win_rate * 100).toFixed(1) + '%' : '—'],
        ['Total Trades', s.total_trades != null ? s.total_trades : '—'],
        ['Avg Trade', s.avg_trade != null ? '$' + s.avg_trade.toFixed(2) : '—'],
      ];
      metrics.forEach(m => {
        html += `<div class="card" style="padding:12px;text-align:center"><div class="index-ticker">${Utils.esc(m[0])}</div><div class="index-price">${m[1]}</div></div>`;
      });
      html += '</div></div>';
    }
    
    // Strategy breakdown
    if (data.strategies?.length) {
      html += '<div class="card"><div class="card-title">Strategy Breakdown</div><div class="table-wrap"><table><thead><tr><th>Strategy</th><th>Return</th><th>Sharpe</th><th>Trades</th><th>Win Rate</th></tr></thead><tbody>';
      data.strategies.forEach(s => {
        html += `<tr><td><strong>${Utils.esc(s.name)}</strong></td><td class="${s.return >= 0 ? 'positive' : 'negative'}">${s.return != null ? (s.return * 100).toFixed(1) + '%' : '—'}</td><td>${s.sharpe != null ? s.sharpe.toFixed(2) : '—'}</td><td>${s.trades || '—'}</td><td>${s.win_rate != null ? (s.win_rate * 100).toFixed(1) + '%' : '—'}</td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }
    
    // Paper trading account status
    html += '<div style="margin-top:12px"><div class="card"><div class="card-title">Paper Trading Account</div>';
    html += '<div style="font-size:0.85rem;color:var(--text-secondary)">View open positions and detailed trade history in the <a href="#/positions" style="color:var(--accent)">Positions</a> tab.</div></div></div>';
    
    return html;
  }
};
