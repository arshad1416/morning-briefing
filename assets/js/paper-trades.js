/**
 * Paper Trades — Live open positions, strategy performance, backtest accuracy.
 * Shows V1-V100 backtest results with live trade tracking.
 * Includes clickable strategy names with explanation modals.
 * + IBKR Real Portfolio tab alongside the paper trading tab.
 */
const PaperTrades = {
  // Strategy explanations in plain English
  _strategyHelp: {
    'mean_reversion': {
      name: 'Mean Reversion',
      emoji: '🔄',
      what: 'Buying when a stock drops too far, too fast — expecting it to bounce back up.',
      when: 'Works best when the market is calm (VIX between 12-22) and the overall trend is up.',
      why: 'Stocks that fall sharply on low volume tend to snap back to their average price within 21 days.',
      risk: 'The stock could keep falling if the market enters a true downtrend or a crisis hits.',
      backtest: 'Our best-tested version (V23) wins 74% of trades with an average gain of +4.67%.',
      example: 'If SPY drops from $760 to $740 on light volume while the overall market is healthy, Mean Reversion buys expecting it to recover toward $760.',
    },
    'sector_rotation': {
      name: 'Sector Rotation',
      emoji: '🔄',
      what: 'Moving money between different industry groups (tech, energy, healthcare) to follow where the market is flowing.',
      when: 'Works in healthy bull markets where money rotates between sectors.',
      why: 'Different sectors perform better at different stages of the economic cycle.',
      risk: 'Can miss the big picture if you rotate out of a sector too early.',
      backtest: 'Tested across multiple versions. Best results in the V5+ tuning with 59% win rate.',
      example: 'If tech stocks have been rallying for months and energy starts showing strength, Sector Rotation sells some tech and buys energy.',
    },
    'value_investing': {
      name: 'Value Investing',
      emoji: '💎',
      what: 'Buying stocks that appear cheap compared to their true worth — like finding a $100 bill for $70.',
      when: 'Works in any market but especially when quality companies are temporarily out of favor.',
      why: 'Markets sometimes over-react to bad news, creating bargains that eventually correct.',
      risk: 'A stock can be "cheap" for a reason — it might stay cheap for years.',
      backtest: 'Not one of our primary backtest strategies. Pi is currently holding TD and EFA from earlier analysis.',
      example: 'A solid bank like TD trading at $155 when similar banks trade at $170 — you buy expecting the market to recognize its true value.',
    },
    'macro_hedge': {
      name: 'Macro Hedge',
      emoji: '🌍',
      what: 'Protecting the portfolio against big-picture economic risks like inflation, recession, or market crashes.',
      when: 'Used as insurance — always held in the background to offset losses during downturns.',
      why: 'Some assets (like long-term bonds) tend to rise when stocks fall, cushioning the portfolio.',
      risk: 'The hedge itself can lose money during bull markets (the insurance premium).',
      backtest: 'Long-term bonds as a hedge are well-established. TLT has historically risen during stock market stress.',
      example: 'Holding TLT (long-term Treasury bonds) alongside stocks. If the market crashes, bonds typically rally, offsetting some stock losses.',
    },
    'backtest-v23': {
      name: 'V23 — VIX-Filtered Mean Reversion',
      emoji: '📊',
      what: 'Our proven default strategy. Buys stocks when they are temporarily oversold, BUT only when fear levels are moderate (VIX above 12).',
      when: 'Active right now — VIX is 16.37, which is in the sweet spot.',
      why: 'After testing 100+ versions across 135,000 trades, this was the best all-around strategy: 74.3% win rate.',
      risk: 'Can miss entries when VIX is below 12 (complacency), but those trades historically underperform.',
      backtest: '74.3% win rate, +4.67% average gain, 5.10 profit factor over 25 years.',
      example: 'With VIX at 16 and SPY above its 200-day moving average, the system scans for stocks that dipped to extreme oversold levels and enters expecting a bounce.',
    },
    'v23-mr': {
      name: 'V23 — VIX-Filtered Mean Reversion',
      emoji: '📊',
      what: 'Our proven default strategy. Buys stocks when they are temporarily oversold, BUT only when fear levels are moderate (VIX above 12).',
      when: 'Active right now — VIX is 16.37, which is in the sweet spot.',
      why: 'After testing 100+ versions across 135,000 trades, this was the best all-around strategy: 74.3% win rate.',
      risk: 'Can miss entries when VIX is below 12 (complacency), but those trades historically underperform.',
      backtest: '74.3% win rate, +4.67% average gain, 5.10 profit factor over 25 years.',
      example: 'With VIX at 16 and SPY above its 200-day moving average, the system scans for stocks that dipped to extreme oversold levels and enters expecting a bounce.',
    },
    'v23_mr': {
      name: 'V23 — VIX-Filtered Mean Reversion',
      emoji: '📊',
      what: 'Our proven default strategy. Buys stocks when they are temporarily oversold, BUT only when fear levels are moderate (VIX above 12).',
      when: 'Active right now — VIX is 16.37, which is in the sweet spot.',
      why: 'After testing 100+ versions across 135,000 trades, this was the best all-around strategy: 74.3% win rate.',
      risk: 'Can miss entries when VIX is below 12 (complacency), but those trades historically underperform.',
      backtest: '74.3% win rate, +4.67% average gain, 5.10 profit factor over 25 years.',
      example: 'With VIX at 16 and SPY above its 200-day moving average, the system scans for stocks that dipped to extreme oversold levels and enters expecting a bounce.',
    },
  },

  /** Get explanation for any strategy name */
  _getStrategyInfo(key) {
    const cleanKey = (key || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    return this._strategyHelp[cleanKey] || this._strategyHelp[key] || null;
  },

  /** Render a strategy name as a clickable link */
  _strategyLink(strategy) {
    if (!strategy) return '—';
    const info = this._getStrategyInfo(strategy);
    if (!info) return strategy.replace(/_/g, ' ');
    return `<a href="#" class="strategy-link" data-strategy="${strategy}" style="color:var(--accent);text-decoration:underline;cursor:pointer">${strategy.replace(/_/g, ' ')}</a>`;
  },

  /** Show the strategy modal */
  _showModal(strategy) {
    const info = this._getStrategyInfo(strategy);
    if (!info) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
      position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);
      display:flex;align-items:center;justify-content:center;z-index:1000;
      padding:20px;animation:fadeIn 0.2s;
    `;

    const modal = document.createElement('div');
    modal.className = 'modal-content';
    modal.style.cssText = `
      background:var(--bg-card);border:1px solid var(--border-dim);
      border-radius:12px;padding:28px 32px;max-width:560px;width:100%;
      max-height:80vh;overflow-y:auto;position:relative;
      box-shadow:0 20px 60px rgba(0,0,0,0.5);
    `;

    modal.innerHTML = `
      <button class="modal-close" style="
        position:absolute;top:12px;right:16px;background:none;border:none;
        color:var(--text-muted);font-size:24px;cursor:pointer;padding:4px 8px;
        line-height:1;border-radius:4px;
      ">&times;</button>
      <div style="margin-bottom:16px">
        <span style="font-size:28px;margin-right:10px">${info.emoji}</span>
        <span style="font-size:1.3rem;font-weight:700;color:var(--text-primary)">${info.name}</span>
      </div>
      <div style="margin-bottom:14px">
        <div style="font-size:0.75rem;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">What It Is</div>
        <div style="font-size:0.9rem;color:var(--text-body);line-height:1.6">${info.what}</div>
      </div>
      <div style="margin-bottom:14px">
        <div style="font-size:0.75rem;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">When It Works</div>
        <div style="font-size:0.9rem;color:var(--text-body);line-height:1.6">${info.when}</div>
      </div>
      <div style="margin-bottom:14px">
        <div style="font-size:0.75rem;font-weight:700;color:var(--yellow);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Risk</div>
        <div style="font-size:0.9rem;color:var(--text-body);line-height:1.6">${info.risk}</div>
      </div>
      ${info.backtest ? `
      <div style="margin-bottom:14px;padding:12px;background:var(--green-bg);border:1px solid var(--green-border);border-radius:8px">
        <div style="font-size:0.75rem;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Backtest Results</div>
        <div style="font-size:0.85rem;color:var(--text-body);line-height:1.5">${info.backtest}</div>
      </div>` : ''}
      ${info.example ? `
      <div style="padding:12px;background:var(--bg-inset);border-radius:8px">
        <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Example</div>
        <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.5">${info.example}</div>
      </div>` : ''}
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close handlers
    const close = () => overlay.remove();
    modal.querySelector('.modal-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    // Close on Escape
    const escHandler = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }};
    document.addEventListener('keydown', escHandler);
  },

  /** Render IBKR portfolio data into the ibkr-content container */
  async _renderIBKR() {
    const container = document.getElementById('ibkr-content');
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading IBKR portfolio...</div>';

    const [account, positions, trades] = await Promise.all([
      Utils.fetchJSON('/data/ibkr_account.json').catch(() => null),
      Utils.fetchJSON('/data/ibkr_positions.json').catch(() => null),
      Utils.fetchJSON('/data/ibkr_trades.json').catch(() => null),
    ]);

    if (!account && !positions && !trades) {
      container.innerHTML = '<div class="card" style="text-align:center;padding:32px;color:var(--text-muted)">No IBKR data available yet. The portfolio agent runs daily at 07:12 ET.</div>';
      return;
    }

    let html = '';

    // ── Account Summary Card ──
    if (account?.accounts?.length) {
      const s = account.accounts[0].summary || {};
      const currency = s.currency || 'USD';
      html += '<div class="card" style="margin-bottom:16px">';
      html += '<div class="card-title">Account Summary (' + Utils.esc(currency) + ')</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">';
      const items = [
        { label: 'Net Liquidation', value: s.net_liquidation, fmt: 'currency' },
        { label: 'Buying Power', value: s.buying_power, fmt: 'currency' },
        { label: 'Cash Balance', value: s.cash_balance, fmt: 'currency' },
        { label: 'Unrealized P&L', value: s.unrealized_pnl, fmt: 'pnl' },
        { label: 'Realized P&L', value: s.realized_pnl, fmt: 'pnl' },
      ];
      items.forEach(item => {
        const val = item.value;
        const isPnl = item.fmt === 'pnl';
        const cls = isPnl ? (val >= 0 ? 'positive' : 'negative') : '';
        const sign = isPnl && val >= 0 ? '+' : '';
        const formatted = val != null ? '$' + sign + Utils.formatPrice(Math.abs(val)) : '—';
        html += '<div style="text-align:center">';
        html += '<div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">' + item.label + '</div>';
        html += '<div style="font-size:1.1rem;font-weight:700;margin-top:4px" class="' + cls + '">' + formatted + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    } else if (account) {
      // Fallback: account exists but no accounts array — show raw keys
      html += '<div class="card" style="margin-bottom:16px">';
      html += '<div class="card-title">Account Summary</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">';
      Object.entries(account).forEach(([key, val]) => {
        if (typeof val === 'object') return;
        const display = typeof val === 'number' ? '$' + Utils.formatPrice(Math.abs(val)) + (val < 0 ? ' (neg)' : '') : String(val);
        html += '<div style="text-align:center">';
        html += '<div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">' + key.replace(/_/g, ' ') + '</div>';
        html += '<div style="font-size:1rem;font-weight:600;margin-top:4px">' + display + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    }

    // ── Positions Table ──
    if (positions?.positions?.length) {
      html += '<h3 style="font-size:0.9rem;font-weight:700;margin:16px 0 8px;color:var(--text-primary)">Open Positions (' + positions.positions.length + ')</h3>';
      html += '<div class="card table-wrap"><table><thead><tr>';
      html += '<th>Ticker</th><th>Qty</th><th>Market Price</th><th>Market Value</th><th>Unrealized P&L</th><th>Cost Basis</th><th>Currency</th>';
      html += '</tr></thead><tbody>';
      positions.positions.forEach(p => {
        const pnl = p.unrealized_pnl || 0;
        const pnlCls = pnl >= 0 ? 'positive' : 'negative';
        html += '<tr>';
        html += '<td><strong>' + Utils.esc(p.ticker) + '</strong></td>';
        html += '<td>' + (p.quantity != null ? p.quantity : '—') + '</td>';
        html += '<td>' + (p.market_price != null ? '$' + Utils.formatPrice(p.market_price) : '—') + '</td>';
        html += '<td>' + (p.market_value != null ? '$' + Utils.formatPrice(p.market_value) : '—') + '</td>';
        html += '<td class="' + pnlCls + '">' + (p.unrealized_pnl != null ? (pnl >= 0 ? '+' : '') + '$' + Utils.formatPrice(Math.abs(pnl)) : '—') + '</td>';
        html += '<td>' + (p.cost_basis != null ? '$' + Utils.formatPrice(p.cost_basis) : '—') + '</td>';
        html += '<td>' + Utils.esc(p.currency || '—') + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    } else {
      html += '<div class="card" style="text-align:center;padding:16px;color:var(--text-muted);margin-top:12px">No open positions.</div>';
    }

    // ── Recent Trades ──
    if (trades?.trades?.length) {
      html += '<h3 style="font-size:0.9rem;font-weight:700;margin:16px 0 8px;color:var(--text-primary)">Recent Trades (Last ' + Math.min(trades.trades.length, 10) + ')</h3>';
      html += '<div class="card table-wrap"><table><thead><tr>';
      html += '<th>Ticker</th><th>Direction</th><th>Qty</th><th>Price</th><th>Date</th><th>P&L</th>';
      html += '</tr></thead><tbody>';
      const recent = trades.trades.slice(-10).reverse();
      recent.forEach(t => {
        const dirCls = t.direction === 'BUY' ? 'badge-green' : 'badge-red';
        const pnl = t.pnl || 0;
        const pnlCls = pnl >= 0 ? 'positive' : 'negative';
        html += '<tr>';
        html += '<td><strong>' + Utils.esc(t.ticker) + '</strong></td>';
        html += '<td><span class="badge ' + dirCls + '" style="font-size:0.65rem">' + Utils.esc(t.direction) + '</span></td>';
        html += '<td>' + (t.quantity != null ? t.quantity : '—') + '</td>';
        html += '<td>' + (t.price != null ? '$' + Utils.formatPrice(t.price) : '—') + '</td>';
        html += '<td style="font-size:0.8rem">' + Utils.esc(t.trade_date || '—') + '</td>';
        html += '<td class="' + pnlCls + '">' + (t.pnl != null ? (pnl >= 0 ? '+' : '') + '$' + Utils.formatPrice(Math.abs(pnl)) : '—') + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    }

    container.innerHTML = html;
  },

  async render(app) {
    app.innerHTML = '<div class="loading">Loading trade data...</div>';
    const [data, accuracy] = await Promise.all([
      Utils.fetchJSON('/data/paper_trades.json'),
      Utils.fetchJSON('/data/accuracy.json')
    ]);

    let html = '<div class="section">';
    html += '<h2 class="section-title">📊 Trading Performance</h2>';

    // ── TAB NAVIGATION ──
    html += '<div class="research-tabs" style="display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap">';
    html += '<button class="research-tab active" data-tab="paper">📝 Paper Trading</button>';
    html += '<button class="research-tab" data-tab="ibkr">🏦 IBKR Real Portfolio</button>';
    html += '</div>';

    // ── PAPER TRADING TAB ──
    html += '<div class="research-pane" id="tab-paper">';

    // ── Portfolio Summary ──
    if (data?.portfolio) {
      const p = data.portfolio;
      const genAt = data.generated_at ? new Date(data.generated_at).toLocaleString() : '';
      const sign = (p.total_pnl || 0) >= 0 ? '+' : '-';
      const pnlCls = (p.total_pnl || 0) >= 0 ? 'positive' : 'negative';
      const equity = (p.starting_balance || 0) + (p.total_pnl || 0) + (p.unrealized_pnl || 0);
      const deployed = p.invested || 0;
      
      // Hero P&L row like Today view
      html += `<div class="today-pnl ${pnlCls}" style="border-left:none;padding:10px 15px;margin-bottom:16px">`;
      html += `<span class="today-pnl-label">TOTAL P&amp;L</span>`;
      html += `<span class="today-pnl-val">${sign}$${Utils.formatPrice(Math.abs(p.total_pnl || 0))}</span>`;
      html += `<span class="today-pnl-pct">(${Utils.formatPct(p.return_pct || 0)})</span>`;
      html += `<span class="today-pnl-cash" style="margin-left:auto;font-size:0.85rem">Equity $${Utils.formatPrice(equity)} · Cash $${Utils.formatPrice(p.cash)} · ${deployed > 0 ? Math.round(deployed/equity*100) + '% deployed' : 'all cash'}</span>`;
      html += '</div>';
      
      // Detail grid below
      html += '<div class="card" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:16px;margin-bottom:16px">'
        + '<div style="text-align:center"><div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Status</div>'
        + '<div style="font-size:1.2rem;font-weight:700;margin-top:4px;color:var(--positive)">' + Utils.esc(data.status || '—') + '</div></div>'
        + '<div style="text-align:center"><div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Starting</div>'
        + '<div style="font-size:1.2rem;font-weight:700;margin-top:4px">$' + Utils.formatPrice(p.starting_balance) + '</div></div>'
        + '<div style="text-align:center"><div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Cash</div>'
        + '<div style="font-size:1.2rem;font-weight:700;margin-top:4px">$' + Utils.formatPrice(p.cash) + '</div></div>'
        + '<div style="text-align:center"><div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Invested</div>'
        + '<div style="font-size:1.2rem;font-weight:700;margin-top:4px">$' + Utils.formatPrice(p.invested || 0) + '</div></div>'
        + '<div style="text-align:center"><div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Total Value</div>'
        + '<div style="font-size:1.2rem;font-weight:700;margin-top:4px">$' + Utils.formatPrice(p.total_balance) + '</div></div>'
        + '<div style="text-align:center"><div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Win Rate</div>'
        + '<div style="font-size:1.2rem;font-weight:700;margin-top:4px;color:' + ((p.win_rate || 0) >= 50 ? 'var(--positive)' : 'var(--negative)') + '">' + (p.win_rate || 0) + '%</div></div>'
        + '<div style="text-align:center"><div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Trades</div>'
        + '<div style="font-size:1.2rem;font-weight:700;margin-top:4px">' + p.total_trades + '</div></div>'
        + '<div style="text-align:center"><div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Unrealized</div>'
        + '<div style="font-size:1.2rem;font-weight:700;margin-top:4px;color:' + ((p.unrealized_pnl || 0) >= 0 ? 'var(--positive)' : 'var(--negative)') + '">' + ((p.unrealized_pnl || 0) >= 0 ? '+' : '') + '$' + Utils.formatPrice(Math.abs(p.unrealized_pnl || 0)) + '</div></div>'
        + '<div style="text-align:center"><div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Active Strategy</div>'
        + '<div style="font-size:0.9rem;font-weight:600;margin-top:4px">' + Utils.esc(data.active_strategy || '—') + '</div></div>'
        + '<div style="text-align:center"><div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Last Updated</div>'
        + '<div style="font-size:0.8rem;font-weight:500;margin-top:4px">' + Utils.esc(genAt) + '</div></div>'
        + '</div>';
    }

    // ── Live Open Positions ──
    // Currency toggle
    const fxRate = data.fx_rate_usdcad || 1.38;
    const storedPref = localStorage.getItem('preferredCurrency') || 'native';
    html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:24px;margin-bottom:8px">
      <h2 class="section-title" style="margin:0">Open Positions</h2>
      <div style="display:flex;align-items:center;gap:6px;font-size:0.75rem">
        <span style="color:var(--text-muted)">Display:</span>
        <button id="cur-toggle" style="padding:3px 10px;border-radius:4px;border:1px solid var(--border);background:${storedPref === 'native' ? 'var(--green-bg)' : 'var(--bg-inset)'};color:var(--text-body);cursor:pointer;font-size:0.75rem;font-weight:600">
          ${storedPref === 'native' ? 'Native Currency' : storedPref === 'USD' ? 'USD' : 'CAD'}
        </button>
        <span style="color:var(--text-muted);font-size:0.7rem">FX: 1 USD = ${fxRate.toFixed(2)} CAD</span>
      </div>
    </div>`;
    if (data?.open_positions?.length) {
      // Asset class breakdown summary
      const _acCounts = {};
      data.open_positions.forEach(t => {
        const ac = (t.asset_class || 'STOCK').toUpperCase();
        _acCounts[ac] = (_acCounts[ac] || 0) + 1;
      });
      const _acColors = { STOCK: 'var(--text-muted)', OPTION: '#9c27b0', CRYPTO: '#ff9800', FOREX: '#2196f3', COMMODITY: '#ffc107' };
      let _acSummary = Object.entries(_acCounts).map(([k, v]) => `<span style="color:${_acColors[k] || 'var(--text-muted)'};font-weight:600">${v} ${k}</span>`).join(' · ');
      html += '<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">' + _acSummary + '</div>';
      
      html += '<div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Asset</th><th>Type</th><th>Entry</th><th>Entry Price</th><th>Current</th><th>P&L</th><th>Risk</th><th>Strategy</th><th>Status</th></tr></thead><tbody>';
      data.open_positions.filter(t => {
        const ac = (t.asset_class || '').toUpperCase();
        const tp = (t.type || '').toLowerCase();
        const tt = (t.trade_type || '').toLowerCase();
        return ac !== 'OPTION' && tp !== 'option' && tt !== 'option';
      }).forEach(t => {
        const pnlCls = t.pnl_pct > 0 ? 'positive' : t.pnl_pct < 0 ? 'negative' : '';
        const status = t.pnl_pct > 5 ? '✅ In Profit' : t.pnl_pct > 2 ? '✅ Profitable' : t.pnl_pct > 0 ? '⏳ Pending' : t.pnl_pct > -3 ? '⏳ Watching' : t.pnl_pct > -7 ? '⚠️ At Risk' : '🔴 Stop Zone';
        const nativeCur = t.currency || 'USD';
        const pref = localStorage.getItem('preferredCurrency') || 'native';
        let displayCur, entryVal, currVal;
        if (pref === 'USD') {
          displayCur = 'USD'; entryVal = t.entry_price_usd ?? t.entry_price; currVal = t.current_price_usd ?? t.current_price;
        } else if (pref === 'CAD') {
          displayCur = 'CAD'; entryVal = t.entry_price_cad ?? t.entry_price; currVal = t.current_price_cad ?? t.current_price;
        } else {
          displayCur = nativeCur; entryVal = t.entry_price; currVal = t.current_price;
        }
        const entryDisplay = '$' + (entryVal || 0).toFixed(2) + ' ' + displayCur;
        const currDisplay = '$' + (currVal || 0).toFixed(2) + ' ' + displayCur;
        const isOption = (t.asset_class || '').toUpperCase() === 'OPTION';
        // For options, show strike + expiry instead of P&L
        let pnlDisplay;
        if (isOption) {
          pnlDisplay = t.option_strike ? `Strike $${t.option_strike}` : '—';
          if (t.option_expiration) pnlDisplay += ` · Exp ${t.option_expiration}`;
          if (t.option_days_to_expiry != null) pnlDisplay += ` (${t.option_days_to_expiry}d)`;
        } else {
          pnlDisplay = '$' + t.pnl.toFixed(2) + ' (' + (t.pnl_pct >= 0 ? '+' : '') + t.pnl_pct.toFixed(1) + '%)';
        }
        const hoverReason = Utils.esc(t.rationale || t.strategy || '');
        const hoverTip = t.rationale ? 'Decision: ' + Utils.esc(t.rationale) : '';
        // Asset class badge
        const _ac = (t.asset_class || 'STOCK').toUpperCase();
        const _acBadgeMap = { OPTION: { bg: '#9c27b0', color: '#fff', label: 'OPT' }, CRYPTO: { bg: '#ff9800', color: '#fff', label: 'CRYPTO' }, FOREX: { bg: '#2196f3', color: '#fff', label: 'FX' }, COMMODITY: { bg: '#ffc107', color: '#333', label: 'COMM' } };
        const _acB = _acBadgeMap[_ac];
        const acBadge = _acB ? `<span style="background:${_acB.bg};color:${_acB.color};padding:2px 5px;border-radius:3px;font-size:0.6rem;font-weight:700">${_acB.label}</span>` : '<span style="color:var(--text-muted);font-size:0.65rem">STOCK</span>';
        html += `<tr class="trade-row open-trade" title="${hoverTip}" data-ticker="${Utils.esc(t.ticker)}" data-rationale="${Utils.esc(t.rationale || '')}" data-exit-rationale="" style="cursor:pointer">
          <td><strong>${Utils.esc(t.ticker)}</strong></td>
          <td>${acBadge}</td>
          <td><span class="badge ${t.type === 'Stock' ? 'badge-green' : t.type === 'ETF' ? 'badge-yellow' : 'badge'}" style="font-size:0.65rem">${t.type || 'Other'}</span></td>
          <td style="font-size:0.85rem">${t.entry_date || '—'}</td>
          <td style="font-size:0.85rem">${entryDisplay}</td>
          <td style="font-size:0.85rem">${currDisplay}</td>
          <td class="${pnlCls}" style="font-weight:700;font-size:0.85rem">${pnlDisplay}</td>
          <td><div class="riskbar"><i class="${t.pnl_pct >= 0 ? 'risk-up' : 'risk-dn'}" style="${t.pnl_pct >= 0 ? 'left:50%' : 'right:50%'};width:${Math.min(50, Math.abs(t.pnl_pct) * 8)}%"></i></div></td>
          <td style="font-size:0.8rem">${this._strategyLink(t.strategy)}</td>
          <td><span class="badge ${t.pnl_pct > 0 ? 'badge-green' : t.pnl_pct < -3 ? 'badge-red' : 'badge-yellow'}" style="font-size:0.65rem">${status}</span></td>
        </tr>`;
      });
      html += '</tbody></table></div>';

      // ── My Option Positions (separate sub-section) ──
      const optionPositions = data.open_positions.filter(t => {
        const ac = (t.asset_class || '').toUpperCase();
        const tp = (t.type || '').toLowerCase();
        const tt = (t.trade_type || '').toLowerCase();
        return ac === 'OPTION' || tp === 'option' || tt === 'option';
      });
      if (optionPositions.length) {
        html += '<div class="card" style="margin-top:16px">';
        html += '<div class="card-title" style="font-size:1rem">📋 My Option Positions</div>';
        html += '<div class="table-wrap">';
        html += '<table class="of-table"><thead><tr>';
        html += '<th>Ticker</th><th>Strike</th><th>Expiry</th><th>DTE</th><th>Premium Paid</th><th>Current Premium</th><th>P&L</th><th>Status</th>';
        html += '</tr></thead><tbody>';

        optionPositions.forEach(pos => {
          const strike = pos.option_strike || '—';
          const expiry = pos.option_expiration || '—';
          const dte = pos.option_days_to_expiry != null ? pos.option_days_to_expiry + 'd' : '—';
          const premiumPaid = pos.entry_price ? '$' + pos.entry_price.toFixed(2) : '—';
          const currentPrem = pos.current_price ? '$' + pos.current_price.toFixed(2) : '—';
          const pnl = pos.pnl || 0;
          const pnlCls = pnl >= 0 ? 'positive' : 'negative';
          const pnlDisplay = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(2);
          const status = pos.option_days_to_expiry != null
            ? (pos.option_days_to_expiry <= 0 ? '🔴 Expired' : pos.option_days_to_expiry <= 3 ? '⚠️ Expiring Soon' : '⏳ Open')
            : '⏳ Open';
          const dteColor = pos.option_days_to_expiry != null && pos.option_days_to_expiry <= 3
            ? 'color:var(--red, #f44336);font-weight:700' : '';

          html += '<tr>';
          html += `<td><strong>${Utils.esc(pos.ticker)}</strong></td>`;
          html += `<td>$${Utils.esc(String(strike))}</td>`;
          html += `<td style="font-size:0.8rem">${Utils.esc(String(expiry))}</td>`;
          html += `<td style="${dteColor}">${dte}</td>`;
          html += `<td style="font-weight:600">${premiumPaid}</td>`;
          html += `<td style="font-weight:600">${currentPrem}</td>`;
          html += `<td class="${pnlCls}" style="font-weight:700">${pnlDisplay}</td>`;
          html += `<td>${status}</td>`;
          html += '</tr>';
        });

        html += '</tbody></table></div></div>';
      }
    } else {
      html += '<div class="card" style="text-align:center;padding:32px;color:var(--text-muted)">No open positions. All trades closed.</div>';
    }

    // ── Backtest Accuracy Summary ──
    if (accuracy?.overall) {
      const ov = accuracy.overall;
      html += '<h2 class="section-title" style="margin-top:24px">Prediction Engine Accuracy (V1-V100)</h2>';
      html += '<div class="grid-4" style="margin-bottom:20px">';
      const cards = [
        { label: 'Top 10 Avg WR', value: ov.top_10_avg_win_rate + '%', cls: 'positive', sub: 'Across top strategies' },
        { label: 'Top 10 Avg P&L', value: '+' + ov.top_10_avg_pnl + '%', cls: 'positive', sub: 'Per trade average' },
        { label: 'Best Win Rate', value: ov.best_win_rate + '%', cls: 'positive', sub: ov.best_version },
        { label: 'Total Backtest', value: (ov.total_backtest_trades || '').toLocaleString(), cls: '', sub: '100 versions tested' },
      ];
      cards.forEach(c => {
        html += `<div class="card" style="text-align:center">
          <div class="card-title">${c.label}</div>
          <div class="index-price ${c.cls}" style="font-size:1.5rem">${c.value}</div>
          <div style="font-size:0.7rem;color:var(--text-muted)">${c.sub}</div>
        </div>`;
      });
      html += '</div>';
    }

    // ── Top 10 Strategies ──
    if (accuracy?.top_performers?.length) {
      html += '<h2 class="section-title" style="margin-top:24px">Best Strategies (Backtest Verified)</h2>';
      html += '<div class="card table-wrap"><table><thead><tr><th>Rank</th><th>Version</th><th>Trades</th><th>Win Rate</th><th>Avg P&L</th><th>PF</th><th>Confidence</th></tr></thead><tbody>';
      const medals = ['🥇', '🥈', '🥉', '4', '5', '6', '7', '8', '9', '10'];
      accuracy.top_performers.forEach((v, i) => {
        if (i >= 10) return;
        const conf = v.trades >= 100 ? 'High' : v.trades >= 30 ? 'Medium' : 'Low';
        const confCls = conf === 'High' ? 'badge-green' : conf === 'Medium' ? 'badge-yellow' : 'badge-red';
        html += `<tr>
          <td style="font-size:0.8rem">${medals[i]}</td>
          <td>${this._strategyLink(v.name)}</td>
          <td>${v.trades}</td>
          <td><span class="${v.win_rate >= 70 ? 'badge badge-green' : v.win_rate >= 60 ? 'badge badge-yellow' : 'badge'}" style="font-size:0.7rem">${v.win_rate}%</span></td>
          <td class="${v.avg_pnl >= 0 ? 'positive' : 'negative'}">${v.avg_pnl >= 0 ? '+' : ''}${v.avg_pnl}%</td>
          <td>${v.profit_factor}</td>
          <td><span class="badge ${confCls}">${conf}</span></td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }

    // ── MR Evolution ──
    if (accuracy?.mr_progression?.length) {
      html += '<h2 class="section-title" style="margin-top:24px">Mean Reversion Evolution</h2>';
      html += '<div class="card table-wrap"><table><thead><tr><th>Ver</th><th>WR</th><th>P&L</th><th>PF</th><th>Trades</th></tr></thead><tbody>';
      accuracy.mr_progression.slice(-6).forEach(v => {
        html += `<tr>
          <td><strong>${v.version}</strong></td>
          <td><span class="${v.win_rate >= 70 ? 'badge badge-green' : v.win_rate >= 60 ? 'badge badge-yellow' : 'badge'}" style="font-size:0.7rem">${v.win_rate}%</span></td>
          <td class="${v.avg_pnl >= 0 ? 'positive' : 'negative'}">${v.avg_pnl >= 0 ? '+' : ''}${v.avg_pnl}%</td>
          <td>${v.pf}</td>
          <td>${v.trades}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }

    // ── Strategy Breakdown ──
    html += '<h2 class="section-title" style="margin-top:24px">Strategy Confidence Levels</h2>';
    html += '<div class="card" style="margin-bottom:20px;"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    const strategies = [
      { name: 'Mean Reversion (VIX≥12)', wr: 74.3, pnl: 4.67, pf: 5.10, trades: 35, best: true },
      { name: 'Bear Market MR', wr: 80.0, pnl: 8.71, pf: 11.82, trades: 25, best: true },
      { name: 'Crash Bounce', wr: 81.6, pnl: 7.78, pf: 4.42, trades: 98, best: true },
      { name: 'Score-Weighted MR', wr: 73.3, pnl: 3.41, pf: 4.05, trades: 75 },
      { name: 'Bull Momentum', wr: 61.6, pnl: 2.05, pf: 1.89, trades: 2625 },
      { name: 'Bullish Engulfing', wr: 62.2, pnl: 1.95, pf: 1.87, trades: 1898 },
    ];
    strategies.forEach(s => {
      const conf = s.trades >= 500 ? 'High' : s.trades >= 50 ? 'Medium' : 'Low';
      const confCls = conf === 'High' ? 'badge-green' : conf === 'Medium' ? 'badge-yellow' : 'badge-red';
      html += `<div style="border:1px solid var(--border-dim);border-radius:var(--card-radius);padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-weight:600;font-size:0.9rem;cursor:pointer" class="strategy-link" data-strategy="${s.name}">${s.name}</span>
          ${s.best ? '<span class="badge badge-green" style="font-size:0.6rem">⭐ TOP</span>' : ''}
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:0.8rem">
          <span><span style="color:var(--text-muted)">WR:</span> ${s.wr}%</span>
          <span><span style="color:var(--text-muted)">Avg:</span> <span class="${s.pnl >= 0 ? 'positive' : 'negative'}">+${s.pnl}%</span></span>
          <span><span style="color:var(--text-muted)">PF:</span> ${s.pf}</span>
          <span><span style="color:var(--text-muted)">Trades:</span> ${s.trades}</span>
          <span><span class="badge ${confCls}" style="font-size:0.6rem">${conf}</span></span>
        </div>
      </div>`;
    });
    html += '</div></div>';

    // ── All Trades ──
    const allTrades = data?.recent_trades?.map(t => ({ ...t, _isClosed: true })) || [];
    if (allTrades.length) {
      html += '<h2 class="section-title" style="margin-top:24px">Trade History</h2>';
      html += '<div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Type</th><th>Entry</th><th>Exit</th><th>Entry Price</th><th>Exit Price</th><th>P&L</th><th>P&L %</th><th>Status</th></tr></thead><tbody>';
      allTrades.slice(0, 30).forEach(t => {
        const cls = (t.pnl_pct > 0 || t.pnl_usd > 0) ? 'positive' : (t.pnl_pct < 0 || t.pnl_usd < 0) ? 'negative' : '';
        const status = 'Closed';
        const statusCls = 'badge-green';
        const nativeCur = t.currency || 'USD';
        const pref2 = localStorage.getItem('preferredCurrency') || 'native';
        let dCur, eVal, xVal;
        if (pref2 === 'USD') {
          dCur = 'USD'; eVal = t.entry_price_usd ?? t.entry_price; xVal = t.exit_price_usd ?? t.exit_price;
        } else if (pref2 === 'CAD') {
          dCur = 'CAD'; eVal = t.entry_price_cad ?? t.entry_price; xVal = t.exit_price_cad ?? t.exit_price;
        } else {
          dCur = nativeCur; eVal = t.entry_price; xVal = t.exit_price;
        }
        const entryStr = eVal ? `$${(eVal || 0).toFixed(2)} ${dCur}` : '—';
        const exitStr = xVal ? `$${(xVal || 0).toFixed(2)} ${dCur}` : '—';
        const entryDT = t.entry_date ? (() => { try { var d = new Date(t.entry_date.replace('Z','').replace('T',' ')); return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + '<br><span style=\"font-size:0.7rem;color:var(--text-muted)\">' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '</span>'; } catch(e) { return t.entry_date.slice(0,10); } })() : '—';
        const exitDT = t.exit_date ? (() => { try { var d = new Date(t.exit_date.replace('Z','').replace('T',' ')); return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + '<br><span style=\"font-size:0.7rem;color:var(--text-muted)\">' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '</span>'; } catch(e) { return t.exit_date.slice(0,10); } })() : '—';
        const hoverReason = Utils.esc(t.reason || t.rationale || '');
        const hoverExit = Utils.esc(t.exit_rationale || '');
        const tipText = (hoverReason ? 'Entry: ' + hoverReason : '') + (hoverReason && hoverExit ? ' | ' : '') + (hoverExit ? 'Exit: ' + hoverExit : '');
        const pnlDisplay = t.pnl_pct != null ? `${t.pnl_pct >= 0 ? '+' : ''}${t.pnl_pct}%` : (t.pnl_usd != null ? `$${t.pnl_usd.toFixed(2)}` : '---');
        html += `<tr class="trade-row" title="${tipText}" data-ticker="${Utils.esc(t.ticker)}" data-rationale="${hoverReason}" data-exit-rationale="${hoverExit}" style="cursor:pointer">
          <td><strong>${Utils.esc(t.ticker)}</strong></td>
          <td><span class="badge ${t.type === 'Stock' ? 'badge-green' : 'badge-yellow'}" style="font-size:0.65rem">${t.type || '—'}</span></td>
          <td style="font-size:0.8rem">${entryDT}</td>
          <td style="font-size:0.8rem">${exitDT}</td>
          <td style="font-size:0.85rem">${entryStr}</td>
          <td style="font-size:0.85rem">${exitStr}</td>
          <td class="${cls}" style="font-weight:700">${pnlDisplay}</td>
          <td class="${cls}" style="font-size:0.85rem">${t.pnl_pct != null ? (t.pnl_pct >= 0 ? '+' : '') + t.pnl_pct + '%' : '—'}</td>
          <td><span class="badge ${statusCls}" style="font-size:0.65rem">${status}</span></td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }

    // Close paper tab pane
    html += '</div>'; // #tab-paper

    // ── IBKR REAL PORTFOLIO TAB ──
    html += '<div class="research-pane" id="tab-ibkr" style="display:none">';
    html += '<div id="ibkr-content"><div class="loading">Loading IBKR portfolio...</div></div>';
    html += '</div>'; // #tab-ibkr

    html += '</div>'; // .section

    // Modal for trade reason
    html += '<div id="trade-modal" class="modal-overlay" style="display:none">';
    html += '  <div class="modal-content" style="max-width:500px"><span class="modal-close" id="trade-modal-close">&times;</span>';
    html += '    <div id="trade-modal-body" style="min-height:60px">Loading...</div>';
    html += '  </div>';
    html += '</div>';

    app.innerHTML = html;

    // ── Wire up tab switching ──
    app.querySelectorAll('.research-tab').forEach(tab => {
      tab.addEventListener('click', function() {
        app.querySelectorAll('.research-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        app.querySelectorAll('.research-pane').forEach(p => p.style.display = 'none');
        const pane = document.getElementById('tab-' + this.dataset.tab);
        if (pane) pane.style.display = 'block';
        // Lazy-load IBKR data when the tab is first clicked
        if (this.dataset.tab === 'ibkr') {
          PaperTrades._renderIBKR();
        }
      });
    });

    // ── Wire up strategy link clicks ──
    app.querySelectorAll('.strategy-link').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const strategy = el.dataset.strategy || el.textContent.trim();
        PaperTrades._showModal(strategy);
      });
    });

    // ── Wire up trade row clicks for reason modal ──
    app.querySelectorAll('.trade-row').forEach(el => {
      el.addEventListener('click', function() {
        const ticker = this.dataset.ticker || '';
        const rationale = this.dataset.rationale || '';
        const exitRationale = this.dataset.exitRationale || '';
        const isOpen = this.classList.contains('open-trade');
        const modal = document.getElementById('trade-modal');
        const body = document.getElementById('trade-modal-body');
        const close = document.getElementById('trade-modal-close');
        if (!modal || !body) return;

        let content = '<div style="border-bottom:1px solid var(--border-dim);padding-bottom:12px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">' +
          '<span style="font-size:1.1rem;font-weight:700;color:var(--text-primary)">' + Utils.esc(ticker) + '</span>' +
          '<span class="badge ' + (isOpen ? 'badge-green' : 'badge-yellow') + '" style="font-size:0.65rem">' + (isOpen ? '🟢 Open Position' : '✅ Closed Trade') + '</span>' +
        '</div>';

        // Entry rationale
        if (rationale) {
          content += '<div style="margin-bottom:12px">' +
            '<div style="font-size:0.7rem;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">📋 Entry Decision</div>' +
            '<div style="font-size:0.85rem;line-height:1.7;color:var(--text-body);background:var(--bg-inset);padding:14px;border-radius:var(--radius-lg);border-left:3px solid var(--green)">' +
              Utils.esc(rationale) +
            '</div></div>';
        }

        // Exit rationale (only for closed trades)
        if (exitRationale) {
          content += '<div style="margin-bottom:8px">' +
            '<div style="font-size:0.7rem;font-weight:700;color:var(--yellow);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">📊 Exit Reason</div>' +
            '<div style="font-size:0.85rem;line-height:1.7;color:var(--text-body);background:var(--bg-inset);padding:14px;border-radius:var(--radius-lg);border-left:3px solid var(--yellow)">' +
              Utils.esc(exitRationale) +
            '</div></div>';
        }

        if (!rationale && !exitRationale) {
          content += '<div style="font-size:0.85rem;line-height:1.7;color:var(--text-muted);background:var(--bg-inset);padding:16px;border-radius:var(--radius-lg)">' +
            'No decision details recorded for this trade.' +
          '</div>';
        }

        body.innerHTML = content;
        modal.style.display = 'flex';
        if (close) close.onclick = function() { modal.style.display = 'none'; };
        modal.onclick = function(e) { if (e.target === modal) modal.style.display = 'none'; };
      });
    });

    // ── Currency toggle handler ──
    const toggleBtn = document.getElementById('cur-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const cur = localStorage.getItem('preferredCurrency') || 'native';
        const next = cur === 'native' ? 'USD' : cur === 'USD' ? 'CAD' : 'native';
        localStorage.setItem('preferredCurrency', next);
        PaperTrades.render(app); // re-render with new currency
      });
    }
  }
};
