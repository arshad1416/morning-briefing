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

    // ── Geopolitical Analysis ──
    if (data.geopolitical_analysis) {
      const geo = data.geopolitical_analysis;
      html += `<h2 class="section-title">Geopolitical & Regime Analysis</h2>
        <div class="card" style="margin-bottom:16px">
          <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6;margin-bottom:16px">${geo.description}</div>
          <div style="display:flex;flex-direction:column;gap:16px">`;

      geo.events.forEach(ev => {
        // Determine overall sentiment
        const perfValues = Object.values(ev.strategy_performance);
        const avgV3 = perfValues.reduce((sum, v) => {
          const m = v.match(/V3:\s*([+-]?\d+\.?\d*)/);
          return sum + (m ? parseFloat(m[1]) : 0);
        }, 0) / Object.keys(ev.strategy_performance).length;

        html += `<div style="border:1px solid var(--border-dim);border-radius:var(--card-radius);padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px">
            <span style="font-weight:600;color:var(--text-primary)">${ev.event}</span>
            <span style="font-size:0.75rem;color:var(--text-muted)">${ev.period}</span>
            <span class="badge ${avgV3 >= 2 ? 'badge-green' : avgV3 >= 1 ? 'badge-yellow' : 'badge-red'}" style="font-size:0.7rem">V3 avg: ${avgV3 >= 0 ? '+' : ''}${avgV3.toFixed(1)}%</span>
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:10px">${ev.market_impact}</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px">`;

        // Strategy performance cards
        const sColor = (val) => {
          const m = val.match(/V3:\s*([+-]?\d+\.?\d*)/);
          const num = m ? parseFloat(m[1]) : 0;
          return num >= 2 ? 'var(--green)' : num >= 0.5 ? 'var(--accent)' : 'var(--red)';
        };
        Object.entries(ev.strategy_performance).forEach(([sk, val]) => {
          html += `<div style="background:var(--bg-inset);border-radius:var(--radius-sm);padding:8px;text-align:center">
            <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.05em;margin-bottom:4px">${sk.replace(/_/g,' ')}</div>
            <div style="font-size:0.75rem;font-weight:600;color:${sColor(val)}">${val}</div>
          </div>`;
        });

        html += `</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);line-height:1.5;padding:8px;background:var(--accent-dim);border-radius:var(--radius-sm)">
            <strong style="color:var(--accent)">Lesson:</strong> ${ev.lesson}
          </div>
        </div>`;
      });

      html += '</div></div>';

      // Current risk factors
      if (geo.current_risk_factors?.length) {
        html += `<h2 class="section-title">Current Risk Factors</h2>
          <div class="card" style="margin-bottom:16px">
            <div class="card-title">Geopolitical events currently monitored for strategy impact</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">`;
        geo.current_risk_factors.forEach(rf => {
          html += `<span class="badge badge-yellow" style="font-size:0.75rem;padding:4px 10px">${rf}</span>`;
        });
        html += '</div></div>';
      }

      // Regime adaptation table
      if (geo.regime_adaptation?.regimes) {
        html += `<h2 class="section-title">Regime Adaptation Logic</h2>
          <div class="card" style="padding:0;overflow:hidden;margin-bottom:28px"><table><thead><tr><th>Market Regime</th><th>Active Strategies</th><th>Size</th></tr></thead><tbody>`;
        geo.regime_adaptation.regimes.forEach(r => {
          const sizeCls = parseFloat(r.size_multiplier) >= 1 ? 'badge-green' : parseFloat(r.size_multiplier) >= 0.5 ? 'badge-yellow' : 'badge-red';
          html += `<tr><td><strong>${r.regime}</strong></td><td style="font-size:0.85rem">${r.active_strategies}</td><td><span class="badge ${sizeCls}" style="font-size:0.7rem">${r.size_multiplier}</span></td></tr>`;
        });
        html += '</tbody></table></div>';
      }
    }

    // ── Polymarket Sentiment ──
    if (data.polymarket_sentiment) {
      const pm = data.polymarket_sentiment;
      html += `<h2 class="section-title" style="margin-top:12px">Polymarket Sentiment</h2>
        <div class="card" style="margin-bottom:16px">
          <div class="card-title">Live prediction market data — ${pm.top_markets.length} markets tracked</div>
          <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6;margin-bottom:12px">${pm.description}</div>
          <div style="font-size:0.85rem;color:var(--accent);line-height:1.6;margin-bottom:16px;padding:10px;background:var(--accent-dim);border-radius:var(--radius-sm)"><strong>V5 Use:</strong> ${pm.how_used}</div>
          <div style="display:flex;flex-direction:column;gap:8px">`;
      pm.top_markets.forEach(m => {
        const outcomes = Object.entries(m.outcomes).map(([k,v]) => `${k}: ${v}`).join(' | ');
        const vol = m.volume >= 1e6 ? `$${(m.volume/1e6).toFixed(1)}M` : `$${(m.volume/1e3).toFixed(1)}K`;
        const cls = m.closed ? 'badge-red' : 'badge-green';
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--bg-inset);border-radius:var(--radius-sm);flex-wrap:wrap;gap:4px">
          <span style="font-size:0.8rem;flex:1">${m.question.substring(0,65)}${m.question.length > 65 ? '...' : ''}</span>
          <span style="font-size:0.75rem;color:var(--text-secondary)">${outcomes}</span>
          <span style="font-size:0.7rem;color:var(--text-muted)">${vol}</span>
          <span class="badge ${cls}" style="font-size:0.6rem">${m.closed ? 'Closed' : 'Active'}</span>
        </div>`;
      });
      html += `</div>
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;text-align:right">Source: ${pm.source} · ${pm.fetched_at}</div>
      </div>`;
    }

    // ── V5 95% Target Design ──
    if (data.v5_design) {
      const v5 = data.v5_design;
      html += `<h2 class="section-title" style="color:var(--green)">${v5.version}</h2>
        <div class="card" style="margin-bottom:16px">
          <div class="card-title" style="color:var(--green)">Target: ${v5.target_metrics.win_rate} Win Rate · PF ${v5.target_metrics.profit_factor} · ${v5.target_metrics.trades_per_year}</div>
          <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6;margin-bottom:16px">${v5.the_philosophy}</div>
          <div style="font-size:0.85rem;margin-bottom:16px;padding:10px;background:var(--yellow-bg);border:1px solid var(--yellow-border);border-radius:var(--radius-sm)"><strong style="color:var(--yellow)">⚠ Trade-off:</strong> ${v5.the_tradeoff}</div>`;

      // Target metrics
      html += `<div class="grid-3" style="margin-bottom:16px">`;
      Object.entries(v5.target_metrics).forEach(([k, v]) => {
        html += `<div class="card"><div class="card-title">${k.replace(/_/g,' ')}</div><div style="font-size:1.1rem;font-weight:700;color:var(--green)">${v}</div></div>`;
      });
      html += `</div>`;

      // 5-Layer Filter
      html += `<h3 class="intel-header" style="margin-top:20px">The 5-Layer Filter — All Must Pass</h3>`;
      Object.entries(v5.the_5_layer_filter).forEach(([key, layer]) => {
        html += `<div style="border-left:3px solid var(--green);padding:10px 14px;margin:8px 0;background:var(--bg-inset);border-radius:0 var(--radius-sm) var(--radius-sm) 0">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">
            <span style="font-weight:600;color:var(--text-primary);font-size:0.9rem">${layer.name}</span>
            <span class="badge badge-green" style="font-size:0.65rem">${layer.filter_rate}</span>
          </div>
          <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px">${layer.description}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">${layer.implementation || ''}</div>
        </div>`;
      });

      // Exit rules
      html += `<h3 class="intel-header" style="margin-top:20px">Exit Rule Ladder (All 5 Layers Executed Daily)</h3><table><thead><tr><th>Layer</th><th>Rule</th></tr></thead><tbody>`;
      Object.entries(v5.exit_rules).forEach(([k, v]) => {
        html += `<tr><td style="font-weight:600">${k.replace(/_/g,' ')}</td><td style="font-size:0.85rem">${v}</td></tr>`;
      });
      html += `</tbody></table>`;

      // Council consensus
      if (v5.council_consensus) {
        html += `<h3 class="intel-header" style="margin-top:20px">Council Consensus (All 4 Members)</h3><ul class="intel-list">`;
        v5.council_consensus.forEach(c => {
          html += `<li style="font-size:0.85rem">${c}</li>`;
        });
        html += `</ul>`;
      }

      // Strategy parameters table
      if (v5.strategy_parameters) {
        html += `<h3 class="intel-header" style="margin-top:20px">Strategy Parameters (V5)</h3>
          <div class="table-wrap"><table><thead><tr><th>Strategy</th><th>Min Score</th><th>Hard Stop</th><th>Target</th><th>Trail</th><th>Max Hold</th><th>Max Pos</th></tr></thead><tbody>`;
        Object.entries(v5.strategy_parameters).forEach(([sk, sp]) => {
          html += `<tr><td><strong>${sk.replace(/_/g,' ')}</strong></td><td>≥${sp.min_score}/10</td><td>${sp.hard_stop}</td><td>${sp.target}</td><td>${sp.trail}</td><td>${sp.max_hold}</td><td>${sp.max_positions}</td></tr>`;
        });
        html += `</tbody></table></div>`;
      }

      // Proven tickers
      const tickers = v5.the_5_layer_filter.layer_5_ticker_allocation?.proven_tickers;
      if (tickers) {
        html += `<h3 class="intel-header" style="margin-top:20px">Proven Tickers (Documented Alpha)</h3>
          <div style="display:flex;flex-wrap:wrap;gap:8px">`;
        tickers.forEach(t => {
          html += `<div style="background:var(--bg-inset);border-radius:var(--radius-sm);padding:10px 14px;text-align:center;min-width:100px">
            <div style="font-weight:700;font-size:1.1rem;color:var(--text-primary)">${t.ticker}</div>
            <div style="font-size:0.75rem;color:${t.avg_pnl.includes('+') ? 'var(--green)' : 'var(--red)'}">${t.avg_pnl}</div>
            <div style="font-size:0.6rem;color:var(--text-muted)">${t.best_strategy}</div>
          </div>`;
        });
        html += `</div>`;
      }

      html += `</div>`;
    }

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
