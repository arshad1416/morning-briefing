/**
 * Archive — Browse past briefings with modal detail view.
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
      const brief = await State.get(`archive:${date}`, `/data/archive/${date}.json`);
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

      let meta = '';
      const vix = brief?.market_summary?.vix;
      const y10 = brief?.market_summary?.ten_year_yield;
      if (vix != null) meta += `VIX ${vix} `;
      if (y10 != null) meta += `10Y ${y10}%`;

      // Store data on click — modal instead of navigation
      const safeDate = date.replace(/'/g, "\\'");
      html += `<tr style="cursor:pointer" onclick="Archive._showModal('${safeDate}')">
        <td class="archive-date">${date}</td>
        <td style="color:var(--text-muted);font-size:0.8rem">${brief?.generated_at ? new Date(brief.generated_at).toLocaleTimeString() : '—'}</td>
        <td>${indicesHtml}${meta ? `<div style="color:var(--text-muted);font-size:0.75rem;margin-top:3px">${meta}</div>` : ''}</td>
      </tr>`;
    }

    html += '</tbody></table></div></div>';

    // Modal container
    html += '<div id="archive-modal" class="modal-overlay" style="display:none" onclick="if(event.target===this)Archive._closeModal()">';
    html += '  <div class="modal-content"><span class="modal-close" onclick="Archive._closeModal()">&times;</span>';
    html += '    <div id="archive-modal-body">Loading...</div>';
    html += '  </div>';
    html += '</div>';

    app.innerHTML = html;
  },

  async _showModal(date) {
    const modal = document.getElementById('archive-modal');
    const body = document.getElementById('archive-modal-body');
    if (!modal || !body) return;

    modal.style.display = 'flex';
    body.innerHTML = '<div class="loading">Loading briefing...</div>';

    const data = await State.get(`archive:${date}`, `/data/archive/${date}.json`);
    if (!data) {
      body.innerHTML = '<div class="error-card">Briefing not found.</div>';
      return;
    }

    // Reuse dashboard rendering in the modal
    State._cache['modal_detail'] = data;
    Dashboard.renderWithData(body, data, `Briefing: ${date}`);
  },

  _closeModal() {
    const modal = document.getElementById('archive-modal');
    if (modal) modal.style.display = 'none';
  }
};
