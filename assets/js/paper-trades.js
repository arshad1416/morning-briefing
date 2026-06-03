/**
 * Paper Trades — Track record, stats, strategy performance.
 */
const PaperTrades = {
  async render(app) {
    app.innerHTML = '<div class="loading">Loading trade data...</div>';
    const data = await Utils.fetchJSON('/data/paper_trades.json');
    if (!data) {
      app.innerHTML = '<div class="error-card">Trade data not available yet.</div>';
      return;
    }

    let html = '<div class="section"><h2 class="section-title">📊 Paper Trading Record</h2>';

    // ── Overview Stats ──
    html += '<div class="grid-4" style="margin-bottom:20px">';
    html += statCard('Total Trades', data.total_trades, '');
    html += statCard('Win Rate', data.win_rate + '%', data.win_rate > 50 ? 'positive' : data.win_rate < 40 ? 'negative' : '');
    html += statCard('Avg Win', '+' + data.avg_win_pct + '%', 'positive');
    html += statCard('Avg Loss', data.avg_loss_pct + '%', 'negative');
    html += statCard('Best Trade', '+' + data.best_trade_pct + '%', 'positive');
    html += statCard('Worst Trade', data.worst_trade_pct + '%', 'negative');
    html += statCard('Most Traded', data.most_traded || '—', '');
    html += statCard('Period', data.date_range || '—', '');
    html += '</div>';

    // ── Strategy Performance ──
    if (data.strategies?.length) {
      html += '<h2 class="section-title" style="margin-top:24px">Strategy Performance</h2>';
      html += '<div class="card table-wrap"><table><thead><tr><th>Strategy</th><th>Trades</th><th>Avg Return</th><th>Win Rate</th><th class="positive">Best</th><th class="negative">Worst</th></tr></thead><tbody>';
      data.strategies.forEach(s => {
        const rtCls = s.avg_return > 0 ? 'positive' : s.avg_return < 0 ? 'negative' : '';
        html += `<tr><td><strong>${s.name.replace(/_/g, ' ')}</strong></td><td>${s.trades}</td><td class="${rtCls}">${s.avg_return > 0 ? '+' : ''}${s.avg_return}%</td><td>${s.win_rate || '—'}%</td><td class="positive">—</td><td class="negative">—</td></tr>`;
      });
      html += '</tbody></table></div>';
    }

    // ── Top Tickers ──
    if (data.top_tickers?.length) {
      html += '<h2 class="section-title" style="margin-top:24px">Most Traded Tickers</h2>';
      html += '<div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Trades</th><th>Avg Return</th></tr></thead><tbody>';
      data.top_tickers.forEach(t => {
        const cls = t.avg_return > 0 ? 'positive' : t.avg_return < 0 ? 'negative' : '';
        html += `<tr><td><strong>${t.ticker}</strong></td><td>${t.trades}</td><td class="${cls}">${t.avg_return > 0 ? '+' : ''}${t.avg_return}%</td></tr>`;
      });
      html += '</tbody></table></div>';
    }

    // ── Recent Trades ──
    if (data.recent_trades?.length) {
      html += '<h2 class="section-title" style="margin-top:24px">Recent Trades</h2>';
      html += '<div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Strategy</th><th>Entry</th><th>P&L</th></tr></thead><tbody>';
      data.recent_trades.forEach(t => {
        const cls = t.pnl_pct > 0 ? 'positive' : t.pnl_pct < 0 ? 'negative' : '';
        const sign = t.pnl_pct > 0 ? '+' : '';
        html += `<tr><td><strong>${t.ticker}</strong></td><td>${(t.strategy || '').replace(/_/g, ' ')}</td><td>${t.date || ''}</td><td class="${cls}">${sign}${t.pnl_pct}%</td></tr>`;
      });
      html += '</tbody></table></div>';
    }

    html += '</div>';
    app.innerHTML = html;
  }
};

function statCard(label, value, cls) {
  return `<div class="card" style="text-align:center">
    <div class="card-title">${label}</div>
    <div class="index-price ${cls || ''}" style="font-size:1.3rem">${value}</div>
  </div>`;
}
