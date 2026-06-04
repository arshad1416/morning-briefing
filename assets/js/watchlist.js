/**
 * Watchlist — Premarket scan results with scoring.
 */
const Watchlist = {
  async render(app) {
    app.innerHTML = '<div class="loading">Loading watchlist...</div>';

    const data = await State.get('latest', '/data/latest.json');
    if (!data) {
      app.innerHTML = '<div class="error-card">Failed to load watchlist data.</div>';
      return;
    }

    let html = '<div class="section"><h2 class="section-title">Pre-Market Setups</h2>';

    // Watchlist summary
    if (data.watchlist_summary) {
      const ws = data.watchlist_summary;
      html += `<div class="grid-3" style="margin-bottom:16px">
        <div class="card"><div class="card-title">Scanned</div><div class="index-price">${ws.total_scanned}</div></div>
        <div class="card"><div class="card-title">Green</div><div class="index-price" style="color:var(--green)">${ws.green_count}</div></div>
        <div class="card"><div class="card-title">Red</div><div class="index-price" style="color:var(--red)">${ws.red_count}</div></div>
      </div>`;
    }

    // All scanned tickers
    if (data.premarket_all_scanned?.length) {
      html += '<div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Price</th><th>Change</th><th>Score</th><th>Signals</th><th>RSI</th></tr></thead><tbody>';
      data.premarket_all_scanned.forEach(s => {
        const cls = Utils.changeClass(s.change_pct);
        const signals = (s.signals || []).map(sig => {
          const badgeClass = sig.includes('bear') || sig.includes('over') ? 'badge-red' : 'badge-green';
          return `<span class="badge ${badgeClass}" style="margin:2px">${sig.replace(/_/g, ' ')}</span>`;
        }).join(' ');
        html += `<tr>
          <td><a href="#/ticker/${s.ticker}" class="archive-date">${s.ticker}</a></td>
          <td>${Utils.formatPrice(s.price)}</td>
          <td class="${cls}">${Utils.formatPct(s.change_pct)}</td>
          <td>${Utils.scoreBadge(s.score)}</td>
          <td style="max-width:300px">${signals || '—'}</td>
          <td>${s.rsi != null ? s.rsi : '—'}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    } else if (data.premarket_top_setups?.length) {
      html += '<div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Price</th><th>Change</th><th>Score</th><th>Signals</th><th>RSI</th><th>Verdict</th></tr></thead><tbody>';
      data.premarket_top_setups.forEach(s => {
        const cls = Utils.changeClass(s.change_pct);
        const signals = (s.signals || []).map(sig => {
          const badgeClass = sig.includes('bear') || sig.includes('over') ? 'badge-red' : 'badge-green';
          return `<span class="badge ${badgeClass}" style="margin:2px">${sig.replace(/_/g, ' ')}</span>`;
        }).join(' ');
        const verdictBadge = s.council_verdict === 'bullish' ? 'badge-green' :
                            s.council_verdict === 'bearish' ? 'badge-red' : 'badge-yellow';
        const councilSummary = s.council_summary ? ` title="${s.council_summary}"` : '';

        html += `<tr>
          <td><a href="#/ticker/${s.ticker}" class="archive-date">${s.ticker}</a></td>
          <td>${Utils.formatPrice(s.price)}</td>
          <td class="${cls}">${Utils.formatPct(s.change_pct)}</td>
          <td>${Utils.scoreBadge(s.score)}</td>
          <td style="max-width:300px">${signals}</td>
          <td>${s.rsi != null ? s.rsi : '—'}</td>
          <td><span class="badge ${verdictBadge}"${councilSummary}>${s.council_verdict || '—'}</span></td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    } else {
      html += '<div class="empty-state">No pre-market setups available. Run the premarket scan first.</div>';
    }

    html += '</div>';
    app.innerHTML = html;
  }
};
