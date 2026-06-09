/**
 * Archive — Browse past briefings with consistent formatted view.
 * Each briefing rendered as a structured card showing indices, conditions, and narrative.
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
    html += '<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px">Click any briefing to view the full report.</p>';

    for (const date of dates) {
      const brief = await State.get(`archive:${date}`, `/data/archive/${date}.json`);
      if (!brief) continue;

      // Extract core market data
      const indices = brief.market_summary?.indices || [];
      const coreTickers = ['S&P 500', 'Dow Jones', 'NASDAQ', 'TSX'];
      const core = indices.filter(i => coreTickers.includes(i.ticker));
      const vix = brief.market_summary?.vix;
      const y10 = brief.market_summary?.ten_year_yield;
      const fx = (brief.market_summary?.fx_rates || []).filter(f => f.price > 0);
      const timeStr = brief.generated_at ? new Date(brief.generated_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' }) : '—';

      // Build index badges
      let badgeHtml = '';
      core.forEach(i => {
        const cls = Utils.changeClass(i.change_pct);
        badgeHtml += `<span class="badge ${cls}" style="margin:1px;font-size:0.7rem">${i.ticker}: ${Utils.formatPrice(i.price)} (${Utils.formatPct(i.change_pct)})</span>`;
      });

      // VIX + 10Y badge
      if (vix) badgeHtml += `<span class="badge" style="margin:1px;font-size:0.7rem">VIX: ${vix}</span>`;
      if (y10) badgeHtml += `<span class="badge" style="margin:1px;font-size:0.7rem">10Y: ${y10}%</span>`;

      // FX badge
      fx.forEach(f => {
        badgeHtml += `<span class="badge" style="margin:1px;font-size:0.7rem">${f.pair}: ${f.price}</span>`;
      });

      // Narrative preview (first 150 chars)
      let preview = '';
      const narr = brief.narrative || '';
      if (typeof narr === 'string' && narr.length > 20) {
        preview = narr.replace(/\*\*/g, '').replace(/[•●]/g, '').substring(0, 150).trim();
        if (narr.length > 150) preview += '...';
      } else if (narr.summary_paragraph) {
        preview = narr.summary_paragraph.substring(0, 150).trim();
        if (narr.summary_paragraph.length > 150) preview += '...';
      }

      html += `<div class="archive-row" data-date="${date}" style="cursor:pointer;margin-bottom:12px">`;
      html +=   `<div class="card" style="padding:14px 18px">`;
      html +=     `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px">`;
      html +=       `<strong style="font-size:0.95rem">${date}</strong>`;
      html +=       `<span style="font-size:0.75rem;color:var(--text-muted)">${timeStr}</span>`;
      html +=     `</div>`;
      if (badgeHtml) {
        html += `<div style="margin-bottom:6px">${badgeHtml}</div>`;
      }
      if (preview) {
        html += `<div style="font-size:0.8rem;color:var(--text-secondary);line-height:1.4">${Utils.esc(preview)}</div>`;
      }
      html +=   `</div>`;
      html += `</div>`;
    }

    html += '</div>';

    // Modal
    html += '<div id="archive-modal" class="modal-overlay" style="display:none">';
    html += '  <div class="modal-content" style="max-width:750px"><span class="modal-close" id="archive-modal-close">&times;</span>';
    html += '    <div id="archive-modal-body" style="min-height:100px">Loading...</div>';
    html += '  </div>';
    html += '</div>';

    app.innerHTML = html;

    // Wire up card clicks
    app.querySelectorAll('.archive-row').forEach(row => {
      row.addEventListener('click', function() {
        const date = this.dataset.date;
        if (date) Archive._showModal(date);
      });
    });

    // Modal close
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

    let html = '<div style="margin-bottom:16px">';
    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">';
    html += '<h3 style="margin:0;font-size:1.1rem;color:var(--text-primary)">Morning Briefing — ' + date + '</h3>';
    html += '<span style="font-size:0.75rem;color:var(--text-muted)">' + (data.generated_at ? new Date(data.generated_at).toLocaleString() : '') + '</span></div>';

    // ── MARKET SNAPSHOT ──
    const ms = data.market_summary || {};
    const indices = ms.indices || [];
    const vix = ms.vix;
    const y10 = ms.ten_year_yield;
    const fx = (ms.fx_rates || []).filter(f => f.price > 0);

    if (indices.length || vix || y10 || fx.length) {
      html += '<div style="font-weight:600;font-size:0.8rem;color:var(--accent);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px">Market Snapshot</div>';
      html += '<div class="grid-4" style="margin-bottom:16px">';

      // Core indices
      const coreTickers = ['S&P 500', 'Dow Jones', 'NASDAQ', 'TSX'];
      coreTickers.forEach(t => {
        const idx = indices.find(i => i.ticker === t);
        if (idx) {
          const cls = Utils.changeClass(idx.change_pct);
          html += `<div class="card" style="text-align:center;padding:10px">
            <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase">${idx.ticker}</div>
            <div style="font-size:1.2rem;font-weight:700">${Utils.formatPrice(idx.price)}</div>
            <div style="font-size:0.75rem;${cls === 'positive' ? 'color:var(--green)' : 'color:var(--red)'}">${Utils.formatPct(idx.change_pct)}</div>
          </div>`;
        }
      });

      html += '</div>';

      // Conditions row
      html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">';
      if (vix) html += `<div class="card" style="padding:8px 14px;text-align:center"><div style="font-size:0.65rem;color:var(--text-muted)">VIX</div><div style="font-size:1.1rem;font-weight:700">${vix}</div></div>`;
      if (y10) html += `<div class="card" style="padding:8px 14px;text-align:center"><div style="font-size:0.65rem;color:var(--text-muted)">10Y Yield</div><div style="font-size:1.1rem;font-weight:700">${y10}%</div></div>`;
      fx.forEach(f => {
        html += `<div class="card" style="padding:8px 14px;text-align:center"><div style="font-size:0.65rem;color:var(--text-muted)">${f.pair}</div><div style="font-size:1.1rem;font-weight:700">${f.price}</div></div>`;
      });
      html += '</div>';
    }

    // ── NARRATIVE ──
    const narrative = data.narrative || '';
    if (typeof narrative === 'string' && narrative.length > 20) {
      // Rich markdown narrative
      html += '<div style="font-weight:600;font-size:0.8rem;color:var(--accent);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px">Briefing</div>';
      let converted = narrative
        .replace(/### /g, '</div><div style="font-size:0.9rem;font-weight:600;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--border-dim);color:var(--text-primary)">')
        .replace(/## /g, '</div><div style="font-size:1rem;font-weight:700;margin:18px 0 8px;color:var(--accent)">')
        .replace(/# /g, '</div><div style="font-size:1.1rem;font-weight:700;margin:20px 0 10px;color:var(--accent)">')
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>')
        .replace(/\n• /g, '\n<span style="display:block;padding:2px 0 2px 14px">• </span>')
        .replace(/\n\n/g, '</div><div style="margin:8px 0;line-height:1.7;color:var(--text-secondary);font-size:0.85rem">')
        .replace(/\n/g, '<br>');
      html += '<div class="card" style="padding:20px;font-size:0.85rem;line-height:1.7;color:var(--text-secondary)">';
      html += '<div style="margin:0;line-height:1.7;color:var(--text-secondary);font-size:0.85rem">' + converted + '</div>';
      html += '</div>';
    } else if (narrative.summary_paragraph) {
      // Short portfolio narrative
      html += '<div style="font-weight:600;font-size:0.8rem;color:var(--accent);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px">Portfolio Analysis</div>';
      html += '<div class="card" style="padding:16px;font-size:0.85rem;line-height:1.6;color:var(--text-secondary)">' + narrative.summary_paragraph + '</div>';
    }

    body.innerHTML = html;
  },

  _closeModal() {
    const modal = document.getElementById('archive-modal');
    if (modal) modal.style.display = 'none';
  }
};
