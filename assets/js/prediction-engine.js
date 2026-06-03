/**
 * Prediction Engine Tuning — Transparent backtest results dashboard.
 * Shows all strategy versions, performance metrics, and iteration history.
 */
const PredictionEngine = {
  DATA_URL: '/data/prediction-engine.json',

  async render(app) {
    app.innerHTML = '<div class="loading">Loading prediction engine data...</div>';
    const data = await State.get('prediction-engine', this.DATA_URL);
    if (!data) {
      app.innerHTML = '<div class="error-card">Failed to load prediction engine data.</div>';
      return;
    }

    let html = '<div class="section"><h2 class="section-title">Prediction Engine Tuning</h2>';

    // ── Summary Banner ──
    const s = data.summary;
    html += `<div style="margin-bottom:24px">
      <div class="key-levels">
        <div class="key-level-item"><span class="key-level-label">Total Trades</span><span class="key-level-value">${s.total_backtest_trades.toLocaleString()}</span></div>
        <div class="key-level-item"><span class="key-level-label">Tickers</span><span class="key-level-value">${s.tickers_tested}</span></div>
        <div class="key-level-item"><span class="key-level-label">Date Range</span><span class="key-level-value">${s.date_range}</span></div>
        <div class="key-level-item"><span class="key-level-label">Hold</span><span class="key-level-value">21d</span></div>
        <div class="key-level-item"><span class="key-level-label">Source</span><span class="key-level-value" style="font-size:0.75rem">yfinance</span></div>
      </div>
    </div>`;

    // ── Meta Info ──
    html += `<p style="color:var(--text-secondary);margin-bottom:28px;line-height:1.6">This page documents all strategy tuning iterations. Each version represents a full 25-year backtest across ${s.tickers_tested} tickers with ${s.strategies_tested.join(', ')}. All trades simulate a ${s.holding_period}. Generated ${new Date(data.generated_at).toLocaleString()}.</p>`;

    // ── Version Comparison Table ──
    html += '<h2 class="section-title">Version Comparison</h2><div class="card" style="padding:0;overflow:hidden;margin-bottom:28px"><table><thead><tr><th>Version</th><th>Trades</th><th>Avg P&L</th><th>Win Rate</th><th>Profit Factor</th><th>Key Innovation</th></tr></thead><tbody>';

    const versions = [
      {key:'V1 Baseline', color:'var(--accent)'},
      {key:'V2 Council-Tuned', color:'var(--green)'},
      {key:'V3 Composite Scoring', color:'var(--blue)'}
    ];

    let prevOverall = null;
    versions.forEach(v => {
      const d = data.versions[v.key];
      const p = d.performance.overall;
      const imp = prevOverall ? ((p.win_rate - prevOverall) / prevOverall * 100).toFixed(1) : '—';
      const impClass = prevOverall && p.win_rate >= prevOverall ? 'positive' : 'negative';
      html += `<tr>
        <td style="color:${v.color};font-weight:700">${v.key}</td>
        <td>${d.total_trades.toLocaleString()}</td>
        <td class="${p.avg_pnl >= 0 ? 'positive' : 'negative'}">${p.avg_pnl >= 0 ? '+' : ''}${p.avg_pnl}%</td>
        <td class="${p.win_rate >= 58 ? 'positive' : 'negative'}">${p.win_rate}%</td>
        <td>${p.profit_factor}</td>
        <td style="font-size:0.85rem;color:var(--text-secondary)">${d.description}</td>
      </tr>`;
      if (prevOverall && imp !== '—') {
        html += `<tr style="font-size:0.75rem"><td></td><td></td><td></td><td class="${impClass}">↗ ${imp}% vs prior</td><td></td><td></td></tr>`;
      }
      prevOverall = p.win_rate;
    });
    html += '</tbody></table></div>';

    // ── Strategy Deep Dive per Version ──
    versions.forEach(v => {
      const d = data.versions[v.key];
      const perf = d.performance;
      html += `<h2 class="section-title" style="margin-top:32px;color:${v.color}">${v.key} — Strategy Breakdown</h2>
        <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px"><table><thead><tr>
          <th>Strategy</th><th>Trades</th><th>Avg P&L</th><th>Win Rate</th><th>Profit Factor</th>
        </tr></thead><tbody>`;

      // Strategy map (handles different naming between versions)
      const s_map = {};
      const s_order = v.key === 'V3 Composite Scoring' 
        ? ['mom-v3', 'bo-v3', 'mr-v3', 'sr-v3']
        : ['momentum', 'breakout', 'mean-reversion', 'sector-rotation'];
      
      const s_labels = v.key === 'V3 Composite Scoring'
        ? {'mom-v3':'Momentum','bo-v3':'Breakout','mr-v3':'Mean Reversion','sr-v3':'Sector Rotation'}
        : {'momentum':'Momentum','breakout':'Breakout','mean-reversion':'Mean Reversion','sector-rotation':'Sector Rotation'};

      s_order.forEach(sk => {
        if (perf[sk]) {
          const p = perf[sk];
          html += `<tr>
            <td><strong>${s_labels[sk] || sk}</strong></td>
            <td>${p.trades ? p.trades.toLocaleString() : '—'}</td>
            <td class="${p.avg_pnl >= 0 ? 'positive' : 'negative'}">${p.avg_pnl >= 0 ? '+' : ''}${p.avg_pnl}%</td>
            <td><span class="${p.win_rate >= 60 ? 'badge badge-green' : p.win_rate >= 58 ? 'badge badge-yellow' : 'badge'}">${p.win_rate}%</span></td>
            <td>${p.profit_factor}</td>
          </tr>`;
        }
      });
      html += '</tbody></table></div>';

      // Decade breakdown
      const decades = d.by_decade;
      const decadeKeys = Object.keys(decades).sort();
      if (decadeKeys.length) {
        html += `<div class="grid-3" style="margin-bottom:24px">`;
        decadeKeys.forEach(dk => {
          html += `<div class="card"><div class="card-title">${dk}</div>`;
          const dd = decades[dk];
          Object.keys(dd).sort().forEach(sk => {
            const label = s_labels[sk] || sk;
            html += `<div style="font-size:0.85rem;margin:4px 0;display:flex;justify-content:space-between">
              <span style="color:var(--text-secondary)">${label}</span>
              <span style="font-weight:600">${dd[sk].toLocaleString()} trades</span>
            </div>`;
          });
          html += `</div>`;
        });
        html += '</div>';
      }

      // Top tickers
      if (d.ticker_counts?.length) {
        html += `<div class="card" style="margin-bottom:20px"><div class="card-title">Most Traded Tickers</div><div style="display:flex;flex-wrap:wrap;gap:6px">`;
        d.ticker_counts.forEach(tc => {
          html += `<span class="badge badge-green" style="font-size:0.75rem">${tc.ticker} (${tc.trades})</span>`;
        });
        html += '</div></div>';
      }
    });

    // ── Visual Performance Comparison ──
    html += `<h2 class="section-title">Win Rate Progression</h2>
      <div class="grid-${versions.length}" style="margin-bottom:28px">`;

    versions.forEach(v => {
      const d = data.versions[v.key];
      const p = d.performance.overall;
      const pct = (p.win_rate - 50) * 5; // scale for visual bar
      html += `<div class="card" style="text-align:center">
        <div class="card-title" style="color:${v.color}">${v.key}</div>
        <div style="font-size:2rem;font-weight:700;color:var(--text-primary);margin:8px 0">${p.win_rate}%</div>
        <div style="font-size:0.85rem;color:var(--text-muted)">Win Rate</div>
        <div style="margin-top:12px;height:8px;background:var(--bg-inset);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${v.color};border-radius:4px;transition:width 0.5s"></div>
        </div>
        <div style="margin-top:8px;font-size:0.75rem;color:var(--text-secondary)">+${p.avg_pnl}% avg · PF ${p.profit_factor}</div>
      </div>`;
    });
    html += '</div>';

    // ── What Changed Per Iteration ──
    html += `<h2 class="section-title">Iteration Log</h2>
      <div class="card" style="margin-bottom:28px">
        <div style="display:flex;flex-direction:column;gap:16px">`;

    const iterations = [
      {ver:'V1', label:'Baseline', color:'var(--accent)', date:'June 3, 2026',
       changes:'Initial backtest framework. Basic signal generation using SMA crossovers, RSI thresholds, and fixed cooldown periods.',
       result:'25,481 trades across 4 strategies. Solid baseline: 58.4% win rate, +1.24% avg P&L. Directionally correct but unfiltered.'},
      {ver:'V2', label:'Council-Tuned', color:'var(--green)', date:'June 3, 2026',
       changes:'Applied recommendations from 4-model council (Gemini, DeepSeek, MiMo, Nemotron). Added: 3% min return threshold, volume 1.3x confirmation, sma50 slope filter, RSI>55 for breakouts, commodity exclusion list, ticker blacklists.',
       result:'19,847 trades (↓22%). Win rate held at 58.6%. Breakout improved massively: +0.56% per trade. Mean reversion stayed strong at +1.86%. Overall P&L up 16% to +1.44%.'},
      {ver:'V3', label:'Composite Scoring', color:'var(--blue)', date:'June 3, 2026',
       changes:'Replaced individual signal conditions with unified scoring engine (0-10 scale). Each trade scored on 7+ independent confirmations. Added: RSI divergence detection, support proximity scoring, bullish/bear divergence, SPY bull regime filter, pre-computed indicators for 100x speedup.',
       result:'44,490 trades (includes prior versions). Overall win rate hit 58.9% (highest). Mean reversion peaked at 61.8% win rate, 1.85 profit factor, +2.18% avg P&L. 10yr mean reversion hit 66% win rate in trending markets.'},
    ];

    iterations.forEach(it => {
      html += `<div style="border-left:3px solid ${it.color};padding-left:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <span style="font-family:var(--font-mono);font-size:0.75rem;font-weight:700;color:${it.color}">${it.ver}</span>
          <span style="font-weight:600;color:var(--text-primary)">${it.label}</span>
          <span style="font-size:0.75rem;color:var(--text-muted)">${it.date}</span>
        </div>
        <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:6px;line-height:1.6"><strong style="color:var(--text-body)">What changed:</strong> ${it.changes}</div>
        <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6"><strong style="color:var(--text-body)">Result:</strong> ${it.result}</div>
      </div>`;
    });

    html += '</div></div>';

    // ── Method Footer ──
    html += `<div class="card" style="background:var(--bg-inset);border-color:var(--border-subtle)">
      <div style="font-size:0.8rem;color:var(--text-muted);line-height:1.7">
        <strong style="color:var(--text-secondary)">Methodology:</strong> All backtests run on Mac (M5) using yfinance data from 2000-01-01 to present. 
        59 tickers across broad ETFs, sectors, bonds, commodities, and individual stocks. Each trade enters at open price when signal triggers 
        and exits after 21 trading days at close price. No slippage or commission included. Strategy performance data computed via Turso (libSQL) database.
        Council members: Gemini, DeepSeek V4 Pro, MiMo-V2.5-Pro, Nemotron 3 Super.
      </div>
    </div>`;

    html += '</div>';
    app.innerHTML = html;
  }
};
