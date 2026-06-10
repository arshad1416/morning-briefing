/**
 * Dashboard — Main "Today" overview page.
 * Compact, decision-focused layout per Fable 5 redesign.
 */
const Dashboard = {
  async renderToday(app) {
    app.innerHTML = '<div class="loading">Loading...</div>';
    
    const [marketData, tradesData, analysisData] = await Promise.all([
      State.get('latest', '/data/latest.json').catch(() => null),
      State.get('trades', '/data/paper_trades.json').catch(() => null),
      State.get('analysis', '/data/analysis.json').catch(() => null),
    ]);

    let html = '';
    const ms = marketData?.market_summary || {};
    const vix = ms.vix;

    // ── 1. REGIME BADGE ──
    html += this._regimeBadge(vix, ms);

    // ── 2. COMPACT INDICES STRIP ──
    if (ms.indices?.length) {
      const valid = ms.indices.filter(i => i.ticker && !i.ticker.startsWith('_'));
      const keep = valid.filter(i => ['SPY','SP500','S&P','QQQ','NASDAQ','VIX','TSX','10Y'].some(k => (i.ticker||'').includes(k)));
      if (keep.length) {
        html += '<div class="today-strip">';
        keep.forEach(idx => {
          const cls = Utils.changeClass(idx.change_pct);
          html += `<div class="today-strip-item"><span class="today-strip-label">${Utils.esc(idx.ticker)}</span><span class="today-strip-val ${cls}">${Utils.formatPct(idx.change_pct)}</span></div>`;
        });
        html += '</div>';
      }
    }

    // ── 3. DAY P&L ──
    if (tradesData?.portfolio) {
      const p = tradesData.portfolio;
      const pnlCls = p.total_pnl >= 0 ? 'positive' : 'negative';
      html += `<div class="today-pnl ${pnlCls}">`;
      html += `<span class="today-pnl-label">P&amp;L</span>`;
      html += `<span class="today-pnl-val">$${Utils.formatPrice(Math.abs(p.total_pnl))}</span>`;
      html += `<span class="today-pnl-pct">(${Utils.formatPct(p.return_pct)})</span>`;
      html += `<span class="today-pnl-cash">Cash: $${Utils.formatPrice(p.cash)}</span>`;
      html += '</div>';
    }

    // ── 4. OPEN POSITIONS ──
    if (tradesData?.open_positions?.length) {
      html += '<div class="today-section"><div class="today-section-title">Open Positions</div>';
      tradesData.open_positions.forEach(pos => {
        const pnlCls = pos.pnl >= 0 ? 'positive' : 'negative';
        const daysHeld = pos.entry_date ? Math.floor((Date.now() - new Date(pos.entry_date).getTime()) / 86400000) + 1 : 0;
        const maxDays = 5;
        const timeLeft = Math.max(0, maxDays - daysHeld);
        html += `<div class="today-pos-row ${pnlCls}">`;
        html += `<span class="today-pos-ticker">${Utils.esc(pos.ticker)}</span>`;
        html += `<span class="today-pos-pnl">${Utils.formatPrice(pos.pnl >= 0 ? '+' : '')}$${Utils.formatPrice(Math.abs(pos.pnl))} (${Utils.formatPct(pos.pnl_pct)})</span>`;
        html += `<span class="today-pos-stop">⏱ ${timeLeft}d</span>`;
        html += '</div>';
      });
      html += '</div>';
    } else {
      html += '<div class="today-empty">No open positions</div>';
    }

    // ── 5. ACTION QUEUE (top signals from screener) ──
    const setups = marketData?.premarket_top_setups || [];
    if (setups.length) {
      html += '<div class="today-section"><div class="today-section-title">Action Queue</div>';
      setups.slice(0, 3).forEach(s => {
        const signals = (s.signals || []).filter(sig => sig.includes('oversold') || sig.includes('pullback') || sig.includes('breakout')).join(', ');
        html += `<div class="today-signal-row">`;
        html += `<span class="today-signal-ticker"><a href="#/ticker/${Utils.esc(s.ticker)}">${Utils.esc(s.ticker)}</a></span>`;
        html += `<span class="today-signal-price">$${Utils.formatPrice(s.price)}</span>`;
        html += `<span class="today-signal-rsi">RSI ${s.rsi != null ? s.rsi : '—'}</span>`;
        html += `<span class="today-signal-score">${Utils.scoreBadge(s.score)}</span>`;
        html += `<span class="today-signal-desc">${Utils.esc(signals || '')}</span>`;
        html += '</div>';
      });
      html += '</div>';
    }

    // ── 6. OPTIONS FLOW HIGHLIGHTS ──
    if (analysisData?.options_flow?.top_overbought_calls?.length) {
      const calls = analysisData.options_flow.top_overbought_calls.slice(0, 3);
      html += '<div class="today-section"><div class="today-section-title">Options Flow</div>';
      calls.forEach(o => {
        html += `<div class="today-flow-row">`;
        html += `<span class="today-flow-ticker">${Utils.esc(o.ticker)}</span>`;
        html += `<span class="today-flow-call">${o.type === 'call' ? '☎' : '⛔'} $${Utils.esc(o.strike)}</span>`;
        html += `<span class="today-flow-vol">${o.vol_oi_ratio}x OI</span>`;
        html += `<span class="today-flow-premium">$${(o.premium / 1000000).toFixed(1)}M</span>`;
        html += '</div>';
      });
      html += '</div>';
    }

    // ── 7. HEADLINES (compact) ──
    if (marketData?.market_news?.headlines?.length) {
      html += '<div class="today-section"><div class="today-section-title">Headlines</div>';
      html += '<div class="today-headlines">';
      marketData.market_news.headlines.slice(0, 3).forEach(n => {
        html += `<div class="today-headline"><a href="${Utils.esc(Utils.safeUrl(n.url))}" target="_blank" rel="noopener">${Utils.esc(n.title.slice(0, 80))}</a></div>`;
      });
      html += '</div></div>';
    }

    app.innerHTML = html;
  },

  _regimeBadge(vix, ms) {
    if (vix == null) return '';
    let label = 'NEUTRAL', cls = 'regime-neutral';
    if (vix < 15) { label = 'RISK-ON'; cls = 'regime-risk-on'; }
    else if (vix >= 15 && vix <= 20) { label = 'NEUTRAL'; cls = 'regime-neutral'; }
    else if (vix > 20 && vix <= 28) { label = 'RISK-OFF'; cls = 'regime-risk-off'; }
    else if (vix > 28) { label = 'STRESS'; cls = 'regime-stress'; }

    const vixChange = ms.vix_change_pct != null ? Utils.formatPct(ms.vix_change_pct) : '';
    const vixCls = ms.vix_change_pct != null ? Utils.changeClass(ms.vix_change_pct) : '';

    return `<div class="today-regime ${cls}">
      <span class="regime-badge">● ${label}</span>
      <span class="regime-vix">VIX ${Utils.formatPrice(vix)} <span class="${vixCls}">${vixChange}</span></span>
      <span class="regime-ten">10Y ${ms.ten_year_yield != null ? ms.ten_year_yield + '%' : '—'}</span>
    </div>`;
  },

  /** Legacy render kept for archive detail view */
  async render(app) {
    app.innerHTML = '<div class="loading">Loading market data...</div>';
    const data = await State.get('latest', '/data/latest.json');
    if (!data) {
      app.innerHTML = '<div class="error-card">Failed to load market data.</div>';
      return;
    }
    let html = this._buildHTML(data);
    app.innerHTML = html;
  },

  renderWithData(app, data, title) {
    if (!data) { app.innerHTML = '<div class="error-card">No data available.</div>'; return; }
    let html = '';
    if (title) {
      html += '<div class="stale-banner" style="margin-bottom:16px">📂 ' + Utils.esc(title) + ' · <a href="#/research" style="color:var(--accent);text-decoration:underline">← Archive</a></div>';
    }
    html += this._buildHTML(data);
    app.innerHTML = html;
  },

  /** Full dashboard HTML builder (kept for archive view) */
  _buildHTML(data) { /* Full old rendering kept for archive display */
    let html = '';
    if (State.isStale(data.generated_at)) {
      html += '<div class="stale-banner">⚠ Data from ' + new Date(data.generated_at).toLocaleString() + ' — may be stale</div>';
    }
    if (data.generated_at) {
      html += '<div style="text-align:right;color:var(--text-muted);font-size:0.8rem;padding:4px 0 12px 0">Generated ' + new Date(data.generated_at).toLocaleString() + '</div>';
    }
    const ms = data.market_summary || {};
    if (ms.indices?.length) {
      const valid = ms.indices.filter(i => i.ticker && !i.ticker.startsWith('_'));
      if (valid.length) {
        html += '<div class="section"><h2 class="section-title">Market Indices</h2><div class="grid-4">';
        valid.forEach(idx => {
          const cls = Utils.changeClass(idx.change_pct);
          html += `<div class="card index-card"><div class="index-ticker">${Utils.esc(idx.ticker)}</div><div class="index-price">${Utils.formatPrice(idx.price)}</div><div class="index-change ${cls}">${Utils.formatPct(idx.change_pct)}</div></div>`;
        });
        html += '</div></div>';
      }
    }
    if (data.narrative?.summary_paragraph) {
      const rendered = Utils.renderMarkdown(data.narrative.summary_paragraph);
      html += `<div class="section"><div class="card narrative-card"><div class="intel-body">${rendered}</div></div></div>`;
    }
    if (data.geopolitical?.length) {
      html += '<div class="section"><h2 class="section-title">🌍 Geopolitical Risks & Global News</h2><div class="card">';
      data.geopolitical.slice(0, 8).forEach(g => {
        html += `<div style="padding:10px 0;border-bottom:1px solid var(--border-subtle);font-size:0.9rem"><a href="${Utils.esc(Utils.safeUrl(g.url))}" target="_blank" style="color:var(--text-primary);text-decoration:none;font-weight:500">${Utils.esc(g.title)}</a><div style="color:var(--text-muted);font-size:0.75rem">${Utils.esc(g.source)}</div></div>`;
      });
      html += '</div></div>';
    }
    if (data.premarket_top_setups?.length) {
      html += '<div class="section"><h2 class="section-title">Top Setups</h2>' + this._buildSetupsTable(data.premarket_top_setups) + '</div>';
    }
    if (data.market_news?.headlines?.length) {
      html += '<div class="section"><h2 class="section-title">Market News</h2><div class="card">';
      data.market_news.headlines.forEach(n => {
        html += `<div style="padding:10px 0;border-bottom:1px solid var(--border-subtle)"><a href="${Utils.esc(Utils.safeUrl(n.url))}" target="_blank" style="color:var(--text-primary);text-decoration:none;font-weight:500">${Utils.esc(n.title)}</a><div style="color:var(--text-muted);font-size:0.75rem">${Utils.esc(n.source || '')}</div></div>`;
      });
      html += '</div></div>';
    }
    if (data.market_news?.analyst_ratings?.length) {
      html += '<div class="section"><h2 class="section-title">Analyst Ratings</h2><div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Strong Buy</th><th>Buy</th><th>Hold</th><th>Sell</th><th>Strong Sell</th></tr></thead><tbody>';
      data.market_news.analyst_ratings.forEach(a => {
        html += `<tr><td><strong>${Utils.esc(a.ticker)}</strong></td><td><span class="badge badge-green">${a.strongBuy || 0}</span></td><td style="color:var(--green)">${a.buy || 0}</td><td style="color:var(--yellow)">${a.hold || 0}</td><td style="color:var(--red)">${a.sell || 0}</td><td><span class="badge badge-red">${a.strongSell || 0}</span></td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }
    if (data.congress?.recent_trades?.length) {
      html += '<div class="section"><h2 class="section-title">Congress Trading</h2><div class="card table-wrap"><table><thead><tr><th>Politician</th><th>Party</th><th>Action</th><th>Asset</th><th>Size</th><th>Price</th></tr></thead><tbody>';
      data.congress.recent_trades.forEach(t => {
        html += `<tr><td>${Utils.esc(t.politician)}</td><td><span class="badge ${t.party === 'D' ? 'badge-green' : t.party === 'R' ? 'badge-red' : 'badge-yellow'}">${Utils.esc(t.party || '—')}</span></td><td class="${t.action?.toLowerCase().includes('sell') ? 'negative' : 'positive'}">${Utils.esc(t.action)}</td><td>${Utils.esc(t.ticker || '—')}</td><td>${Utils.esc(t.size || '—')}</td><td>${Utils.formatPrice(t.price)}</td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }
    if (data.market_news?.earnings?.length) {
      const hasEst = data.market_news.earnings.filter(e => e.epsEstimate != null);
      if (hasEst.length) {
        html += '<div class="section"><h2 class="section-title">Earnings This Week</h2><div class="card table-wrap"><table><thead><tr><th>Date</th><th>Ticker</th><th>Quarter</th><th>Estimate</th></tr></thead><tbody>';
        hasEst.forEach(e => { html += '<tr><td>' + Utils.esc(e.date || '') + '</td><td><strong>' + Utils.esc(e.symbol || e.ticker || '') + '</strong></td><td>' + Utils.esc(e.quarter || '') + '</td><td>' + (e.epsEstimate != null ? '$' + Number(e.epsEstimate).toFixed(2) : '—') + '</td></tr>'; });
        html += '</tbody></table></div></div>';
      }
    }
    return html;
  },

  _buildSetupsTable(setups) {
    let h = '<div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Price</th><th>Chg</th><th>Score</th><th>Signals</th><th>RSI</th><th>Verdict</th></tr></thead><tbody>';
    setups.forEach(s => {
      const cls = s.change_pct != null ? Utils.changeClass(s.change_pct) : '';
      const signals = (s.signals || []).map(sig => `<span class="badge ${sig.includes('bear') || sig.includes('over') ? 'badge-red' : 'badge-green'}" style="margin:1px">${Utils.esc(sig.replace(/_/g, ' '))}</span>`).join(' ');
      const vBadge = s.council_verdict === 'bullish' ? 'badge-green' : s.council_verdict === 'bearish' ? 'badge-red' : 'badge-yellow';
      h += `<tr><td><a href="#/ticker/${Utils.esc(s.ticker)}">${Utils.esc(s.ticker)}</a></td><td>${Utils.formatPrice(s.price)}</td><td class="${cls}">${Utils.formatPct(s.change_pct)}</td><td>${Utils.scoreBadge(s.score)}</td><td style="max-width:250px">${signals}</td><td>${s.rsi != null ? s.rsi : '—'}</td><td><span class="badge ${vBadge}">${Utils.esc(s.council_verdict || '—')}</span></td></tr>`;
    });
    h += '</tbody></table></div>';
    return h;
  }
};
