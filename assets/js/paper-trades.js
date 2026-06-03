/**
 * Paper Trades — Track record, stats, strategy performance, accuracy over time.
 */
const PaperTrades = {
  async render(app) {
    app.innerHTML = '<div class="loading">Loading trade data...</div>';
    const [data, accuracy] = await Promise.all([
      Utils.fetchJSON('/data/paper_trades.json'),
      Utils.fetchJSON('/data/accuracy.json')
    ]);

    if (!data) {
      app.innerHTML = '<div class="error-card">Trade data not available yet.</div>';
      return;
    }

    let html = '<div class="section"><h2 class="section-title">📊 Paper Trading Record</h2>';

    // ── Confidence & Prediction Accuracy ──
    const acc = accuracy?.overall;
    const trend = accuracy?.trend;
    const overallWinRate = data.win_rate;
    const totalTrades = data.total_trades;

    html += '<h2 class="section-title" style="margin-top:24px">Confidence & Prediction Accuracy</h2>';
    html += '<div class="grid-4" style="margin-bottom:20px">';

    // Overall accuracy gauge
    html += `<div class="card" style="text-align:center">
      <div class="card-title">Overall Accuracy</div>
      <div class="index-price ${overallWinRate > 50 ? 'positive' : 'negative'}" style="font-size:2rem">${overallWinRate}%</div>
      <div style="font-size:0.8rem;color:var(--text-muted)">${acc?.profitable_trades || '?'} of ${acc?.trades_with_pnl || totalTrades} trades profitable</div>
    </div>`;

    // Trend (early vs recent)
    html += `<div class="card" style="text-align:center">
      <div class="card-title">Accuracy Trend</div>
      <div style="display:flex;justify-content:space-around;margin-top:8px">
        <div><div style="font-size:0.7rem;color:var(--text-muted)">Early</div><div style="font-size:1.1rem;font-weight:600">${trend?.early_win_rate || '—'}%</div></div>
        <div style="font-size:1.5rem;color:var(--text-muted)">→</div>
        <div><div style="font-size:0.7rem;color:var(--text-muted)">Recent</div><div style="font-size:1.1rem;font-weight:600;color:${trend?.recent_win_rate > trend?.early_win_rate ? 'var(--green)' : 'var(--red)'}">${trend?.recent_win_rate || '—'}%</div></div>
      </div>
      ${trend ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">${trend.recent_win_rate > trend.early_win_rate ? '📈 Improving' : '📉 Declining'} ${Math.abs(trend.recent_win_rate - trend.early_win_rate).toFixed(1)}pp</div>` : ''}
    </div>`;

    // Avg Win/Loss ratio
    const winLossRatio = data.avg_win_pct && data.avg_loss_pct ? (data.avg_win_pct / Math.abs(data.avg_loss_pct)).toFixed(2) : '—';
    html += `<div class="card" style="text-align:center">
      <div class="card-title">Risk/Reward</div>
      <div class="index-price" style="font-size:1.3rem">${winLossRatio}:1</div>
      <div style="font-size:0.75rem;color:var(--text-muted)">Avg Win ${data.avg_win_pct}% / Avg Loss ${data.avg_loss_pct}%</div>
    </div>`;

    // Total P&L (sum of all pnl_pct)
    html += `<div class="card" style="text-align:center">
      <div class="card-title">Cumulative Return</div>
      <div class="index-price ${acc?.total_pnl_sum > 0 ? 'positive' : 'negative'}" style="font-size:1.3rem">${acc?.total_pnl_sum > 0 ? '+' : ''}${acc?.total_pnl_sum || '0'}%</div>
      <div style="font-size:0.75rem;color:var(--text-muted)">Over ${totalTrades} trades · ${data.date_range}</div>
    </div>`;

    html += '</div>';

    // Monthly accuracy chart (simple visual)
    if (accuracy?.monthly_accuracy?.length) {
      html += '<h2 class="section-title" style="margin-top:24px">Accuracy by Month</h2>';
      html += '<div class="card" style="overflow-x:auto;white-space:nowrap;padding:16px;display:flex;gap:4px;align-items:end;min-height:150px">';
      const maxRate = Math.max(...accuracy.monthly_accuracy.map(m => parseFloat(m.win_rate)));
      accuracy.monthly_accuracy.forEach(m => {
        const rate = parseFloat(m.win_rate);
        const pct = maxRate > 0 ? (rate / maxRate) * 100 : 0;
        const cls = rate >= 50 ? 'positive' : 'negative';
        html += `<div style="display:flex;flex-direction:column;align-items:center;flex:1">
          <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:2px">${m.trades}t</div>
          <div style="width:100%;height:${Math.max(pct, 5)}px;background:${rate >= 50 ? 'var(--green)' : 'var(--red)'};border-radius:3px 3px 0 0;min-width:16px;opacity:0.8"></div>
          <div style="font-size:0.65rem;margin-top:2px;font-weight:600" class="${cls}">${rate}%</div>
          <div style="font-size:0.6rem;color:var(--text-muted)">${m.month.slice(5)}</div>
        </div>`;
      });
      html += '</div></div>';
    }

    // ── Strategy Performance ──
    if (data.strategies?.length) {
      html += '<h2 class="section-title" style="margin-top:24px">Strategy Confidence</h2>';
      html += '<div class="card table-wrap"><table><thead><tr><th>Strategy</th><th>Trades</th><th>Avg Return</th><th>Win Rate</th><th>Confidence</th></tr></thead><tbody>';
      data.strategies.forEach(s => {
        const rtCls = s.avg_return > 0 ? 'positive' : s.avg_return < 0 ? 'negative' : '';
        const conf = s.trades >= 200 ? 'High' : s.trades >= 100 ? 'Medium' : 'Low';
        const confCls = conf === 'High' ? 'badge-green' : conf === 'Medium' ? 'badge-yellow' : 'badge-red';
        html += `<tr><td><strong>${s.name.replace(/_/g, ' ')}</strong></td><td>${s.trades}</td>
          <td class="${rtCls}">${s.avg_return > 0 ? '+' : ''}${s.avg_return}%</td>
          <td>${s.win_rate || '—'}%</td>
          <td><span class="badge ${confCls}">${conf}</span></td></tr>`;
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
