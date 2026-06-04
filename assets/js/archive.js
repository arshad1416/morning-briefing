/**
 * Archive — Browse past briefings w/ modal detail view.
 * Hover effect: row highlights, pointer cursor, "Click to view" hint.
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
    html += '<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px">Click any row to view the full briefing for that day.</p>';
    html += '<div class="card table-wrap"><table class="archive-table"><thead><tr><th>Date</th><th>Time</th><th>Market Summary</th></tr></thead><tbody>';

    for (const date of dates) {
      const brief = await State.get(`archive:${date}`, `/data/archive/${date}.json`);
      const indices = brief?.market_summary?.indices || [];
      
      // Show S&P, Dow, NASDAQ, TSX compactly
      let summaryHtml = '';
      const core = indices.filter(i => ['S&P 500','Dow Jones','NASDAQ','TSX'].includes(i.ticker));
      if (core.length) {
        summaryHtml = core.map(i => {
          const cls = Utils.changeClass(i.change_pct);
          return `<span class="badge" style="font-size:0.75rem;margin:1px">${i.ticker}: ${Utils.formatPrice(i.price)} <span class="${cls}">${Utils.formatPct(i.change_pct)}</span></span>`;
        }).join('');
      }
      
      // Add VIX and 10Y as secondary
      const vix = brief?.market_summary?.vix;
      const y10 = brief?.market_summary?.ten_year_yield;
      if (vix) summaryHtml += ` <span class="badge" style="font-size:0.7rem">VIX ${vix}</span>`;
      if (y10) summaryHtml += ` <span class="badge" style="font-size:0.7rem">10Y ${y10}%</span>`;

      const timeStr = brief?.generated_at ? new Date(brief.generated_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—';
      
      html += `<tr class="archive-row" data-date="${date}" style="cursor:pointer">
        <td><strong>${date}</strong></td>
        <td style="color:var(--text-muted);font-size:0.8rem">${timeStr}</td>
        <td>${summaryHtml || '<span style="color:var(--text-muted)">No data</span>'}</td>
      </tr>`;
    }

    html += '</tbody></table></div></div>';

    // Modal
    html += '<div id="archive-modal" class="modal-overlay" style="display:none">';
    html += '  <div class="modal-content" style="max-width:700px"><span class="modal-close" id="archive-modal-close">&times;</span>';
    html += '    <div id="archive-modal-body" style="min-height:100px">Loading...</div>';
    html += '  </div>';
    html += '</div>';

    app.innerHTML = html;

    // Wire up row clicks (event delegation on table body)
    app.querySelector('.archive-table tbody').addEventListener('click', function(e) {
      const row = e.target.closest('.archive-row');
      if (row) {
        const date = row.dataset.date;
        if (date) Archive._showModal(date);
      }
    });

    // Wire up modal close
    const modal = document.getElementById('archive-modal');
    const closeBtn = document.getElementById('archive-modal-close');
    if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) Archive._closeModal(); });
    if (closeBtn) closeBtn.addEventListener('click', Archive._closeModal);
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

    // Render full dashboard-style briefing in modal
    State._cache['modal_detail'] = data;
    // Build a compact briefing view
    let html = `<div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
      <h3 style="margin:0;font-size:1.1rem">Briefing: ${date}</h3>
      <span style="font-size:0.75rem;color:var(--text-muted)">${data.generated_at ? new Date(data.generated_at).toLocaleString() : ''}</span>
    </div>`;

    // Core indices
    const indices = data.market_summary?.indices || [];
    if (indices.length) {
      html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">';
      indices.forEach(i => {
        const cls = Utils.changeClass(i.change_pct);
        html += `<div class="card" style="padding:8px 12px;text-align:center;min-width:80px">
          <div style="font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase">${i.ticker}</div>
          <div style="font-size:0.9rem;font-weight:700">${Utils.formatPrice(i.price)}</div>
          <div class="${cls}" style="font-size:0.75rem">${Utils.formatPct(i.change_pct)}</div>
        </div>`;
      });
      html += '</div>';
    }

    // Narrative
    if (data.narrative?.summary_paragraph) {
      html += `<div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6;margin-bottom:12px;padding:12px;background:var(--bg-inset);border-radius:var(--radius-sm)">${data.narrative.summary_paragraph}</div>`;
    }

    body.innerHTML = html;
  },

  _closeModal() {
    const modal = document.getElementById('archive-modal');
    if (modal) modal.style.display = 'none';
  }
};
