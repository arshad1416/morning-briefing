/**
 * Archive — Browse past briefings.
 */
const Archive = {
  async render(app) {
    app.innerHTML = '<div class="loading">Loading archive...</div>';

    const index = await State.get('archive-index', '/data/archive-index.json');
    if (!index || !Array.isArray(index.dates)) {
      app.innerHTML = '<div class="error-card">Failed to load archive index.</div>';
      return;
    }

    const dates = index.dates;
    let html = '<div class="section"><h2 class="section-title">Morning Briefing Archive</h2>';
    html += '<div class="card table-wrap"><table><thead><tr><th>Date</th><th>Generated</th><th>Indices</th></tr></thead><tbody>';

    for (const date of dates) {
      // Lazy-load each archive row summary from the individual file
      const brief = await State.get(`archive:${date}`, `/data/archive/${date}.json`);

      // Core stock indices only — filter out bond yields and noise
      const coreTickers = ['S&P 500', 'Dow Jones', 'NASDAQ', 'TSX'];
      const allIndices = brief?.market_summary?.indices || [];
      const core = allIndices.filter(i => coreTickers.includes(i.ticker));

      let indicesHtml = '—';
      if (core.length) {
        indicesHtml = core.map(i => {
          const cls = Utils.changeClass(i.change_pct);
          return `<span class="badge" style="font-size:0.8rem;margin:1px 2px">${i.ticker}: ${Utils.formatPrice(i.price)} <span class="${cls}">${Utils.formatPct(i.change_pct)}</span></span>`;
        }).join('');
      }

      // Compact secondary indicators
      let meta = '';
      const vix = brief?.market_summary?.vix;
      const y10 = brief?.market_summary?.ten_year_yield;
      if (vix != null) meta += `VIX ${vix} `;
      if (y10 != null) meta += `10Y ${y10}%`;

      html += `<tr>
        <td><a href="#/archive/${date}" class="archive-date">${date}</a></td>
        <td style="color:var(--text-muted);font-size:0.8rem">${brief?.generated_at ? new Date(brief.generated_at).toLocaleTimeString() : '—'}</td>
        <td>${indicesHtml}${meta ? `<div style="color:var(--text-muted);font-size:0.75rem;margin-top:3px">${meta}</div>` : ''}</td>
      </tr>`;
    }

    html += '</tbody></table></div></div>';
    app.innerHTML = html;
  },

  /** Render a single archived briefing */
  async renderDate(app, params) {
    const date = params?.date;
    if (!date) {
      app.innerHTML = '<div class="error-card">No date specified.</div>';
      return;
    }

    app.innerHTML = '<div class="loading">Loading briefing...</div>';
    const data = await State.get(`archive:${date}`, `/data/archive/${date}.json`);

    if (!data) {
      app.innerHTML = `<div class="error-card">Briefing for ${date} not found.</div>`;
      return;
    }

    // Reuse dashboard rendering with the archived data
    // Store data temporarily in State for Dashboard renderer
    State._cache['archive_detail'] = data;
    Dashboard.renderWithData(app, data, `Archive: ${date}`);
  }
};
