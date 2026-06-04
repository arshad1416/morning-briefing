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
      
      // Try market_summary indices first, fall back to parsing narrative
      let summaryHtml = '';
      let coreTickers = ['S&P 500', 'Dow Jones', 'NASDAQ', 'TSX'];
      let indices = brief?.market_summary?.indices || [];
      
      if (indices.length) {
        var core = indices.filter(i => coreTickers.includes(i.ticker));
        if (core.length) {
          summaryHtml = core.map(i => {
            var cls = Utils.changeClass(i.change_pct);
            return `<span class="badge" style="font-size:0.75rem;margin:1px">${i.ticker}: ${Utils.formatPrice(i.price)} <span class="${cls}">${Utils.formatPct(i.change_pct)}</span></span>`;
          }).join('');
        }
      }
      
      // Fall back to parsing key data from narrative
      if (!summaryHtml) {
        var narr = brief?.narrative || '';
        if (typeof narr === 'string') {
          // Extract S&P, Dow, NASDAQ, TSX from markdown
          var spMatch = narr.match(/S&amp;P 500[:\s]+([0-9,]+\.?\d*)/);
          var dowMatch = narr.match(/Dow Jones[:\s]+([0-9,]+\.?\d*)/);
          var nasMatch = narr.match(/NASDAQ[:\s]+([0-9,]+\.?\d*)/);
          var tsxMatch = narr.match(/TSX[:\s]+([0-9,]+\.?\d*)/);
          if (spMatch) summaryHtml += '<span class="badge" style="font-size:0.75rem;margin:1px">S&P: ' + spMatch[1] + '</span>';
          if (dowMatch) summaryHtml += '<span class="badge" style="font-size:0.75rem;margin:1px">DOW: ' + dowMatch[1] + '</span>';
          if (nasMatch) summaryHtml += '<span class="badge" style="font-size:0.75rem;margin:1px">NAS: ' + nasMatch[1] + '</span>';
          if (tsxMatch) summaryHtml += '<span class="badge" style="font-size:0.75rem;margin:1px">TSX: ' + tsxMatch[1] + '</span>';
          
          // VIX from narrative
          var vixMatch = narr.match(/VIX[:\s]+([0-9]+\.?\d*)/);
          if (vixMatch) summaryHtml += ' <span class="badge" style="font-size:0.7rem">VIX ' + vixMatch[1] + '</span>';
        }
      }
      
      // VIX/10Y from market_summary fields
      if (!summaryHtml) {
        var vix = brief?.market_summary?.vix;
        var y10 = brief?.market_summary?.ten_year_yield;
        if (vix) summaryHtml += '<span class="badge" style="font-size:0.7rem">VIX ' + vix + '</span>';
        if (y10) summaryHtml += '<span class="badge" style="font-size:0.7rem">10Y ' + y10 + '%</span>';
      }

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
    // Build full briefing view from emailed content
    let html = '<div style="margin-bottom:16px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
    html += '<h3 style="margin:0;font-size:1.1rem;color:var(--text-primary)">Morning Briefing: ' + date + '</h3>';
    html += '<span style="font-size:0.75rem;color:var(--text-muted)">' + (data.generated_at ? new Date(data.generated_at).toLocaleString() : '') + '</span></div>';

    // Core indices as a proper grid
    var indices = data.market_summary?.indices || [];
    if (indices.length) {
      html += '<div class="key-levels" style="margin-bottom:16px">';
      indices.forEach(function(i) {
        var cls = Utils.changeClass(i.change_pct);
        html += '<div class="key-level-item" style="padding:8px 12px">';
        html += '<span class="key-level-label" style="font-size:0.65rem">' + i.ticker + '</span>';
        html += '<span class="key-level-value" style="font-size:1rem">' + Utils.formatPrice(i.price) + '</span>';
        html += '<span class="' + cls + '" style="font-size:0.75rem">' + Utils.formatPct(i.change_pct) + '</span></div>';
      });
      html += '</div>';
    }

    // Render the emailed narrative as formatted HTML
    var narrative = data.narrative || '';
    if (typeof narrative === 'string' && narrative.length > 20) {
      // Convert markdown to clean HTML with proper table handling
      var converted = narrative
        // Convert markdown tables first (before other replacements)
        .replace(/\|(.+)\|/g, function(match) {
          if (match.includes('---')) return '<tr style="border:none"><td colspan="10" style="border-bottom:1px solid var(--border-dim);padding:0"></td></tr>';
          var cells = match.split('|').filter(function(c) { return c.trim(); });
          var rowHtml = '<tr>';
          cells.forEach(function(c) {
            var trimmed = c.trim();
            var isHeader = trimmed.startsWith('**') && trimmed.endsWith('**');
            if (isHeader) {
              rowHtml += '<th style="text-align:left;padding:6px 8px;font-size:0.8rem;font-weight:600;color:var(--text-primary);border-bottom:1px solid var(--border-dim)">' + trimmed.replace(/\*\*/g,'') + '</th>';
            } else {
              rowHtml += '<td style="text-align:left;padding:6px 8px;font-size:0.8rem;color:var(--text-secondary);border-bottom:1px solid var(--border-dim)">' + trimmed + '</td>';
            }
          });
          return rowHtml + '</tr>';
        })
        // Headers
        .replace(/### /g, '</div><div style="font-size:0.9rem;font-weight:600;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--border-dim);color:var(--text-primary)">')
        .replace(/## /g, '</div><div style="font-size:1rem;font-weight:700;margin:18px 0 8px;color:var(--accent)">')
        .replace(/# /g, '</div><div style="font-size:1.1rem;font-weight:700;margin:20px 0 10px;color:var(--accent)">')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>')
        // Lists
        .replace(/\n\* /g, '\n<span style="display:block;padding:2px 0 2px 16px;position:relative">• </span><span style="display:inline">')
        .replace(/\n• /g, '\n<span style="display:block;padding:2px 0 2px 16px;position:relative">• </span><span style="display:inline">')
        // Line breaks
        .replace(/\n\n/g, '</span></div><div style="margin:8px 0;line-height:1.7;color:var(--text-secondary);font-size:0.85rem">')
        .replace(/\n/g, '<br>');
      
      // Wrap in styled container
      html += '<div class="card" style="padding:20px;font-size:0.85rem;line-height:1.7;color:var(--text-secondary)">';
      html += '<div style="margin:0;line-height:1.7;color:var(--text-secondary);font-size:0.85rem">' + converted + '</div>';
      html += '</div>';
    } else if (narrative && narrative.summary_paragraph) {
      html += '<div class="card" style="margin-top:8px;padding:16px;font-size:0.85rem;line-height:1.6;color:var(--text-secondary)">' + narrative.summary_paragraph + '</div>';
    }

    body.innerHTML = html;
  },

  _closeModal() {
    const modal = document.getElementById('archive-modal');
    if (modal) modal.style.display = 'none';
  }
};
