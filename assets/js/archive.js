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

    const ms = data.market_summary || {};
    const indices = ms.indices || [];
    const fx = (ms.fx_rates || []).filter(f => f.price > 0);
    const vix = ms.vix;
    const y10 = ms.ten_year_yield;
    const dateObj = data.generated_at ? new Date(data.generated_at) : new Date();
    const dateStr = dateObj.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
    const weekday = dateObj.getDay();
    const marketStatus = (weekday >= 1 && weekday <= 5) ? '🟢 Markets Open' : '🔴 Markets Closed (Weekend)';

    // ── Market indices rows ──
    const indexMap = { 'S&P 500': 'S&P 500', 'Dow Jones': 'Dow Jones', 'NASDAQ': 'NASDAQ', 'TSX': 'TSX' };
    let marketRows = '';
    Object.values(indexMap).forEach(name => {
      const idx = indices.find(i => i.ticker === name);
      if (idx) {
        const cls = (idx.change_pct || 0) >= 0 ? 'up' : 'down';
        const arrow = (idx.change_pct || 0) >= 0 ? '&#9650;' : '&#9660;';
        const price = '$' + Number(idx.price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
        const chg = (idx.change_pct || 0).toFixed(2);
        marketRows += `<tr><td class="label">${name}</td><td class="value">${price}</td><td class="${cls}">${arrow} ${chg}%</td></tr>`;
      }
    });
    // FX as extra market rows
    fx.forEach(f => {
      const cls = (f.change_pct || 0) >= 0 ? 'up' : 'down';
      const price = f.price.toFixed(2);
      marketRows += `<tr><td class="label">${f.pair}</td><td class="value">${price}</td><td class="${cls}">—</td></tr>`;
    });
    if (vix) marketRows += `<tr><td class="label">VIX</td><td class="value">${vix}</td><td class="up">—</td></tr>`;
    if (y10) marketRows += `<tr><td class="label">10Y Yield</td><td class="value">${y10}%</td><td class="up">—</td></tr>`;

    // ── Narrative ──
    const narrative = data.narrative || '';
    let narrativeHtml = '';
    if (typeof narrative === 'string' && narrative.length > 20) {
      const clean = narrative
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n• /g, '<br>  • ')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
      narrativeHtml = '<div style="font-size:13px;line-height:1.7;color:#94a3b8;padding:0">' + clean + '</div>';
    } else if (narrative.summary_paragraph) {
      narrativeHtml = '<div style="font-size:13px;line-height:1.7;color:#94a3b8;padding:0">' + narrative.summary_paragraph + '</div>';
    }

    // ── Build full HTML matching email format ──
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    margin: 0;
    padding: 0;
  }
  .container {
    max-width: 620px;
    margin: 0 auto;
  }
  .header {
    text-align: center;
    padding: 24px 0 16px;
    border-bottom: 1px solid #1e293b;
  }
  .header h1 {
    font-size: 22px;
    margin: 0;
    color: #f8fafc;
    font-weight: 700;
  }
  .header .date {
    font-size: 13px;
    color: #64748b;
    margin-top: 4px;
  }
  .header .status {
    font-size: 12px;
    margin-top: 8px;
    padding: 4px 12px;
    display: inline-block;
    border-radius: 12px;
    background: #1e293b;
  }
  .section {
    background: #1e293b;
    border-radius: 12px;
    padding: 20px;
    margin: 16px 0;
  }
  .section h2 {
    font-size: 16px;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #334155;
  }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th {
    text-align: left;
    padding: 6px 8px;
    color: #64748b;
    font-weight: 500;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #334155;
  }
  td { padding: 6px 8px; border-bottom: 1px solid #1e293b; }
  tr:last-child td { border-bottom: none; }
  td.label { color: #94a3b8; }
  td.value { font-weight: 600; color: #f8fafc; }
  .up { color: #22c55e; }
  .down { color: #ef4444; }
  .footer {
    text-align: center;
    padding: 16px 0 20px;
    font-size: 11px;
    color: #475569;
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>📈 Daily Briefing</h1>
    <div class="date">${dateStr}</div>
    <div class="status">${marketStatus}</div>
  </div>

  <div class="section">
    <h2>Markets</h2>
    <table>
      <tr><th>Index</th><th>Value</th><th>Change</th></tr>
      ${marketRows}
    </table>
  </div>

  ${narrativeHtml ? `<div class="section">${narrativeHtml}</div>` : ''}

  <div class="footer">
    Generated by Hermes Agent &bull; Data from Yahoo Finance &bull; Not financial advice
  </div>
</div>
</body>
</html>`;

    body.innerHTML = fullHtml;
  },

  _closeModal() {
    const modal = document.getElementById('archive-modal');
    if (modal) modal.style.display = 'none';
  }
};
