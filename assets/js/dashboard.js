/**
 * Dashboard — Main overview page with ALL briefing sections.
 */
const Dashboard = {
  async render(app) {
    app.innerHTML = '<div class="loading">Loading market data...</div>';
    State.invalidate('latest'); // Force fresh fetch on every visit
    const data = await State.get('latest', '/data/latest.json');
    if (!data) {
      app.innerHTML = '<div class="error-card">Failed to load market data.</div>';
      return;
    }

    let html = this._buildHTML(data);
    app.innerHTML = html;
  },

  /** Render dashboard with pre-fetched data (for archive detail view) */
  renderWithData(app, data, title) {
    if (!data) {
      app.innerHTML = '<div class="error-card">No data available.</div>';
      return;
    }

    let html = '';

    // Archive context banner
    if (title) {
      html += '<div class="stale-banner" style="margin-bottom:16px">📂 ' + title + ' · <a href="#/archive" style="color:var(--accent);text-decoration:underline">← Back to Archive</a></div>';
    }

    html += this._buildHTML(data);
    app.innerHTML = html;
  },

  /** Shared HTML builder */
  _buildHTML(data) {
    let html = '';

    // Stale warning
    if (State.isStale(data.generated_at)) {
      html += '<div class="stale-banner">⚠ Data from ' + new Date(data.generated_at).toLocaleTimeString() + ' — may be stale</div>';
    }

    const ms = data.market_summary || {};

    // ── INDICES ──
    if (ms.indices?.length) {
      html += '<div class="section"><h2 class="section-title">Market Indices</h2><div class="grid-4">';
      ms.indices.forEach(idx => {
        const cls = Utils.changeClass(idx.change_pct);
        html += `<div class="card index-card"><div class="index-ticker">${idx.ticker}</div><div class="index-price">${Utils.formatPrice(idx.price)}</div><div class="index-change ${cls}">${Utils.formatPct(idx.change_pct)}</div></div>`;
      });
      html += '</div></div>';
    }

    // ── CONDITIONS + FX ──
    html += '<div class="section"><h2 class="section-title">Market Conditions</h2><div class="grid-3">';
    if (ms.vix != null) html += `<div class="card"><div class="card-title">VIX</div><div class="index-price">${Utils.formatPrice(ms.vix)}</div></div>`;
    if (ms.ten_year_yield != null) html += `<div class="card"><div class="card-title">10Y Yield</div><div class="index-price">${ms.ten_year_yield}%</div></div>`;
    (ms.fx_rates || []).forEach(fx => {
      const cls = fx.change_pct != null ? Utils.changeClass(fx.change_pct) : '';
      html += `<div class="card"><div class="card-title">${fx.pair}</div><div class="index-price">${fx.price}</div>${fx.change_pct != null ? `<div class="index-change ${cls}">${Utils.formatPct(fx.change_pct)}</div>` : ''}</div>`;
    });
    html += '</div></div>';

    // ── NARRATIVE / MARKET INTEL ──
    if (data.narrative?.summary_paragraph) {
      const rendered = Utils.renderMarkdown(data.narrative.summary_paragraph);
      html += `<div class="section"><div class="card narrative-card"><div class="intel-body">${rendered}</div></div></div>`;
    }

    // ── CENTRAL BANKS ──
    if (data.central_banks) {
      html += '<div class="section"><h2 class="section-title">Central Banks</h2><div class="grid-2">';
      ['fed', 'boc'].forEach(bank => {
        const label = bank === 'fed' ? 'Federal Reserve' : 'Bank of Canada';
        const text = data.central_banks[bank];
        if (text) html += `<div class="card"><div class="card-title">${label}</div><div style="font-size:0.875rem;color:var(--text-secondary);line-height:1.65">${text.substring(0, 300)}</div></div>`;
      });
      html += '</div></div>';
    }

    // ── PREMARKET SETUPS ──
    if (data.premarket_top_setups?.length) {
      html += '<div class="section"><h2 class="section-title">Top Setups</h2><div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Price</th><th>Chg</th><th>Score</th><th>Signals</th><th>RSI</th><th>Verdict</th></tr></thead><tbody>';
      data.premarket_top_setups.forEach(s => {
        const cls = s.change_pct != null ? Utils.changeClass(s.change_pct) : '';
        const signals = (s.signals || []).map(sig => `<span class="badge ${sig.includes('bear') || sig.includes('over') ? 'badge-red' : 'badge-green'}" style="margin:1px">${sig.replace(/_/g, ' ')}</span>`).join(' ');
        const vBadge = s.council_verdict === 'bullish' ? 'badge-green' : s.council_verdict === 'bearish' ? 'badge-red' : 'badge-yellow';
        html += `<tr><td><a href="#/ticker/${s.ticker}">${s.ticker}</a></td><td>${Utils.formatPrice(s.price)}</td><td class="${cls}">${Utils.formatPct(s.change_pct)}</td><td>${Utils.scoreBadge(s.score)}</td><td style="max-width:250px">${signals}</td><td>${s.rsi != null ? s.rsi : '—'}</td><td><span class="badge ${vBadge}">${s.council_verdict || '—'}</span></td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }

    // ── ANALYST RATINGS ──
    if (data.market_news?.analyst_ratings?.length) {
      html += '<div class="section"><h2 class="section-title">Analyst Ratings</h2><div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Strong Buy</th><th>Buy</th><th>Hold</th><th>Sell</th><th>Strong Sell</th></tr></thead><tbody>';
      data.market_news.analyst_ratings.forEach(a => {
        html += `<tr><td><strong>${a.ticker}</strong></td><td><span class="badge badge-green">${a.strongBuy || 0}</span></td><td style="color:var(--green)">${a.buy || 0}</td><td style="color:var(--yellow)">${a.hold || 0}</td><td style="color:var(--red)">${a.sell || 0}</td><td><span class="badge badge-red">${a.strongSell || 0}</span></td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }

    // ── INSIDER TRADES ──
    if (data.insider_trades?.length) {
      html += '<div class="section"><h2 class="section-title">Insider Trading Signals</h2><div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Signal</th><th>Confidence</th><th>Ratio</th><th>Buy/Sell</th><th>Summary</th></tr></thead><tbody>';
      data.insider_trades.forEach(i => {
        const sigCls = i.signal === 'STRONG_BULLISH' ? 'badge-green' : i.signal === 'BULLISH' ? 'badge-green' : i.signal === 'BEARISH' ? 'badge-red' : 'badge-yellow';
        html += `<tr><td><strong>${i.ticker}</strong></td><td><span class="badge ${sigCls}">${i.signal}</span></td><td>${i.confidence || '—'}</td><td>${i.ratio?.toFixed(1) || '—'}</td><td><span class="badge badge-green">${i.buys}B</span> <span class="badge badge-red">${i.sells}S</span></td><td style="font-size:0.8rem;color:var(--text-secondary)">${i.summary || ''}</td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }

    // ── CONGRESS TRADES ──
    if (data.congress?.recent_trades?.length) {
      const cong = data.congress;
      html += '<div class="section"><h2 class="section-title">Congress Trading</h2>';
      if (cong.summary) html += `<div style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:12px">${cong.summary}</div>`;
      html += '<div class="card table-wrap"><table><thead><tr><th>Politician</th><th>Party</th><th>Action</th><th>Asset</th><th>Size</th><th>Price</th></tr></thead><tbody>';
      cong.recent_trades.forEach(t => {
        const partyCls = t.party === 'D' ? 'badge-green' : t.party === 'R' ? 'badge-red' : 'badge-yellow';
        const actionCls = t.action?.toLowerCase().includes('sell') ? 'negative' : 'positive';
        html += `<tr><td>${t.politician}</td><td><span class="badge ${partyCls}">${t.party || '—'}</span></td><td class="${actionCls}">${t.action}</td><td>${t.ticker || '—'}</td><td>${t.size || '—'}</td><td>${Utils.formatPrice(t.price)}</td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }

    // ── MARKET NEWS ──
    if (data.market_news?.headlines?.length) {
      html += '<div class="section"><h2 class="section-title">Market News</h2><div class="card">';
      data.market_news.headlines.forEach(n => {
        html += `<div style="padding:10px 0;border-bottom:1px solid var(--border-subtle);font-size:0.9rem"><a href="${n.url || '#'}" target="_blank" style="color:var(--text-primary);text-decoration:none;font-weight:500">${n.title}</a><div style="color:var(--text-muted);font-size:0.75rem;margin-top:3px">${n.source || ''} ${n.category ? '· ' + n.category : ''}</div></div>`;
      });
      html += '</div></div>';
    }

    // ── UNUSUAL WHALES ──
    if (data.unusual_whales?.summary) {
      html += '<div class="section"><h2 class="section-title">🐋 Market Signals</h2><div class="card"><div style="font-size:0.875rem;color:var(--text-secondary);line-height:1.65;white-space:pre-wrap">' + data.unusual_whales.summary.substring(0, 1000) + '</div></div></div>';
    }

    // ── EARNINGS ──
    if (data.market_news?.earnings?.length) {
      // Filter to only earnings with actual estimates
      const hasEstimates = data.market_news.earnings.filter(e => e.epsEstimate != null);
      if (hasEstimates.length) {
        html += '<div class="section"><h2 class="section-title">Earnings This Week</h2><div class="card table-wrap"><table><thead><tr><th>Date</th><th>Ticker</th><th>Quarter</th><th>Estimate</th></tr></thead><tbody>';
        hasEstimates.forEach(e => {
          html += '<tr><td>' + (e.date || '') + '</td><td><strong>' + (e.symbol || e.ticker || '') + '</strong></td><td>' + (e.quarter || '') + '</td><td>' + (e.epsEstimate != null ? '$' + Number(e.epsEstimate).toFixed(2) : '—') + '</td></tr>';
        });
        html += '</tbody></table></div></div>';
      }

    // Timestamp
    if (data.generated_at) {
      html += '<div style="text-align:center;color:var(--text-muted);font-size:0.8rem;padding:16px">Generated ' + new Date(data.generated_at).toLocaleString() + '</div>';
    }

    return html;
  }
};
