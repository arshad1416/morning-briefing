/**
 * Paper Trades — Live open positions, strategy performance, backtest accuracy.
 * Shows V1-V100 backtest results with live trade tracking.
 */
const PaperTrades = {
  async render(app) {
    app.innerHTML = '<div class="loading">Loading trade data...</div>';
    const [data, accuracy] = await Promise.all([
      Utils.fetchJSON('/data/paper_trades.json'),
      Utils.fetchJSON('/data/accuracy.json')
    ]);

    let html = '<div class="section"><h2 class="section-title">📊 Trading Performance</h2>';

    // ── Live Open Positions ──
    html += '<h2 class="section-title" style="margin-top:24px">Open Positions</h2>';
    if (data?.open_positions?.length) {
      html += '<div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Direction</th><th>Entry</th><th>Entry Price</th><th>Current</th><th>P&L</th><th>Strategy</th><th>Status</th></tr></thead><tbody>';
      data.open_positions.forEach(t => {
        const pnlCls = t.pnl > 0 ? 'positive' : t.pnl < 0 ? 'negative' : '';
        const status = t.pnl > 2 ? '✅ In Profit' : t.pnl < -2 ? '⚠️ At Risk' : t.pnl < -5 ? '🔴 Stop Zone' : '⏳ Pending';
        html += `<tr>
          <td><strong>${t.ticker}</strong></td>
          <td class="${t.direction === 'long' ? 'positive' : 'negative'}">${t.direction}</td>
          <td>${t.entry_date || '—'}</td>
          <td>$${t.entry_price.toFixed(2)}</td>
          <td>${t.current_price ? '$' + t.current_price.toFixed(2) : '—'}</td>
          <td class="${pnlCls}" style="font-weight:700">${t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}%</td>
          <td style="font-size:0.8rem">${t.strategy || '—'}</td>
          <td><span class="badge ${t.pnl > 0 ? 'badge-green' : t.pnl < -3 ? 'badge-red' : 'badge-yellow'}" style="font-size:0.65rem">${status}</span></td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    } else {
      html += '<div class="card" style="text-align:center;padding:32px;color:var(--text-muted)">No open positions. All trades closed.</div>';
    }

    // ── Backtest Accuracy Summary ──
    if (accuracy?.overall) {
      const ov = accuracy.overall;
      html += '<h2 class="section-title" style="margin-top:24px">Prediction Engine Accuracy (V1-V100)</h2>';
      html += '<div class="grid-4" style="margin-bottom:20px">';
      
      const cards = [
        { label: 'Top 10 Avg WR', value: ov.top_10_avg_win_rate + '%', cls: 'positive', sub: 'Across top strategies' },
        { label: 'Top 10 Avg P&L', value: '+' + ov.top_10_avg_pnl + '%', cls: 'positive', sub: 'Per trade average' },
        { label: 'Best Win Rate', value: ov.best_win_rate + '%', cls: 'positive', sub: ov.best_version },
        { label: 'Total Backtest', value: (ov.total_backtest_trades || '').toLocaleString(), cls: '', sub: '100 versions tested' },
      ];
      cards.forEach(c => {
        html += `<div class="card" style="text-align:center">
          <div class="card-title">${c.label}</div>
          <div class="index-price ${c.cls}" style="font-size:1.5rem">${c.value}</div>
          <div style="font-size:0.7rem;color:var(--text-muted)">${c.sub}</div>
        </div>`;
      });
      html += '</div>';
    }

    // ── Top 10 Strategies ──
    if (accuracy?.top_performers?.length) {
      html += '<h2 class="section-title" style="margin-top:24px">Best Strategies (Backtest Verified)</h2>';
      html += '<div class="card table-wrap"><table><thead><tr><th>Rank</th><th>Version</th><th>Trades</th><th>Win Rate</th><th>Avg P&L</th><th>PF</th><th>Confidence</th></tr></thead><tbody>';
      
      const medals = ['🥇', '🥈', '🥉', '4', '5', '6', '7', '8', '9', '10'];
      accuracy.top_performers.forEach((v, i) => {
        if (i >= 10) return;
        const conf = v.trades >= 100 ? 'High' : v.trades >= 30 ? 'Medium' : 'Low';
        const confCls = conf === 'High' ? 'badge-green' : conf === 'Medium' ? 'badge-yellow' : 'badge-red';
        const medal = medals[i] || (i+1);
        html += `<tr>
          <td style="font-size:0.8rem">${medal}</td>
          <td><strong>${v.name}</strong></td>
          <td>${v.trades}</td>
          <td><span class="${v.win_rate >= 70 ? 'badge badge-green' : v.win_rate >= 60 ? 'badge badge-yellow' : 'badge'}" style="font-size:0.7rem">${v.win_rate}%</span></td>
          <td class="${v.avg_pnl >= 0 ? 'positive' : 'negative'}">${v.avg_pnl >= 0 ? '+' : ''}${v.avg_pnl}%</td>
          <td>${v.profit_factor}</td>
          <td><span class="badge ${confCls}">${conf}</span></td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }

    // ── MR Evolution ──
    if (accuracy?.mr_progression?.length) {
      html += '<h2 class="section-title" style="margin-top:24px">Mean Reversion Evolution</h2>';
      html += '<div class="card table-wrap"><table><thead><tr><th>Ver</th><th>WR</th><th>P&L</th><th>PF</th><th>Trades</th></tr></thead><tbody>';
      accuracy.mr_progression.slice(-6).forEach(v => {
        html += `<tr>
          <td><strong>${v.version}</strong></td>
          <td><span class="${v.win_rate >= 70 ? 'badge badge-green' : v.win_rate >= 60 ? 'badge badge-yellow' : 'badge'}" style="font-size:0.7rem">${v.win_rate}%</span></td>
          <td class="${v.avg_pnl >= 0 ? 'positive' : 'negative'}">${v.avg_pnl >= 0 ? '+' : ''}${v.avg_pnl}%</td>
          <td>${v.pf}</td>
          <td>${v.trades}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }

    // ── Strategy Breakdown ──
    html += '<h2 class="section-title" style="margin-top:24px">Strategy Confidence Levels</h2>';
    html += '<div class="card" style="margin-bottom:20px;"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    
    const strategies = [
      { name: 'Mean Reversion (VIX≥12)', wr: 74.3, pnl: 4.67, pf: 5.10, trades: 35, best: true },
      { name: 'Bear Market MR', wr: 80.0, pnl: 8.71, pf: 11.82, trades: 25, best: true },
      { name: 'Crash Bounce', wr: 81.6, pnl: 7.78, pf: 4.42, trades: 98, best: true },
      { name: 'Score-Weighted MR', wr: 73.3, pnl: 3.41, pf: 4.05, trades: 75 },
      { name: 'Bull Momentum', wr: 61.6, pnl: 2.05, pf: 1.89, trades: 2625 },
      { name: 'Bullish Engulfing', wr: 62.2, pnl: 1.95, pf: 1.87, trades: 1898 },
    ];
    
    strategies.forEach(s => {
      const conf = s.trades >= 500 ? 'High' : s.trades >= 50 ? 'Medium' : 'Low';
      const confCls = conf === 'High' ? 'badge-green' : conf === 'Medium' ? 'badge-yellow' : 'badge-red';
      html += `<div style="border:1px solid var(--border-dim);border-radius:var(--card-radius);padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-weight:600;font-size:0.9rem">${s.name}</span>
          ${s.best ? '<span class="badge badge-green" style="font-size:0.6rem">⭐ TOP</span>' : ''}
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:0.8rem">
          <span><span style="color:var(--text-muted)">WR:</span> ${s.wr}%</span>
          <span><span style="color:var(--text-muted)">Avg:</span> <span class="${s.pnl >= 0 ? 'positive' : 'negative'}">+${s.pnl}%</span></span>
          <span><span style="color:var(--text-muted)">PF:</span> ${s.pf}</span>
          <span><span style="color:var(--text-muted)">Trades:</span> ${s.trades}</span>
          <span><span class="badge ${confCls}" style="font-size:0.6rem">${conf}</span></span>
        </div>
      </div>`;
    });
    html += '</div></div>';

    // ── Recent Live Trades ──
    if (data?.recent_trades?.length) {
      html += '<h2 class="section-title" style="margin-top:24px">Recent Trades</h2>';
      html += '<div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Strategy</th><th>Entry</th><th>Exit</th><th>P&L</th><th>Status</th></tr></thead><tbody>';
      data.recent_trades.slice(0, 20).forEach(t => {
        const cls = t.pnl_pct > 0 ? 'positive' : t.pnl_pct < 0 ? 'negative' : '';
        const status = t.exit_date ? '✅ Closed' : '⏳ Open';
        const statusCls = t.exit_date ? 'badge-green' : 'badge-yellow';
        html += `<tr>
          <td><strong>${t.ticker}</strong></td>
          <td style="font-size:0.8rem">${(t.strategy || '').replace(/_/g, ' ')}</td>
          <td style="font-size:0.8rem">${t.date || ''}</td>
          <td style="font-size:0.8rem">${t.exit_date || '—'}</td>
          <td class="${cls}" style="font-weight:700">${t.pnl_pct >= 0 ? '+' : ''}${t.pnl_pct}%</td>
          <td><span class="badge ${statusCls}" style="font-size:0.65rem">${status}</span></td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }

    html += '</div>';
    app.innerHTML = html;
  }
};
