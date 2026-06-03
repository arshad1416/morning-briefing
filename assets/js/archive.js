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

      let indices = '—';
      if (brief?.market_summary?.indices) {
        indices = brief.market_summary.indices.map(i =>
          `${i.ticker}: ${Utils.formatPrice(i.price)} (${Utils.formatPct(i.change_pct)})`
        ).join(' | ');
      }

      html += `<tr>
        <td><a href="#/archive/${date}" class="archive-date">${date}</a></td>
        <td style="color:var(--text-muted);font-size:0.85rem">${brief?.generated_at ? new Date(brief.generated_at).toLocaleTimeString() : '—'}</td>
        <td style="color:var(--text-secondary);font-size:0.85rem">${indices}</td>
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
