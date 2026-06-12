/**
 * Options Flow — Unusual Options Activity Dashboard
 * Shows top overbought calls and puts from analysis.json.
 * Replaces the MapleGamma landing page at #/options.
 */
const OptionsFlow = {
  async render(app) {
    app.innerHTML = '<div class="loading">Loading options flow...</div>';

    const analysisData = await State.get('analysis', '/data/analysis.json').catch(() => null);
    if (!analysisData?.options_flow) {
      app.innerHTML = '<div class="error-card">Options flow data not available. Run generate_analysis.py first.</div>';
      return;
    }

    const flow = analysisData.options_flow;
    const generated = analysisData.generated_at || analysisData.market_overview?.generated_at || '';

    let html = '<div class="section">';

    // ── Hero summary ──
    html += '<div class="card" style="margin-bottom:16px;background:var(--card-gradient, var(--bg-card))">';
    html += '<div style="display:flex;flex-wrap:wrap;gap:20px;align-items:center">';

    // Total unusual contracts
    html += '<div style="flex:1;min-width:120px">';
    html += '<div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Unusual Contracts</div>';
    html += `<div style="font-size:1.8rem;font-weight:700">${flow.total_unusual_contracts || 0}</div>`;
    html += '</div>';

    // Call/Put ratio
    const cpRatio = flow.call_put_ratio || '—';
    const cpParts = typeof cpRatio === 'string' ? cpRatio.split(':') : [];
    const callCnt = parseInt(cpParts[0]) || 0;
    const putCnt = parseInt(cpParts[1]) || 0;
    const isCallHeavy = callCnt >= putCnt;
    const ratioColor = isCallHeavy ? 'var(--green, #4caf50)' : 'var(--red, #f44336)';
    html += '<div style="flex:1;min-width:120px">';
    html += '<div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Call/Put Ratio</div>';
    html += `<div style="font-size:1.8rem;font-weight:700;color:${ratioColor}">${cpRatio}</div>`;
    html += '</div>';

    // Call vs Put bar
    const total = callCnt + putCnt || 1;
    const callPct = (callCnt / total * 100).toFixed(0);
    const putPct = (putCnt / total * 100).toFixed(0);
    html += '<div style="flex:2;min-width:200px">';
    html += '<div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Distribution</div>';
    html += '<div style="display:flex;height:24px;border-radius:12px;overflow:hidden">';
    html += `<div style="flex:${callCnt};background:var(--green, #4caf50);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:600;color:#fff">☎ Calls ${callPct}%</div>`;
    html += `<div style="flex:${putCnt};background:var(--red, #f44336);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:600;color:#fff">⛔ Puts ${putPct}%</div>`;
    html += '</div>';
    html += '</div>';

    // Timestamp
    if (generated) {
      html += '<div style="flex:0;font-size:0.75rem;color:var(--text-muted);white-space:nowrap">';
      html += `<span>Updated ${Utils.esc(generated)}</span>`;
      html += '</div>';
    }

    html += '</div></div>'; // close hero card

    // ── Premium concentration bar ──
    html += '<div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:16px">';
    html += this._renderPremiumCard(flow.top_overbought_calls || [], 'call', '☎', 'Top Call Premium', 'var(--green, #4caf50)');
    html += this._renderPremiumCard(flow.top_overbought_puts || [], 'put', '⛔', 'Top Put Premium', 'var(--red, #f44336)');
    html += '</div>';

    // ── OVERBOUGHT CALLS TABLE ──
    if (flow.top_overbought_calls?.length) {
      html += '<div class="card" style="margin-bottom:16px">';
      html += '<div class="card-title" style="color:var(--green, #4caf50);font-size:1rem">☎ Overbought Calls</div>';
      html += '<div class="table-wrap">';
      html += '<table class="of-table"><thead><tr>';
      html += '<th>Ticker</th><th>Strike</th><th>Expiry</th><th>Volume</th><th>Vol/OI</th><th>Premium</th><th>Signal</th>';
      html += '</tr></thead><tbody>';
      flow.top_overbought_calls.forEach(o => {
        const ratioWidth = Math.min(100, (o.vol_oi_ratio || 0) * 5);
        const premiumStr = o.premium >= 1000000
          ? '$' + (o.premium / 1000000).toFixed(1) + 'M'
          : o.premium >= 1000
            ? '$' + (o.premium / 1000).toFixed(0) + 'K'
            : '$' + o.premium.toFixed(0);
        html += '<tr>';
        html += `<td><strong>${Utils.esc(o.ticker)}</strong></td>`;
        html += `<td>$${Utils.esc(o.strike)}</td>`;
        html += `<td style="font-size:0.8rem">${o.expiration ? Utils.esc(o.expiration) : (o.expiry ? Utils.esc(o.expiry) : '—')}</td>`;
        html += `<td>${o.volume != null ? o.volume.toLocaleString() : '—'}</td>`;
        html += `<td style="font-weight:600">${o.vol_oi_ratio != null ? o.vol_oi_ratio.toFixed(1) + 'x' : '—'}</td>`;
        html += `<td style="font-weight:600;color:var(--green, #4caf50)">${premiumStr}</td>`;
        html += `<td><div style="width:60px;height:6px;background:var(--bg-inset);border-radius:3px;overflow:hidden"><div style="width:${ratioWidth}%;height:100%;background:var(--green, #4caf50);border-radius:3px"></div></div></td>`;
        html += '</tr>';
      });
      html += '</tbody></table></div></div>';
    }

    // ── OVERBOUGHT PUTS TABLE ──
    if (flow.top_overbought_puts?.length) {
      html += '<div class="card" style="margin-bottom:16px">';
      html += '<div class="card-title" style="color:var(--red, #f44336);font-size:1rem">⛔ Overbought Puts</div>';
      html += '<div class="table-wrap">';
      html += '<table class="of-table"><thead><tr>';
      html += '<th>Ticker</th><th>Strike</th><th>Expiry</th><th>Volume</th><th>Vol/OI</th><th>Premium</th><th>Signal</th>';
      html += '</tr></thead><tbody>';
      flow.top_overbought_puts.forEach(o => {
        const ratioWidth = Math.min(100, (o.vol_oi_ratio || 0) * 5);
        const premiumStr = o.premium >= 1000000
          ? '$' + (o.premium / 1000000).toFixed(1) + 'M'
          : o.premium >= 1000
            ? '$' + (o.premium / 1000).toFixed(0) + 'K'
            : '$' + o.premium.toFixed(0);
        html += '<tr>';
        html += `<td><strong>${Utils.esc(o.ticker)}</strong></td>`;
        html += `<td>$${Utils.esc(o.strike)}</td>`;
        html += `<td style="font-size:0.8rem">${o.expiration ? Utils.esc(o.expiration) : (o.expiry ? Utils.esc(o.expiry) : '—')}</td>`;
        html += `<td>${o.volume != null ? o.volume.toLocaleString() : '—'}</td>`;
        html += `<td style="font-weight:600">${o.vol_oi_ratio != null ? o.vol_oi_ratio.toFixed(1) + 'x' : '—'}</td>`;
        html += `<td style="font-weight:600;color:var(--red, #f44336)">${premiumStr}</td>`;
        html += `<td><div style="width:60px;height:6px;background:var(--bg-inset);border-radius:3px;overflow:hidden"><div style="width:${ratioWidth}%;height:100%;background:var(--red, #f44336);border-radius:3px"></div></div></td>`;
        html += '</tr>';
      });
      html += '</tbody></table></div></div>';
    }

    // ── Key highlights ──
    html += '<div class="card">';
    html += '<div class="card-title" style="font-size:1rem">📊 Key Observations</div>';
    html += '<div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.7">';
    
    // Find highest conviction call and put
    const topCall = flow.top_overbought_calls?.[0];
    const topPut = flow.top_overbought_puts?.[0];
    
    if (topCall) {
      const cp = topCall.premium >= 1000000
        ? '$' + (topCall.premium / 1000000).toFixed(1) + 'M'
        : '$' + (topCall.premium / 1000).toFixed(0) + 'K';
      html += `<div>🔺 <strong>Highest conviction call:</strong> ${Utils.esc(topCall.ticker)} $${Utils.esc(topCall.strike)} — ${topCall.vol_oi_ratio?.toFixed(0)}x OI ratio, ${cp} premium</div>`;
    }
    if (topPut) {
      const pp = topPut.premium >= 1000000
        ? '$' + (topPut.premium / 1000000).toFixed(1) + 'M'
        : '$' + (topPut.premium / 1000).toFixed(0) + 'K';
      html += `<div>🔻 <strong>Heaviest put activity:</strong> ${Utils.esc(topPut.ticker)} $${Utils.esc(topPut.strike)} — ${topPut.vol_oi_ratio?.toFixed(0)}x OI ratio, ${pp} premium</div>`;
    }
    if (flow.call_put_ratio) {
      const bias = isCallHeavy
        ? 'Call bias — market leaning bullish on net'
        : 'Put bias — bearish hedging or speculation detected';
      html += `<div>⚖️ <strong>Balance:</strong> ${cpRatio} ratio. ${bias}</div>`;
    }
    
    html += '</div></div>';

    // ── MY OPTION POSITIONS (from paper trades) ──
    html += await this._renderMyPositions();

    // ── Footer note ──
    html += '<div style="margin-top:16px;padding:12px;background:var(--bg-inset);border-radius:8px;font-size:0.78rem;color:var(--text-muted);display:flex;justify-content:space-between;align-items:center">';
    html += '<span>Data from yfinance options chains — unusual activity defined as Vol/OI > 2×, volume > 100 contracts</span>';
    html += '<a href="#/maplegamma" style="color:var(--accent);text-decoration:none;font-size:0.78rem">MapleGamma GEX/DEX →</a>';
    html += '</div>';

    html += '</div>'; // close section
    app.innerHTML = html;
  },

  async _renderMyPositions() {
    let html = '';
    let tradesData = null;
    try {
      tradesData = await Utils.fetchJSON('/data/paper_trades.json');
    } catch (_e) {
      // ignore fetch errors
    }

    const positions = (tradesData?.open_positions || []).filter(pos => {
      const ac = (pos.asset_class || '').toUpperCase();
      const tp = (pos.type || '').toLowerCase();
      return ac === 'OPTION' || tp === 'option';
    });

    html += '<div class="card" style="margin-bottom:16px">';
    html += '<div class="card-title" style="font-size:1rem">📋 My Option Positions</div>';

    if (!positions.length) {
      html += '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:0.85rem">No open option positions</div>';
    } else {
      html += '<div class="table-wrap">';
      html += '<table class="of-table"><thead><tr>';
      html += '<th>Ticker</th><th>Strike</th><th>Expiry</th><th>DTE</th><th>Premium Paid</th><th>Current Premium</th><th>P&L</th><th>Status</th>';
      html += '</tr></thead><tbody>';

      positions.forEach(pos => {
        const strike = pos.option_strike || '—';
        const expiry = pos.option_expiration || '—';
        const dte = pos.option_days_to_expiry != null ? pos.option_days_to_expiry + 'd' : '—';
        const premiumPaid = pos.entry_price ? '$' + pos.entry_price.toFixed(2) : '—';
        const currentPrem = pos.current_price ? '$' + pos.current_price.toFixed(2) : '—';
        const pnl = pos.pnl || 0;
        const pnlCls = pnl >= 0 ? 'positive' : 'negative';
        const pnlDisplay = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(2);
        const status = pos.option_days_to_expiry != null
          ? (pos.option_days_to_expiry <= 0 ? '🔴 Expired' : pos.option_days_to_expiry <= 3 ? '⚠️ Expiring Soon' : '⏳ Open')
          : '⏳ Open';
        const dteColor = pos.option_days_to_expiry != null && pos.option_days_to_expiry <= 3
          ? 'color:var(--red, #f44336);font-weight:700' : '';

        html += '<tr>';
        html += `<td><strong>${Utils.esc(pos.ticker)}</strong></td>`;
        html += `<td>$${Utils.esc(String(strike))}</td>`;
        html += `<td style="font-size:0.8rem">${Utils.esc(String(expiry))}</td>`;
        html += `<td style="${dteColor}">${dte}</td>`;
        html += `<td style="font-weight:600">${premiumPaid}</td>`;
        html += `<td style="font-weight:600">${currentPrem}</td>`;
        html += `<td class="${pnlCls}" style="font-weight:700">${pnlDisplay}</td>`;
        html += `<td>${status}</td>`;
        html += '</tr>';
      });

      html += '</tbody></table></div>';
    }

    html += '</div>';
    return html;
  },

  _renderPremiumCard(items, type, icon, title, color) {
    if (!items.length) return '';
    const sorted = [...items].sort((a, b) => (b.premium || 0) - (a.premium || 0));
    const top = sorted.slice(0, 3);
    const maxPrem = Math.max(...top.map(o => o.premium || 0), 1);

    let html = `<div class="card" style="flex:1;min-width:200px">`;
    html += `<div class="card-title" style="font-size:0.85rem;color:${color}">${icon} ${title}</div>`;
    top.forEach((o, i) => {
      const pct = ((o.premium || 0) / maxPrem * 100).toFixed(0);
      const premiumStr = o.premium >= 1000000
        ? '$' + (o.premium / 1000000).toFixed(1) + 'M'
        : o.premium >= 1000
          ? '$' + (o.premium / 1000).toFixed(0) + 'K'
          : '$' + o.premium.toFixed(0);
      html += `<div style="margin-top:${i > 0 ? '8px' : '0'}">`;
      html += `<div style="display:flex;justify-content:space-between;font-size:0.82rem">`;
      html += `<span><strong>${Utils.esc(o.ticker)}</strong> $${Utils.esc(o.strike)}</span>`;
      html += `<span style="font-weight:600;color:${color}">${premiumStr}</span>`;
      html += '</div>';
      html += `<div style="height:4px;background:var(--bg-inset);border-radius:2px;margin-top:3px;overflow:hidden">`;
      html += `<div style="width:${pct}%;height:100%;background:${color};border-radius:2px;opacity:0.7"></div>`;
      html += '</div></div>';
    });
    html += '</div>';
    return html;
  }
};
