/**
 * Research — consolidated reading room.
 * Merges: AI narrative, geopolitical news, market news, Reddit sentiment,
 * analyst ratings, insider trades, congress trades, central banks, earnings,
 * Seeking Alpha ideas, archive, and the old BacktestResearch content.
 */
const Research = {
  async render(app) {
    app.innerHTML = '<div class="loading">Loading research...</div>';

    const [marketData, analysisData, redditData] = await Promise.all([
      State.get('latest', '/data/latest.json').catch(() => null),
      State.get('analysis', '/data/analysis.json').catch(() => null),
      State.get('reddit', '/data/reddit-sentiment.json').catch(() => null),
    ]);

    let html = '<div class="section"><h2 class="section-title">Research</h2>';

    // ── NAVIGATION TABS within Research ──
    html += '<div class="research-tabs" style="display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap">';
    html += '<button class="research-tab active" data-tab="narrative">Overview</button>';
    html += '<button class="research-tab" data-tab="news">News</button>';
    html += '<button class="research-tab" data-tab="reddit">Sentiment</button>';
    html += '<button class="research-tab" data-tab="analysis">Ideas</button>';
    html += '<button class="research-tab" data-tab="backtest">Backtest</button>';
    html += '</div>';

    html += '<div class="research-content">';

    // ── TAB 1: Overview / Narrative ──
    html += '<div class="research-pane" id="tab-narrative">';
    if (marketData?.narrative?.summary_paragraph) {
      const rendered = Utils.renderMarkdown(marketData.narrative.summary_paragraph);
      html += `<div class="card" style="margin-bottom:12px"><div class="intel-body">${rendered}</div></div>`;
    }
    // Central banks
    if (marketData?.central_banks) {
      ['fed', 'boc'].forEach(bank => {
        const label = bank === 'fed' ? 'Federal Reserve' : 'Bank of Canada';
        const text = marketData.central_banks[bank];
        if (text) html += `<div class="card" style="margin-bottom:8px"><div class="card-title">${label}</div><div style="font-size:0.875rem;color:var(--text-secondary);line-height:1.65">${Utils.esc(text.substring(0, 500))}</div></div>`;
      });
    }
    // Insider trades
    if (marketData?.insider_trades?.length) {
      html += '<div class="card" style="margin-bottom:12px"><div class="card-title">Insider Trading Signals</div><div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Signal</th><th>Ratio</th></tr></thead><tbody>';
      marketData.insider_trades.slice(0, 10).forEach(i => {
        html += `<tr><td><strong>${Utils.esc(i.ticker)}</strong></td><td><span class="badge ${i.signal?.includes('BULLISH') ? 'badge-green' : 'badge-red'}">${Utils.esc(i.signal)}</span></td><td>${i.ratio?.toFixed(1) || '—'}</td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }
    // Earnings this week
    if (marketData?.market_news?.earnings?.length) {
      const hasEst = marketData.market_news.earnings.filter(e => e.epsEstimate != null);
      if (hasEst.length) {
        html += '<div class="card" style="margin-bottom:12px"><div class="card-title">Earnings This Week</div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Ticker</th><th>Estimate</th></tr></thead><tbody>';
        hasEst.slice(0, 8).forEach(e => {
          html += `<tr><td>${Utils.esc(e.date || '')}</td><td><strong>${Utils.esc(e.symbol || e.ticker || '')}</strong></td><td>${e.epsEstimate != null ? '$' + Number(e.epsEstimate).toFixed(2) : '—'}</td></tr>`;
        });
        html += '</tbody></table></div></div>';
      }
    }
    html += '</div>';

    // ── TAB 2: News (Geopolitical + Market News) ──
    html += '<div class="research-pane" id="tab-news" style="display:none">';
    if (marketData?.geopolitical?.length) {
      html += '<div class="card" style="margin-bottom:12px"><div class="card-title">Geopolitical Risks</div>';
      marketData.geopolitical.slice(0, 12).forEach(g => {
        html += `<div style="padding:8px 0;border-bottom:1px solid var(--border-subtle);font-size:0.9rem"><a href="${Utils.esc(Utils.safeUrl(g.url))}" target="_blank" rel="noopener" style="color:var(--text-primary);text-decoration:none;font-weight:500">${Utils.esc(g.title)}</a><div style="color:var(--text-muted);font-size:0.75rem">${Utils.esc(g.source)}</div></div>`;
      });
      html += '</div>';
    }
    if (marketData?.market_news?.headlines?.length) {
      html += '<div class="card"><div class="card-title">Market News</div>';
      marketData.market_news.headlines.forEach(n => {
        html += `<div style="padding:8px 0;border-bottom:1px solid var(--border-subtle);font-size:0.9rem"><a href="${Utils.esc(Utils.safeUrl(n.url))}" target="_blank" rel="noopener" style="color:var(--text-primary);text-decoration:none;font-weight:500">${Utils.esc(n.title)}</a><div style="color:var(--text-muted);font-size:0.75rem">${Utils.esc(n.source || '')} ${n.category ? '· ' + Utils.esc(n.category) : ''}</div></div>`;
      });
      html += '</div>';
    }
    if (marketData?.market_news?.analyst_ratings?.length) {
      html += '<div class="card" style="margin-top:12px"><div class="card-title">Analyst Ratings</div><div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Strong Buy</th><th>Buy</th><th>Hold</th><th>Sell</th><th>Strong Sell</th></tr></thead><tbody>';
      marketData.market_news.analyst_ratings.forEach(a => {
        html += `<tr><td><strong>${Utils.esc(a.ticker)}</strong></td><td><span class="badge badge-green">${a.strongBuy || 0}</span></td><td style="color:var(--green)">${a.buy || 0}</td><td style="color:var(--yellow)">${a.hold || 0}</td><td style="color:var(--red)">${a.sell || 0}</td><td><span class="badge badge-red">${a.strongSell || 0}</span></td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }
    html += '</div>';

    // ── TAB 3: Reddit Sentiment ──
    html += '<div class="research-pane" id="tab-reddit" style="display:none">';
    if (redditData) {
      for (const [key, label] of [['wsb', 'r/wallstreetbets'], ['stocks', 'r/stocks']]) {
        const src = redditData[key];
        if (!src) continue;
        const isBearish = src.sentiment_summary?.includes('BEARISH');
        const moodEmoji = isBearish ? '🔴' : '🟢';
        html += `<div class="card" style="margin-bottom:12px"><div class="card-title">${moodEmoji} ${label}</div>`;
        if (src.sentiment_summary) html += `<div style="font-size:0.85rem;color:var(--text-secondary);white-space:pre-wrap;margin-bottom:8px">${Utils.esc(src.sentiment_summary.substring(0, 400))}</div>`;
        if (src.top_tickers?.length) {
          html += '<div style="font-size:0.85rem;margin-bottom:8px"><strong>Tickers:</strong> ';
          html += src.top_tickers.map(t => `<span class="badge badge-green" style="margin:1px">${Utils.esc(t.ticker)} (${t.count})</span>`).join(' ');
          html += '</div>';
        }
        if (src.hot_posts?.length) {
          src.hot_posts.slice(0, 8).forEach(p => {
            const tics = (p.tickers || []).join(', ');
            html += `<div style="padding:6px 0;border-bottom:1px solid var(--border-subtle);font-size:0.85rem"><a href="${Utils.esc(p.url)}" target="_blank" rel="noopener" style="color:var(--text-primary);text-decoration:none">${Utils.esc(p.title.substring(0, 100))}</a><div style="color:var(--text-muted);font-size:0.75rem">▲${p.ups} ${tics ? '· ' + tics : ''}</div></div>`;
          });
        }
        html += '</div>';
      }
    } else {
      html += '<div class="empty-state">Reddit sentiment data not available</div>';
    }
    html += '</div>';

    // ── TAB 4: Analysis Ideas (Seeking Alpha + Options Flow) ──
    html += '<div class="research-pane" id="tab-analysis" style="display:none">';
    if (analysisData?.analysis_ideas?.length) {
      html += '<div class="card" style="margin-bottom:12px"><div class="card-title">Analysis Ideas</div>';
      analysisData.analysis_ideas.forEach(idea => {
        html += `<div style="padding:10px 0;border-bottom:1px solid var(--border-subtle)">`;
        html += `<div><span class="badge ${idea.type === 'BULLISH_CONVERGENCE' ? 'badge-green' : idea.type === 'BEARISH_CONVERGENCE' ? 'badge-red' : 'badge-yellow'}">${idea.type.replace(/_/g, ' ')}</span></div>`;
        html += `<div style="font-size:0.9rem;color:var(--text-primary);margin:4px 0"><strong>${(idea.tickers || []).join(', ')}</strong></div>`;
        html += `<div style="font-size:0.85rem;color:var(--text-secondary)">${Utils.esc(idea.signal || '')}</div>`;
        html += `<div style="font-size:0.85rem;color:var(--accent)">${Utils.esc(idea.action || '')}</div>`;
        html += `</div>`;
      });
      html += '</div>';
    }
    if (analysisData?.options_flow) {
      const flow = analysisData.options_flow;
      html += `<div class="card" style="margin-bottom:12px"><div class="card-title">Options Flow Summary</div>`;
      html += `<div style="font-size:0.85rem;color:var(--text-secondary)">Total unusual contracts: ${flow.total_unusual_contracts || 0} · Call/Put ratio: ${flow.call_put_ratio || '—'}</div>`;
      if (flow.top_overbought_calls?.length) {
        html += '<div style="margin-top:8px"><strong>Calls</strong></div>';
        flow.top_overbought_calls.slice(0, 5).forEach(o => {
          html += `<div style="font-size:0.85rem;padding:4px 0">${Utils.esc(o.ticker)} $${Utils.esc(o.strike)} · ${o.vol_oi_ratio}x OI · $${(o.premium / 1000000).toFixed(1)}M</div>`;
        });
      }
      if (flow.top_overbought_puts?.length) {
        html += '<div style="margin-top:8px"><strong>Puts</strong></div>';
        flow.top_overbought_puts.slice(0, 5).forEach(o => {
          html += `<div style="font-size:0.85rem;padding:4px 0">${Utils.esc(o.ticker)} $${Utils.esc(o.strike)} · ${o.vol_oi_ratio}x OI · $${(o.premium / 1000000).toFixed(1)}M</div>`;
        });
      }
      html += '</div>';
    }
    if (analysisData?.market_overview?.top_headlines?.length) {
      html += '<div class="card"><div class="card-title">Seeking Alpha Top Stories</div>';
      analysisData.market_overview.top_headlines.slice(0, 10).forEach(h => {
        html += `<div style="font-size:0.85rem;padding:6px 0;border-bottom:1px solid var(--border-subtle)">${Utils.esc(h)}</div>`;
      });
      html += '</div>';
    }
    html += '</div>';

    // ── TAB 5: Backtest Research (old content) ──
    html += '<div class="research-pane" id="tab-backtest" style="display:none">';
    html += await this._renderBacktest();
    html += '</div>';

    html += '</div></div>';
    app.innerHTML = html;

    // Wire tab switching
    app.querySelectorAll('.research-tab').forEach(tab => {
      tab.addEventListener('click', function() {
        app.querySelectorAll('.research-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        app.querySelectorAll('.research-pane').forEach(p => p.style.display = 'none');
        const pane = app.querySelector('#tab-' + this.dataset.tab);
        if (pane) pane.style.display = 'block';
      });
    });
  },

  async _renderBacktest() {
    const wf = await Utils.fetchJSON('/data/walk_forward_v2.json').catch(() => null);
    let html = '<div class="card" style="margin-bottom:12px"><div class="card-title">Research-Backed Backtest Validation</div>';
    html += '<div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6">';
    html += '<strong>López de Prado — The False Strategy Theorem:</strong> If you run 100 backtests on random data, 5-10 will show positive returns by pure chance. We apply a ~30% Sharpe degradation factor — our IS Sharpe of 2.22 is expected to live-trade around 1.55.';
    if (wf && wf.summary) {
      const mr = wf.summary.mean_reversion || {};
      html += ' Walk-forward confirms: OOS Sharpe of ' + (mr.avg_oos_sharpe || '?').toFixed(2) + ' vs IS ' + (mr.avg_is_sharpe || '?').toFixed(2) + ' for mean reversion.';
    }
    html += '</div></div>';
    if (wf && wf.summary) {
      html += '<div class="card"><div class="card-title">Walk-Forward Results</div><div class="table-wrap"><table><thead><tr><th>Strategy</th><th>IS Sharpe</th><th>OOS Sharpe</th><th>Degradation</th><th>OOS Trades</th></tr></thead><tbody>';
      Object.entries(wf.summary).forEach(([key, s]) => {
        if (s.avg_is_sharpe != null) {
          html += `<tr><td><strong>${Utils.esc(key)}</strong></td><td>${s.avg_is_sharpe.toFixed(2)}</td><td>${s.avg_oos_sharpe.toFixed(2)}</td><td class="${s.avg_degradation_pct >= 0 ? 'positive' : 'negative'}">${s.avg_degradation_pct != null ? s.avg_degradation_pct.toFixed(1) + '%' : '—'}</td><td>${s.total_oos_trades || '—'}</td></tr>`;
        }
      });
      html += '</tbody></table></div></div>';
    }
    return html;
  }
};
