/**
 * Utility functions for rendering market data.
 */

const Utils = {
  /** Format number with commas and decimals */
  formatPrice(val, decimals = 2) {
    if (val == null || isNaN(val)) return '—';
    return Number(val).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  },

  /** Format percentage change */
  formatPct(val) {
    if (val == null || isNaN(val)) return '—';
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  },

  /** CSS class for positive/negative */
  changeClass(val) {
    if (val == null || val === 0) return '';
    return val > 0 ? 'positive' : 'negative';
  },

  /** Badge HTML for a score */
  scoreBadge(score) {
    if (score == null) return '';
    if (score >= 7) return `<span class="badge badge-green">${score}</span>`;
    if (score >= 5) return `<span class="badge badge-yellow">${score}</span>`;
    return `<span class="badge badge-red">${score}</span>`;
  },

  /** Safe JSON fetch with error handling */
  async fetchJSON(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`Failed to fetch ${url}:`, err);
      return null;
    }
  },

  /**
   * renderMarkdown(text)
   * Converts the AI-generated markdown narrative into clean HTML.
   * Handles the specific patterns produced by the Pi briefing agent:
   *   **🔷 SECTION HEADER**  → styled <h3> with emoji
   *   **bold text**           → <strong>
   *   • bullet line           → <li> inside <ul>
   *   blank line              → paragraph break
   *
   * Does NOT use any external libraries — pure regex transforms.
   */
  renderMarkdown(text) {
    if (!text) return '';

    // Normalise line endings
    let t = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split into lines for processing
    const lines = t.split('\n');
    const out = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // ── Section headers: **[emoji] HEADING** or **[emoji] HEADING**
      const headerMatch = line.match(/^\*{1,2}\s*([\p{Emoji}\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}]?\s*[A-Z][A-Z\s\/\-&()0-9]*)\*{1,2}\s*$/u);
      if (headerMatch) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(`<h3 class="intel-header">${headerMatch[1].trim()}</h3>`);
        continue;
      }

      // ── Bullet lines: start with •, -, *, or – 
      const bulletMatch = line.match(/^[•\-\*–]\s+(.+)/);
      if (bulletMatch) {
        if (!inList) { out.push('<ul class="intel-list">'); inList = true; }
        const content = Utils._inlineBold(bulletMatch[1]);
        out.push(`<li>${content}</li>`);
        continue;
      }

      // ── Close list on non-bullet line
      if (inList && line.trim() !== '') {
        out.push('</ul>');
        inList = false;
      }

      // ── Empty line → paragraph spacer
      if (line.trim() === '') {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push('<div class="intel-spacer"></div>');
        continue;
      }

      // ── Regular paragraph line
      const content = Utils._inlineBold(line);
      out.push(`<p class="intel-para">${content}</p>`);
    }

    if (inList) out.push('</ul>');

    return out.join('\n');
  },

  /** Convert **bold** and *italic* inline markers to HTML */
  _inlineBold(text) {
    // **bold** → <strong>
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // *italic* (single asterisk, not already consumed)
    text = text.replace(/\*([^*\s][^*]*[^*\s]|\S)\*/g, '<em>$1</em>');
    return text;
  },

  /** Render markdown tables to HTML (simple regex-based) */
  renderTable(markdown) {
    if (!markdown) return '';
    let html = markdown;
    const tableRegex = /\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/g;
    html = html.replace(tableRegex, (match, headerLine, bodyLines) => {
      const headers = headerLine.split('|').map(h => h.trim()).filter(Boolean);
      const rows = bodyLines.trim().split('\n').map(line =>
        line.split('|').map(c => c.trim()).filter(Boolean)
      );
      let table = '<table><thead><tr>';
      headers.forEach(h => { table += `<th>${h}</th>`; });
      table += '</tr></thead><tbody>';
      rows.forEach(row => {
        table += '<tr>';
        row.forEach(c => { table += `<td>${c}</td>`; });
        table += '</tr>';
      });
      table += '</tbody></table>';
      return table;
    });
    return html;
  }
};
