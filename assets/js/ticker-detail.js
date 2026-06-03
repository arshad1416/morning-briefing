/**
 * Ticker Detail — Deep dive for a single ticker.
 * Route: #/ticker/{TICKER}
 */
const TickerDetail = {
  async render(app, params) {
    const ticker = params?.ticker?.toUpperCase();
    if (!ticker) {
      app.innerHTML = '<div class="error-card">No ticker specified.</div>';
      return;
    }

    app.innerHTML = `<div class="loading">Loading ${ticker} data...</div>`;

    // Try fetching from the latest.json first (faster, but may not have per-ticker detail)
    const latest = await State.get('latest', '/data/latest.json');
    const scanEntry = latest?.premarket_top_setups?.find(s => s.ticker === ticker);

    // Then try the dedicated ticker file
    const tickerData = await State.get(`ticker:${ticker}`, `/data/tickers/${ticker}.json`);

    if (!tickerData && !scanEntry) {
      app.innerHTML = `<div class="error-card">No data available for ${ticker}.</div>`;
      return;
    }

    const t = tickerData || {};
    const scan = scanEntry || {};

    let html = `<div class="section">
      <div style="display:flex;align-items:baseline;gap:16px;margin-bottom:24px">
        <h2 class="section-title" style="margin-bottom:0">${ticker}</h2>
        ${t.name ? `<span style="color:var(--text-secondary)">${t.name}</span>` : ''}
      </div>`;

    // Price card
    const price = t.price || scan.price;
    const changePct = t.change_pct || scan.change_pct;
    const cls = Utils.changeClass(changePct);
    html += `<div class="grid-4" style="margin-bottom:24px">
      <div class="card">
        <div class="card-title">Price</div>
        <div class="index-price">${Utils.formatPrice(price)}</div>
        ${changePct != null ? `<div class="index-change ${cls}">${Utils.formatPct(changePct)}</div>` : ''}
      </div>`;

    // Score
    if (t.council_analysis?.score || scan.score) {
      html += `<div class="card"><div class="card-title">Score</div><div style="font-size:1.5rem">${Utils.scoreBadge(t.council_analysis?.score || scan.score)}</div></div>`;
    }

    // Verdict
    if (t.council_analysis?.verdict || scan.council_verdict) {
      const verdict = t.council_analysis?.verdict || scan.council_verdict;
      const vCls = verdict === 'bullish' ? 'badge-green' : verdict === 'bearish' ? 'badge-red' : 'badge-yellow';
      html += `<div class="card"><div class="card-title">Council Verdict</div><div style="font-size:1.2rem"><span class="badge ${vCls}" style="font-size:1rem;padding:4px 12px">${verdict}</span></div></div>`;
    }

    // Market cap
    if (t.fundamentals?.market_cap) {
      html += `<div class="card"><div class="card-title">Market Cap</div><div style="font-size:1.2rem;font-weight:600">${t.fundamentals.market_cap}</div></div>`;
    }
    html += '</div>';

    // Technicals
    if (t.technical) {
      const tech = t.technical;
      html += `<div class="section"><h3 class="section-title">Technicals</h3><div class="grid-3">`;
      html += tech.rsi_14 != null ? `<div class="card"><div class="card-title">RSI (14)</div><div class="index-price">${tech.rsi_14}</div></div>` : '';
      html += tech.sma_20 != null ? `<div class="card"><div class="card-title">SMA 20</div><div class="index-price">${Utils.formatPrice(tech.sma_20)}</div></div>` : '';
      html += tech.sma_50 != null ? `<div class="card"><div class="card-title">SMA 50</div><div class="index-price">${Utils.formatPrice(tech.sma_50)}</div></div>` : '';
      html += tech.support_1 != null ? `<div class="card"><div class="card-title">Support</div><div style="font-size:1.2rem;font-weight:600">${Utils.formatPrice(tech.support_1)}</div></div>` : '';
      html += tech.resistance_1 != null ? `<div class="card"><div class="card-title">Resistance</div><div style="font-size:1.2rem;font-weight:600">${Utils.formatPrice(tech.resistance_1)}</div></div>` : '';
      html += tech.atr != null ? `<div class="card"><div class="card-title">ATR</div><div style="font-size:1.2rem;font-weight:600">${Utils.formatPrice(tech.atr)}</div></div>` : '';
      html += '</div></div>';
    }

    // Fundamentals
    if (t.fundamentals) {
      const f = t.fundamentals;
      html += `<div class="section"><h3 class="section-title">Fundamentals</h3><div class="grid-3">`;
      if (f.pe_ratio) html += `<div class="card"><div class="card-title">P/E</div><div style="font-size:1.2rem">${f.pe_ratio}</div></div>`;
      if (f.eps) html += `<div class="card"><div class="card-title">EPS</div><div style="font-size:1.2rem">$${f.eps}</div></div>`;
      if (f.beta) html += `<div class="card"><div class="card-title">Beta</div><div style="font-size:1.2rem">${f.beta}</div></div>`;
      if (f.dividend_yield) html += `<div class="card"><div class="card-title">Div Yield</div><div style="font-size:1.2rem">${(f.dividend_yield * 100).toFixed(2)}%</div></div>`;
      html += '</div></div>';
    }

    // Options
    if (t.options) {
      const o = t.options;
      html += `<div class="section"><h3 class="section-title">Options Flow</h3><div class="grid-3">`;
      if (o.put_call_ratio != null) html += `<div class="card"><div class="card-title">P/C Ratio</div><div style="font-size:1.2rem">${o.put_call_ratio.toFixed(2)}</div></div>`;
      if (o.max_pain != null) html += `<div class="card"><div class="card-title">Max Pain</div><div style="font-size:1.2rem">$${o.max_pain}</div></div>`;
      if (o.iv_rank != null) html += `<div class="card"><div class="card-title">IV Rank</div><div style="font-size:1.2rem">${o.iv_rank}%</div></div>`;
      html += '</div></div>';
    }

    // Council analysis narrative
    if (t.council_analysis) {
      const ca = t.council_analysis;
      html += `<div class="section"><h3 class="section-title">Council Analysis</h3><div class="card">`;
      if (ca.bull_case) html += `<div style="margin-bottom:12px"><span class="badge badge-green" style="margin-bottom:4px">Bull Case</span><p style="color:var(--text-secondary);margin-top:8px">${ca.bull_case}</p></div>`;
      if (ca.bear_case) html += `<div style="margin-bottom:12px"><span class="badge badge-red" style="margin-bottom:4px">Bear Case</span><p style="color:var(--text-secondary);margin-top:8px">${ca.bear_case}</p></div>`;
      if (ca.risk_assessment) html += `<div><span class="badge badge-yellow" style="margin-bottom:4px">Risk Assessment</span><p style="color:var(--text-secondary);margin-top:8px">${ca.risk_assessment}</p></div>`;
      html += '</div></div>';
    }

    // Council summary from scan (fallback)
    if (scan.council_summary && !t.council_analysis) {
      html += `<div class="section"><h3 class="section-title">Council Verdict</h3><div class="card"><p style="color:var(--text-secondary)">${scan.council_summary}</p></div></div>`;
    }

    html += '</div>';
    app.innerHTML = html;
  }
};
