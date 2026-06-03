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

  /** Render markdown tables to HTML (simple regex-based) */
  renderTable(markdown) {
    if (!markdown) return '';
    // Match markdown tables: header | separator | rows
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
