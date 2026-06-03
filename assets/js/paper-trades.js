/**
 * Paper Trades — Live open positions, strategy performance, backtest accuracy.
 * Shows V1-V100 backtest results with live trade tracking.
 * Includes clickable strategy names with explanation modals.
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

  async render(app) {
    app.innerHTML = '<div class="loading">Loading trade data...</div>';
    const [data, accuracy] = await Promise.all([
      Utils.fetchJSON('/data/paper_trades.json'),
      Utils.fetchJSON('/data/accuracy.json')
    ]);

    let html = '<div class="section"><h2 class="section-title">📊 Trading Performance</h2>';

    // ── Live Open Positions ──
    html += '<h2 class="section-title" style="margin-top:24px">Open Positions</h2>';
    if (data?.open_positions?.length) {
      html += '<div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Type</th><th>Entry</th><th>Entry Price</th><th>Current</th><th>P&L</th><th>Strategy</th><th>Status</th></tr></thead><tbody>';
      data.open_positions.forEach(t => {
        const pnlCls = t.pnl_pct > 0 ? 'positive' : t.pnl_pct < 0 ? 'negative' : '';
        const status = t.pnl_pct > 5 ? '✅ In Profit' : t.pnl_pct > 2 ? '✅ Profitable' : t.pnl_pct > 0 ? '⏳ Pending' : t.pnl_pct > -3 ? '⏳ Watching' : t.pnl_pct > -7 ? '⚠️ At Risk' : '🔴 Stop Zone';
        const cur = t.currency || 'USD';
        const entryDisplay = '$' + t.entry_price.toFixed(2) + ' ' + cur;
        const currDisplay = '$' + t.current_price.toFixed(2) + ' ' + cur;
        const pnlDisplay = '$' + t.pnl.toFixed(2) + ' (' + (t.pnl_pct >= 0 ? '+' : '') + t.pnl_pct.toFixed(1) + '%)';
        html += `<tr>
          <td><strong>${t.ticker}</strong></td>
          <td><span class="badge ${t.type === 'Stock' ? 'badge-green' : t.type === 'ETF' ? 'badge-yellow' : 'badge'}" style="font-size:0.65rem">${t.type || 'Other'}</span></td>
          <td style="font-size:0.85rem">${t.entry_date || '—'}</td>
          <td style="font-size:0.85rem">${entryDisplay}</td>
          <td style="font-size:0.85rem">${currDisplay}</td>
          <td class="${pnlCls}" style="font-weight:700;font-size:0.85rem">${pnlDisplay}</td>
          <td style="font-size:0.8rem">${this._strategyLink(t.strategy)}</td>
          <td><span class="badge ${t.pnl_pct > 0 ? 'badge-green' : t.pnl_pct < -3 ? 'badge-red' : 'badge-yellow'}" style="font-size:0.65rem">${status}</span></td>
        </tr>`;
      });
      html += '</tbody></table></div>';
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

    // ── Recent Live Trades ──
    if (data?.recent_trades?.length) {
      html += '<h2 class="section-title" style="margin-top:24px">Recent Trades</h2>';
      html += '<div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Type</th><th>Entry</th><th>Exit</th><th>Entry Price</th><th>Exit Price</th><th>P&L</th><th>Strategy</th><th>Status</th></tr></thead><tbody>';
      data.recent_trades.slice(0, 20).forEach(t => {
        const cls = t.pnl_pct > 0 ? 'positive' : t.pnl_pct < 0 ? 'negative' : '';
        const status = t.exit_date ? '✅ Closed' : '⏳ Open';
        const statusCls = t.exit_date ? 'badge-green' : 'badge-yellow';
        const cur = t.currency || 'USD';
        const entryStr = t.entry_price ? `$${t.entry_price.toFixed(2)} ${cur}` : '—';
        const exitStr = t.exit_price ? `$${t.exit_price.toFixed(2)} ${cur}` : '—';
        const entryDT = t.entry_date ? t.entry_date.replace('T',' ').slice(0,16) : '—';
        const exitDT = t.exit_date ? t.exit_date.replace('T',' ').slice(0,16) : '—';
        html += `<tr>
          <td><strong>${t.ticker}</strong></td>
          <td><span class="badge ${t.type === 'Stock' ? 'badge-green' : 'badge-yellow'}" style="font-size:0.65rem">${t.type || '—'}</span></td>
          <td style="font-size:0.8rem">${entryDT}</td>
          <td style="font-size:0.8rem">${exitDT}</td>
          <td style="font-size:0.85rem">${entryStr}</td>
          <td style="font-size:0.85rem">${exitStr}</td>
          <td class="${cls}" style="font-weight:700">${t.pnl_pct >= 0 ? '+' : ''}${t.pnl_pct}%</td>
          <td style="font-size:0.8rem">${this._strategyLink(t.strategy)}</td>
          <td><span class="badge ${statusCls}" style="font-size:0.65rem">${status}</span></td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }

    // ── Closed Trades All ──
    if (data?.closed_trades?.length) {
      html += '<h2 class="section-title" style="margin-top:24px">Closed Trades History</h2>';
      html += '<div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Type</th><th>Entry Date</th><th>Exit Date</th><th>Entry Price</th><th>Exit Price</th><th>P&L</th><th>P&L %</th><th>Strategy</th><th>Reason</th></tr></thead><tbody>';
      data.closed_trades.forEach(t => {
        const cls = t.pnl_usd > 0 ? 'positive' : t.pnl_usd < 0 ? 'negative' : '';
        const arrow = t.pnl_usd > 0 ? '🟢' : '🔴';
        const cur = t.currency || 'USD';
        html += `<tr>
          <td><strong>${t.ticker}</strong></td>
          <td><span class="badge ${t.type === 'Stock' ? 'badge-green' : 'badge-yellow'}" style="font-size:0.65rem">${t.type}</span></td>
          <td style="font-size:0.8rem">${t.entry_date}</td>
          <td style="font-size:0.8rem">${t.exit_date}</td>
          <td style="font-size:0.85rem">$${t.entry_price.toFixed(2)} ${cur}</td>
          <td style="font-size:0.85rem">$${t.exit_price.toFixed(2)} ${cur}</td>
          <td class="${cls}" style="font-weight:700">${arrow} $${t.pnl_usd.toFixed(2)}</td>
          <td class="${cls}">${t.pnl_pct > 0 ? '+' : ''}${t.pnl_pct}%</td>
          <td style="font-size:0.8rem">${this._strategyLink(t.strategy)}</td>
          <td style="font-size:0.75rem;color:var(--text-muted)">${t.reason}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }

    html += '</div>';
    app.innerHTML = html;

    // ── Wire up strategy link clicks ──
    app.querySelectorAll('.strategy-link').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const strategy = el.dataset.strategy || el.textContent.trim();
        this._showModal(strategy);
      });
    });
  }
};
