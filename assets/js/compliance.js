/**
 * Compliance — standing disclosures for the non-tailored-advice exemption.
 *
 * 1. IBKR position disclosure: whenever a view discusses a security the site
 *    operator holds in the IBKR account, surface a disclosure banner. Holdings
 *    come from /data/ibkr_positions.json — the same feed the "IBKR Real
 *    Portfolio" tab reads (published daily by the portfolio agent). If the
 *    feed is absent or empty, no banner renders.
 * 2. Simulated-portfolio labels: every paper-trading-sim view must carry
 *    "Simulated portfolio — not a recommendation."
 */
const Compliance = {
  _heldPromise: null,

  /** Set of tickers currently held in the operator's IBKR account. */
  heldTickers() {
    if (!this._heldPromise) {
      this._heldPromise = Utils.fetchJSON('/data/ibkr_positions.json').then(data => {
        const list = (data?.positions || [])
          .map(p => String(p.ticker || p.symbol || '').toUpperCase().trim())
          .filter(Boolean);
        return new Set(list);
      }).catch(() => new Set());
    }
    return this._heldPromise;
  },

  /**
   * Banner disclosing operator positions among the tickers a view discusses.
   * Returns '' when nothing overlaps (or holdings feed unavailable).
   */
  async positionDisclosureHTML(tickers) {
    // DISABLED 2026-07-13: the IBKR account feeding ibkr_positions.json is a
    // PAPER (simulated) account — no real money exists. Rendering \"the site
    // operator currently holds a position in X\" would be a false statement.
    // Re-enable only if a real-money account ever replaces the paper feed.
    return '';
    /* eslint-disable no-unreachable */
    const held = await this.heldTickers();
    if (!held.size) return '';
    const seen = new Set();
    const hits = [];
    (tickers || []).forEach(t => {
      const up = String(t || '').toUpperCase().trim();
      if (up && held.has(up) && !seen.has(up)) { seen.add(up); hits.push(up); }
    });
    if (!hits.length) return '';
    return '<div class="disclosure-banner" style="margin:4px 0 12px 0;padding:8px 12px;background:var(--yellow-bg,rgba(255,193,7,0.08));border:1px solid var(--yellow-border,rgba(255,193,7,0.35));border-radius:6px;font-size:0.8rem;line-height:1.5;color:var(--text-secondary)">'
      + '📌 <strong style="color:var(--text-primary)">Position disclosure:</strong> the site operator currently holds a position in '
      + '<strong>' + hits.map(t => Utils.esc(t)).join(', ') + '</strong> (Interactive Brokers). '
      + 'Coverage of these securities is general information only — not a recommendation.'
      + '</div>';
    /* eslint-enable no-unreachable */
  },

  /** Full-width banner for paper-trading / simulated portfolio views. */
  simLabel() {
    return '<div class="sim-label-banner" style="margin:4px 0 12px 0;padding:8px 12px;background:var(--bg-inset);border:1px dashed var(--border-dim);border-radius:6px;font-size:0.8rem;line-height:1.5;color:var(--text-secondary)">'
      + '🧪 <strong style="color:var(--text-primary)">Simulated portfolio — not a recommendation.</strong> '
      + 'Paper-trading results with no real money. Shown for transparency about how the models perform, not as advice to trade any security.'
      + '</div>';
  },

  /** Compact inline badge for section titles that show simulated data. */
  simBadge() {
    return '<span class="sim-badge" style="display:inline-block;margin-left:8px;padding:1px 7px;border-radius:4px;background:var(--bg-inset);border:1px solid var(--border-dim);color:var(--text-muted);font-size:0.6rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;vertical-align:middle">Simulated — not a recommendation</span>';
  }
};
