/**
 * Dashboard — Main overview page rendering.
 */
const Dashboard = {
  async render(app) {
    app.innerHTML = '<div class="loading">Loading market data...</div>';

    const data = await State.get('latest', '/data/latest.json');
    if (!data) {
      app.innerHTML = '<div class="error-card">Failed to load market data. The morning briefing may not have run yet.</div>';
      return;
    }

    let html = '';

    // Stale data warning
    if (State.isStale(data.generated_at)) {
      html += '<div class="stale-banner">⚠ Data from ' + new Date(data.generated_at).toLocaleTimeString() + ' — may be stale</div>';
    }

    // Market indices
    if (data.market_summary?.indices) {
      html += '<div class="section"><h2 class="section-title">Market Indices</h2><div class="grid-4">';
      data.market_summary.indices.forEach(idx => {
        const cls = Utils.changeClass(idx.change_pct);
        html += `<div class="card index-card">
          <div class="index-ticker">${idx.ticker}</div>
          <div class="index-price">${Utils.formatPrice(idx.price)}</div>
          <div class="index-change ${cls}">${Utils.formatPct(idx.change_pct)}</div>
        </div>`;
      });
      html += '</div></div>';
    }

    // VIX + Yield + Breadth
    if (data.market_summary) {
      const ms = data.market_summary;
      html += '<div class="section"><h2 class="section-title">Market Conditions</h2><div class="grid-3">';
      if (ms.vix != null) html += `<div class="card"><div class="card-title">VIX</div><div class="index-price">${Utils.formatPrice(ms.vix)}</div></div>`;
      if (ms.ten_year_yield != null) html += `<div class="card"><div class="card-title">10Y Yield</div><div class="index-price">${ms.ten_year_yield}%</div></div>`;
      if (ms.market_breadth) {
        const br = ms.market_breadth;
        html += `<div class="card"><div class="card-title">Breadth</div>
          <div><span class="badge badge-green">${br.advancers} A</span> <span class="badge badge-red">${br.decliners} D</span>
          <div style="margin-top:8px;color:var(--text-secondary);font-size:0.9rem">A/D: ${br.advance_decline_ratio?.toFixed(2)}</div></div></div>`;
      }
      html += '</div></div>';
    }

    // Narrative
    if (data.narrative) {
      const n = data.narrative;
      html += '<div class="section"><div class="card narrative-card">';
      if (n.headline) html += `<div class="narrative-headline">${n.headline}</div>`;
      if (n.summary_paragraph) html += `<div class="narrative-body">${n.summary_paragraph}</div>`;
      if (n.key_levels) {
        html += '<div class="key-levels" style="margin-top:16px">';
        for (const [key, val] of Object.entries(n.key_levels)) {
          const label = key.replace('_', ' ').toUpperCase();
          html += `<div class="key-level-item"><span class="key-level-label">${label}</span><span class="key-level-value">${Utils.formatPrice(val)}</span></div>`;
        }
        html += '</div>';
      }
      if (n.sectors) {
        html += '<div style="margin-top:16px;display:flex;gap:24px">';
        if (n.sectors.leading?.length) html += `<div><span class="badge badge-green">Leading</span> ${n.sectors.leading.join(', ')}</div>`;
        if (n.sectors.lagging?.length) html += `<div><span class="badge badge-red">Lagging</span> ${n.sectors.lagging.join(', ')}</div>`;
        html += '</div>';
      }
      html += '</div></div>';
    }

    // Economic calendar
    if (data.economic_calendar?.length) {
      html += '<div class="section"><h2 class="section-title">Economic Calendar</h2><div class="card table-wrap"><table><thead><tr><th>Time</th><th>Event</th><th>Forecast</th><th>Previous</th><th>Impact</th></tr></thead><tbody>';
      data.economic_calendar.forEach(ev => {
        const impactBadge = ev.impact === 'high' ? '<span class="badge badge-red">High</span>' :
                            ev.impact === 'medium' ? '<span class="badge badge-yellow">Med</span>' :
                            '<span class="badge badge-green">Low</span>';
        html += `<tr><td>${ev.time}</td><td>${ev.event}</td><td>${ev.forecast || '—'}</td><td>${ev.previous || '—'}</td><td>${impactBadge}</td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }

    // Top movers
    if (data.top_movers?.length) {
      html += '<div class="section"><h2 class="section-title">Top Movers</h2><div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Change</th><th>Reason</th></tr></thead><tbody>';
      data.top_movers.forEach(m => {
        const cls = Utils.changeClass(m.change_pct);
        html += `<tr><td><a href="#/ticker/${m.ticker}" class="archive-date">${m.ticker}</a></td>
          <td class="${cls}">${Utils.formatPct(m.change_pct)}</td>
          <td style="color:var(--text-secondary)">${m.reason || ''}</td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }

    // Generated at timestamp
    if (data.generated_at) {
      html += `<div style="text-align:center;color:var(--text-muted);font-size:0.8rem;padding:16px">Generated ${new Date(data.generated_at).toLocaleString()}</div>`;
    }

    app.innerHTML = html;
  }
};
