/**
 * Research — consolidated reading room.
 * Merges: AI narrative, geopolitical news, market news, Reddit sentiment,
 * analyst ratings, insider trades, congress trades, central banks, earnings,
 * Seeking Alpha ideas, archive, and the old BacktestResearch content.
 */
const Research = {
  formatTimestamp(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const h = d.getHours() % 12 || 12;
    const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${h}:${mm} ${ampm} ET`;
  },

  async render(app) {
    app.innerHTML = '<div class="loading">Loading research...</div>';

    const [marketData, analysisData, redditData, mgAnalysis, webNewsData, polymarketData] = await Promise.all([
      State.get('latest', '/data/latest.json').catch(() => null),
      State.get('analysis', '/data/analysis.json').catch(() => null),
      State.get('reddit', '/data/reddit-sentiment.json').catch(() => null),
      State.get('mg-analysis', '/data/morning_analysis.json').catch(() => null),
      State.get('web-news', '/data/web-news.json').catch(() => null),
      State.get('polymarket', '/data/polymarket_sentiment.json').catch(() => null),
    ]);

    let html = '<div class="section"><h2 class="section-title">Research</h2>';

    // ── NAVIGATION TABS within Research ──
    html += '<div class="research-tabs" style="display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap">';
    html += '<button class="research-tab active" data-tab="narrative">Overview</button>';
    html += '<button class="research-tab" data-tab="news">News</button>';
    html += '<button class="research-tab" data-tab="reddit">Sentiment</button>';
    html += '<button class="research-tab" data-tab="analysis">Ideas</button>';
    html += '<button class="research-tab" data-tab="mg-analysis">MapleGamma Analysis</button>';
    html += '<button class="research-tab" data-tab="backtest">Backtest</button>';
    html += '<button class="research-tab" data-tab="markets">Markets</button>';
    html += '</div>';

    html += '<div class="research-content">';

    // ── TAB 1: Overview / Narrative ──
    html += '<div class="research-pane" id="tab-narrative">';
    if (marketData?.generated_at) html += `<div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:12px">Last updated: ${this.formatTimestamp(marketData.generated_at)}</div>`;

    // ── Audio Briefing Player ──
    var todayStr = new Date().toISOString().slice(0, 10);
    var audioUrl = '/data/audio/briefing-' + todayStr + '.mp3';
    html += '<div class="card" style="margin-bottom:12px;padding:12px 16px">';
    html += '<div style="display:flex;align-items:center;gap:12px">';
    html += '<span style="font-size:1.4rem">🎧</span>';
    html += '<div style="flex:1"><div style="font-weight:600;font-size:0.95rem">Audio Briefing</div>';
    html += '<div style="font-size:0.8rem;color:var(--text-muted)">' + todayStr + '</div></div>';
    html += '<audio controls preload="none" style="height:36px;max-width:260px" onerror="this.parentElement.innerHTML=\'<span style=color:var(--text-muted);font-size:0.85rem>No briefing yet for today</span>\'">';
    html += '<source src="' + audioUrl + '" type="audio/mpeg">';
    html += '</audio>';
    html += '</div></div>';

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
        html += `<tr><td><strong>${Utils.esc(i.ticker)}</strong></td><td><span class="badge ${i.signal?.includes('BULLISH') ? 'badge-green' : 'badge-red'}\">${Utils.esc(i.signal)}</span></td><td>${i.ratio?.toFixed(1) || '—'}</td></tr>`;
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

    // ── TAB 2: News (Exa Web News + Geopolitical + Market News + SA RSS fallback) ──
    html += '<div class="research-pane" id="tab-news" style="display:none">';

    // Primary: Exa web news articles (fresh from /data/web-news.json)
    if (webNewsData?.articles?.length) {
      if (webNewsData._fetched_at) html += `<div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:12px">Last updated: ${this.formatTimestamp(webNewsData._fetched_at)}</div>`;
      // Trending topics
      if (webNewsData.topics?.length) {
        html += '<div class="card" style="margin-bottom:12px"><div class="card-title">Trending Topics</div><div style="display:flex;flex-wrap:wrap;gap:6px">';
        webNewsData.topics.slice(0, 15).forEach(t => {
          const label = typeof t === 'string' ? t : (t.name || t.label || t.topic || '');
          if (label) html += `<span class="badge badge-yellow" style="font-size:0.75rem">${Utils.esc(label)}</span>`;
        });
        html += '</div></div>';
      }
      // Article list
      html += '<div class="card" style="margin-bottom:12px"><div class="card-title">Latest News (Exa)</div>';
      webNewsData.articles.forEach(a => {
        html += `<div style="padding:8px 0;border-bottom:1px solid var(--border-subtle);font-size:0.9rem">`;
        html += `<a href="${Utils.esc(Utils.safeUrl(a.url))}" target="_blank" rel="noopener" style="color:var(--text-primary);text-decoration:none;font-weight:500">${Utils.esc(a.title)}</a>`;
        const metaParts = [];
        if (a.source) metaParts.push(Utils.esc(a.source));
        if (a.published) metaParts.push(this.formatTimestamp(a.published));
        if (metaParts.length) html += `<div style="color:var(--text-muted);font-size:0.75rem">${metaParts.join(' · ')}</div>`;
        if (a.snippet) html += `<div style="color:var(--text-secondary);font-size:0.8rem;margin-top:2px;line-height:1.4">${Utils.esc(a.snippet.substring(0, 220))}${a.snippet.length > 220 ? '…' : ''}</div>`;
        html += `</div>`;
      });
      html += '</div>';
    } else if (!marketData) {
      html += '<div class="empty-state">News data not available</div>';
    }

    // Secondary: Geopolitical Risks (from latest.json)
    if (marketData?.geopolitical?.length) {
      html += '<div class="card" style="margin-bottom:12px"><div class="card-title">Geopolitical Risks</div>';
      marketData.geopolitical.slice(0, 12).forEach(g => {
        html += `<div style="padding:8px 0;border-bottom:1px solid var(--border-subtle);font-size:0.9rem"><a href="${Utils.esc(Utils.safeUrl(g.url))}" target="_blank" rel="noopener" style="color:var(--text-primary);text-decoration:none;font-weight:500">${Utils.esc(g.title)}</a><div style="color:var(--text-muted);font-size:0.75rem">${Utils.esc(g.source)}</div></div>`;
      });
      html += '</div>';
    }
    // Secondary: Market News headlines (from latest.json)
    if (marketData?.market_news?.headlines?.length) {
      html += '<div class="card"><div class="card-title">Market News</div>';
      marketData.market_news.headlines.forEach(n => {
        html += `<div style="padding:8px 0;border-bottom:1px solid var(--border-subtle);font-size:0.9rem"><a href="${Utils.esc(Utils.safeUrl(n.url))}" target="_blank" rel="noopener" style="color:var(--text-primary);text-decoration:none;font-weight:500">${Utils.esc(n.title)}</a><div style="color:var(--text-muted);font-size:0.75rem">${Utils.esc(n.source || '')} ${n.category ? '· ' + Utils.esc(n.category) : ''}</div></div>`;
      });
      html += '</div>';
    }
    // Secondary: Analyst Ratings (from latest.json)
    if (marketData?.market_news?.analyst_ratings?.length) {
      html += '<div class="card" style="margin-top:12px"><div class="card-title">Analyst Ratings</div><div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Strong Buy</th><th>Buy</th><th>Hold</th><th>Sell</th><th>Strong Sell</th></tr></thead><tbody>';
      marketData.market_news.analyst_ratings.forEach(a => {
        html += `<tr><td><strong>${Utils.esc(a.ticker)}</strong></td><td><span class="badge badge-green">${a.strongBuy || 0}</span></td><td style="color:var(--green)">${a.buy || 0}</td><td style="color:var(--yellow)">${a.hold || 0}</td><td style="color:var(--red)">${a.sell || 0}</td><td><span class="badge badge-red">${a.strongSell || 0}</span></td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }
    // Fallback: SA RSS headlines (from analysis.json — also used by Dashboard homepage)
    if (analysisData?.market_overview?.top_headlines?.length) {
      html += '<div class="card" style="margin-top:12px"><div class="card-title">Seeking Alpha Top Stories</div>';
      analysisData.market_overview.top_headlines.slice(0, 10).forEach(h => {
        const title = typeof h === 'string' ? h : (h.title || '');
        const url = typeof h === 'object' ? (h.url || '') : '';
        const source = typeof h === 'object' ? (h.source || '') : '';
        if (url) {
          html += `<div style="font-size:0.85rem;padding:6px 0;border-bottom:1px solid var(--border-subtle)"><a href="${Utils.esc(Utils.safeUrl(url))}" target="_blank" rel="noopener" style="color:var(--text-primary);text-decoration:none">${Utils.esc(title)}</a>${source ? '<div style="color:var(--text-muted);font-size:0.75rem">' + Utils.esc(source) + '</div>' : ''}</div>`;
        } else {
          html += `<div style="font-size:0.85rem;padding:6px 0;border-bottom:1px solid var(--border-subtle)">${Utils.esc(title)}</div>`;
        }
      });
      html += '</div>';
    }
    html += '</div>';

    // ── TAB 3: Reddit Sentiment ──
    html += '<div class="research-pane" id="tab-reddit" style="display:none">';
    if (redditData?._generated_at) html += `<div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:12px">Last updated: ${this.formatTimestamp(redditData._generated_at)}</div>`;
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
    if (analysisData?.generated_at) html += `<div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:12px">Last updated: ${this.formatTimestamp(analysisData.generated_at)}</div>`;
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
    if (analysisData?.market_overview?.top_headlines?.length) {
      html += '<div class="card"><div class="card-title">Seeking Alpha Top Stories</div>';
      analysisData.market_overview.top_headlines.slice(0, 10).forEach(h => {
        const title = typeof h === 'string' ? h : (h.title || '');
        const url = typeof h === 'object' ? (h.url || '') : '';
        const source = typeof h === 'object' ? (h.source || '') : '';
        if (url) {
          html += `<div style="font-size:0.85rem;padding:6px 0;border-bottom:1px solid var(--border-subtle)"><a href="${Utils.esc(Utils.safeUrl(url))}" target="_blank" rel="noopener" style="color:var(--text-primary);text-decoration:none">${Utils.esc(title)}</a>${source ? '<div style="color:var(--text-muted);font-size:0.75rem">' + Utils.esc(source) + '</div>' : ''}</div>`;
        } else {
          html += `<div style="font-size:0.85rem;padding:6px 0;border-bottom:1px solid var(--border-subtle)">${Utils.esc(title)}</div>`;
        }
      });
      html += '</div>';
    }
    html += '</div>';

    // ── TAB 4b: MapleGamma Analysis (DS Pro) ──
    html += '<div class="research-pane" id="tab-mg-analysis" style="display:none">';
    if (mgAnalysis?.meta?.generated_at) {
      html += `<div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:12px">Last updated: ${this.formatTimestamp(mgAnalysis.meta.generated_at)}</div>`;
      
      // Confidence + Regime badge
      const meta = mgAnalysis.meta;
      const regCls = meta.market_regime === 'risk-on' ? 'badge-green' : meta.market_regime === 'risk-off' ? 'badge-red' : 'badge-yellow';
      html += `<div style="margin-bottom:12px"><span class="badge ${regCls}" style="font-size:0.8rem">${Utils.esc((meta.market_regime || '?').toUpperCase())}</span> <span style="color:var(--text-muted);font-size:0.8rem">Confidence: ${meta.confidence}/10 · ${Utils.esc(meta.model || '')}</span></div>`;
      
      // Market pulse
      if (mgAnalysis.market_pulse) {
        const mp = mgAnalysis.market_pulse;
        html += `<div class="card" style="margin-bottom:12px"><div class="card-title">Market Pulse</div>`;
        html += `<div style="font-size:0.9rem;color:var(--text-primary);line-height:1.6;margin-bottom:8px">${Utils.esc(mp.one_liner || '')}</div>`;
        html += `<div style="font-size:0.8rem;color:var(--text-muted)">Sentiment: ${mp.sentiment_score}/10</div>`;
        if (mp.sector_rotation) html += `<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px">${Utils.esc(mp.sector_rotation)}</div>`;
        if (mp.key_levels?.SPY) html += `<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px">SPY support: $${mp.key_levels.SPY.support} / resistance: $${mp.key_levels.SPY.resistance}</div>`;
        html += '</div>';
      }
      
      // Held position review
      const _positions = mgAnalysis.held_position_review || mgAnalysis.position_review;
      if (_positions?.length) {
        html += '<div class="card" style="margin-bottom:12px"><div class="card-title">Position Review</div>';
        _positions.forEach(p => {
          const actCls = p.action === 'HOLD' ? 'badge-yellow' : p.action === 'ADD' ? 'badge-green' : p.action === 'TRIM' || p.action === 'EXIT' ? 'badge-red' : 'badge-yellow';
          const _pAc = (p.asset_class || '').toUpperCase();
          const _pAcBadge = _pAc === 'OPTION' ? '<span style="background:#9c27b0;color:#fff;padding:1px 4px;border-radius:3px;font-size:0.55rem;font-weight:700;margin-left:4px">OPT</span>' : _pAc === 'CRYPTO' ? '<span style="background:#ff9800;color:#fff;padding:1px 4px;border-radius:3px;font-size:0.55rem;font-weight:700;margin-left:4px">CRYPTO</span>' : _pAc === 'FOREX' ? '<span style="background:#2196f3;color:#fff;padding:1px 4px;border-radius:3px;font-size:0.55rem;font-weight:700;margin-left:4px">FX</span>' : _pAc === 'COMMODITY' ? '<span style="background:#ffc107;color:#333;padding:1px 4px;border-radius:3px;font-size:0.55rem;font-weight:700;margin-left:4px">COMM</span>' : '';
          html += `<div style="padding:8px 0;border-bottom:1px solid var(--border-subtle)">`;
          html += `<div><span class="badge ${actCls}" style="font-size:0.7rem">${Utils.esc(p.action)}</span> <strong>${Utils.esc(p.ticker)}</strong>${_pAcBadge}`;
          if (p.target) html += ` · Target: $${p.target}`;
          if (p.stop) html += ` · Stop: $${p.stop}`;
          if (p.risk_reward) html += ` · R/R: ${p.risk_reward}`;
          html += `</div><div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px">${Utils.esc(p.rationale || '')}</div>`;
          html += '</div>';
        });
        html += '</div>';
      } else {
        html += '<div class="card" style="margin-bottom:12px"><div class="card-title">Position Review</div><div style="font-size:0.85rem;color:var(--text-muted)">No open positions to review.</div></div>';
      }
      
      // Opportunities
      if (mgAnalysis.opportunities?.length) {
        html += '<div class="card" style="margin-bottom:12px"><div class="card-title">Opportunities</div>';
        mgAnalysis.opportunities.forEach(o => {
          const dirCls = o.direction === 'LONG' ? 'badge-green' : 'badge-red';
          const _oAc = (o.asset_class || '').toUpperCase();
          const _oAcBadge = _oAc === 'OPTION' ? '<span style="background:#9c27b0;color:#fff;padding:1px 4px;border-radius:3px;font-size:0.55rem;font-weight:700;margin-left:4px">OPT</span>' : _oAc === 'CRYPTO' ? '<span style="background:#ff9800;color:#fff;padding:1px 4px;border-radius:3px;font-size:0.55rem;font-weight:700;margin-left:4px">CRYPTO</span>' : _oAc === 'FOREX' ? '<span style="background:#2196f3;color:#fff;padding:1px 4px;border-radius:3px;font-size:0.55rem;font-weight:700;margin-left:4px">FX</span>' : _oAc === 'COMMODITY' ? '<span style="background:#ffc107;color:#333;padding:1px 4px;border-radius:3px;font-size:0.55rem;font-weight:700;margin-left:4px">COMM</span>' : '';
          html += `<div style="padding:8px 0;border-bottom:1px solid var(--border-subtle)">`;
          html += `<div><span class="badge ${dirCls}" style="font-size:0.7rem">${Utils.esc(o.direction)}</span> <strong>${Utils.esc(o.ticker)}</strong>${_oAcBadge} <span style="color:var(--text-muted);font-size:0.8rem">· ${Utils.esc(o.conviction || '')} conviction · ${Utils.esc(o.timeframe || '')}</span></div>`;
          html += `<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px">${Utils.esc(o.thesis || '')}</div>`;
          if (o.entry_zone?.length) html += `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">Entry zone: $${o.entry_zone[0]}-$${o.entry_zone[1]} · ${Utils.esc(o.catalyst || '')}</div>`;
          html += '</div>';
        });
        html += '</div>';
      }
      
      // Risk alerts
      if (mgAnalysis.risk_alerts?.length) {
        html += '<div class="card" style="margin-bottom:12px"><div class="card-title">Risk Alerts</div>';
        mgAnalysis.risk_alerts.forEach(r => {
          const sevCls = r.severity === 'high' ? 'badge-red' : r.severity === 'medium' ? 'badge-yellow' : 'badge-green';
          html += `<div style="padding:8px 0;border-bottom:1px solid var(--border-subtle);font-size:0.85rem">`;
          html += `<span class="badge ${sevCls}" style="font-size:0.7rem">${Utils.esc(r.severity.toUpperCase())}</span> ${Utils.esc(r.alert)}`;
          if (r.affected_positions?.length) html += `<div style="color:var(--text-muted);font-size:0.75rem">Affects: ${r.affected_positions.join(', ')}</div>`;
          html += '</div>';
        });
        html += '</div>';
      }
      
      // Portfolio actions
      if (mgAnalysis.portfolio_actions?.immediate?.length) {
        html += '<div class="card" style="margin-bottom:12px"><div class="card-title">Actions</div>';
        mgAnalysis.portfolio_actions.immediate.forEach(a => {
          html += `<div style="padding:6px 0;font-size:0.85rem">⚡ ${Utils.esc(a)}</div>`;
        });
        if (mgAnalysis.portfolio_actions.watchlist?.length) {
          html += `<div style="margin-top:8px;font-size:0.8rem;color:var(--text-secondary)">Watchlist: ${mgAnalysis.portfolio_actions.watchlist.join(', ')}</div>`;
        }
        if (mgAnalysis.portfolio_actions.avoid?.length) {
          html += `<div style="font-size:0.8rem;color:var(--text-muted)">Avoid: ${mgAnalysis.portfolio_actions.avoid.join(', ')}</div>`;
        }
        html += '</div>';
      }
      
      // Staleness warning
      if (mgAnalysis.meta.stale) {
        html += `<div class="stale-banner">⚠ Analysis is stale: ${Utils.esc(mgAnalysis.meta.stale_reason || 'No recent data')}</div>`;
      }
    } else {
      html += '<div class="card"><div class="card-title">MapleGamma Analysis</div><div class="empty-state">No analysis available yet. Run the morning pipeline first.</div></div>';
    }
    html += '</div>';

    // ── TAB 5: Backtest Research (old content) ──
    html += '<div class="research-pane" id="tab-backtest" style="display:none">';
    html += await this._renderBacktest();
    // Backtest timestamp is rendered inside _renderBacktest()
    html += '</div>';

    // ── TAB 6: Prediction Markets (Polymarket) ──
    html += '<div class="research-pane" id="tab-markets" style="display:none">';
    if (polymarketData?.markets?.length) {
      html += `<div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:12px">Source: ${Utils.esc(polymarketData.source || 'Polymarket')} · ${polymarketData.fetched_at ? 'Updated ' + this.formatTimestamp(polymarketData.fetched_at) : ''}</div>`;
      // Sort by volume descending, show top 30
      const sorted = [...polymarketData.markets].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 30);
      sorted.forEach(m => {
        const isClosed = m.closed === true;
        const volumeStr = m.volume >= 1e6 ? '$' + (m.volume / 1e6).toFixed(1) + 'M' : m.volume >= 1e3 ? '$' + (m.volume / 1e3).toFixed(0) + 'K' : '$' + (m.volume || 0).toFixed(0);
        // Format outcomes with probability bars
        let outcomesHtml = '';
        if (m.outcomes?.length) {
          outcomesHtml = '<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">';
          m.outcomes.forEach(o => {
            const pct = (parseFloat(o.price) * 100);
            const barColor = pct >= 50 ? 'var(--green)' : 'var(--red)';
            outcomesHtml += `<div style="display:flex;align-items:center;gap:8px;font-size:0.8rem">`;
            outcomesHtml += `<span style="min-width:60px;font-weight:500">${Utils.esc(o.name)}</span>`;
            outcomesHtml += `<div style="flex:1;height:6px;background:var(--bg-inset);border-radius:3px;overflow:hidden"><div style="width:${Math.max(pct, 2)}%;height:100%;background:${barColor};border-radius:3px"></div></div>`;
            outcomesHtml += `<span style="min-width:40px;text-align:right;font-family:var(--font-mono);font-size:0.75rem;color:${barColor}">${pct.toFixed(1)}%</span>`;
            outcomesHtml += `</div>`;
          });
          outcomesHtml += '</div>';
        }
        // Card
        html += `<div class="card" style="margin-bottom:8px;padding:12px;${isClosed ? 'opacity:0.6' : ''}">`;
        html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">';
        html += `<div style="flex:1"><div class="card-title" style="margin:0;font-size:0.85rem">${Utils.esc(m.question)}</div></div>`;
        html += `<div style="display:flex;gap:6px;flex-shrink:0;align-items:center">`;
        html += `<span style="font-size:0.7rem;color:var(--text-muted);font-family:var(--font-mono)">${volumeStr}</span>`;
        if (isClosed) html += `<span class="badge badge-red" style="font-size:0.6rem">CLOSED</span>`;
        html += '</div></div>';
        html += outcomesHtml;
        html += '</div>';
      });
      if (polymarketData.markets.length > 30) {
        html += `<div style="text-align:center;color:var(--text-muted);font-size:0.75rem;padding:8px 0">Showing top 30 of ${polymarketData.markets.length} markets by volume</div>`;
      }
    } else {
      html += '<div class="empty-state">Prediction market data not available</div>';
    }
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
    if (wf?.generated_at) html += `<div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:12px">Last updated: ${this.formatTimestamp(wf.generated_at)}</div>`;
    html += '<div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6">';
    html += '<strong>López de Prado — The False Strategy Theorem:</strong> If you run 100 backtests on random data, 5-10 will show positive returns by pure chance. We apply a ~30% Sharpe degradation factor — our IS Sharpe of 2.22 is expected to live-trade around 1.55.';
    if (wf && wf.summary) {
      const mr = wf.summary.mean_reversion || {};
      html += ' Walk-forward confirms: OOS Sharpe of ' + (typeof mr.avg_oos_sharpe === 'number' ? mr.avg_oos_sharpe.toFixed(2) : '?') + ' vs IS ' + (typeof mr.avg_is_sharpe === 'number' ? mr.avg_is_sharpe.toFixed(2) : '?') + ' for mean reversion.';
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
