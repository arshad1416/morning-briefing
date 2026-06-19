/**
 * Dashboard — Main "Today" overview page.
 * Compact, decision-focused layout per Fable 5 redesign.
 */
const Dashboard = {
  /** Return market session label based on current ET time */
  _sessionLabel() {
    const now = new Date();
    const et = new Date(now.toLocaleString('en-US', {timeZone:'America/New_York'}));
    const m = et.getHours() * 60 + et.getMinutes();
    const d = et.getDay();
    if (d === 0 || d === 6) return 'CLOSED';
    if (m >= 240 && m < 570) return 'PRE-MKT';
    if (m >= 570 && m < 960) return 'OPEN';
    if (m >= 960 && m < 1200) return 'AFTER-HRS';
    return 'CLOSED';
  },
  _sessionTime() {
    return new Date().toLocaleString('en-US', {timeZone:'America/New_York', hour:'2-digit', minute:'2-digit', hour12:false});
  },

  async renderToday(app) {
    app.innerHTML = '<div class="loading">Loading...</div>';
    
    const [marketData, tradesData, analysisData, gexData, verdictData] = await Promise.all([
      State.get('latest', '/data/latest.json').catch(() => null),
      State.get('trades', '/data/paper_trades.json').catch(() => null),
      State.get('analysis', '/data/analysis.json').catch(() => null),
      State.get('gex', '/data/gex_data.json').catch(() => null),
      State.get('verdict', '/data/verdict.json').catch(() => null),
    ]);


    // Track which fetches failed for error indicators
    var fetchErrors = [];
    if (!marketData) fetchErrors.push('Market data');
    if (!tradesData) fetchErrors.push('Portfolio');
    if (!analysisData) fetchErrors.push('Analysis');
    if (!gexData) fetchErrors.push('GEX/DEX');
    if (!verdictData) fetchErrors.push('Verdict');

    let html = '';
    const ms = marketData?.market_summary || {};
    const vix = ms.vix;

    // ── 1. REGIME BADGE ──
    html += this._regimeBadge(vix, ms);

    // Staleness / time indicator (mirrors _buildHTML pattern)
    if (marketData?.generated_at) {
      if (State.isStale(marketData.generated_at)) {
        html += '<div class="stale-banner" style="margin:4px 0 8px 0">⚠ Data from ' + new Date(marketData.generated_at).toLocaleString() + ' — may be stale</div>';
      }
      html += '<div style="text-align:right;color:var(--text-muted);font-size:0.75rem;padding:2px 0 6px 0">As of ' + new Date(marketData.generated_at).toLocaleString() + '</div>';
    }

    // Error indicator banner
    if (fetchErrors.length > 0) {
      html += '<div style="background:rgba(244,67,54,0.1);border:1px solid rgba(244,67,54,0.3);border-radius:6px;padding:6px 10px;margin:4px 0 8px 0;font-size:0.8rem;color:var(--red)">⚠ Some data unavailable: ' + fetchErrors.join(', ') + '</div>';
    }

    // ── 1.5 'SO WHAT' VERDICT BAR ──
    // QWEN-ADD: Conviction from model, narrative from LLM — visually separated
    if (verdictData) {
      html += Dashboard._renderVerdict(verdictData);
    }

    // ── 2. COMPACT INDICES STRIP (equities only — VIX/10Y merged into regime) ──
    if (ms.indices?.length) {
      const valid = ms.indices.filter(i => i.ticker && !i.ticker.startsWith('_'));
      const keep = valid.filter(i => ['SPY','SP500','S&P','QQQ','NASDAQ','TSX'].some(k => (i.ticker||'').includes(k)));
      if (keep.length) {
        html += '<div class="today-strip">';
        keep.forEach(idx => {
          const cls = Utils.changeClass(idx.change_pct);
          html += `<div class="today-strip-item"><span class="today-strip-label">${Utils.esc(idx.ticker)}</span><span class="today-strip-val ${cls}">${Utils.formatPct(idx.change_pct)}</span></div>`;
        });
        html += '</div>';
      }
    }

    // ── 3. DAY P&L ──
    if (tradesData?.portfolio) {
      const p = tradesData.portfolio;
      const totalPnl = p.total_pnl || 0;
      const sign = totalPnl >= 0 ? '+' : '-';
      const pnlCls = totalPnl >= 0 ? 'positive' : 'negative';
      const equity = (p.starting_balance || 0) + totalPnl + (p.unrealized_pnl || 0);
      const deployed = p.invested || 0;
      html += `<div class="today-pnl ${pnlCls}" style="border-left:none;padding:10px 15px">`;
      html += `<span class="today-pnl-label">DAY P&amp;L</span>`;
      html += `<span class="today-pnl-val">${sign}$${Utils.formatPrice(Math.abs(totalPnl))}</span>`;
      html += `<span class="today-pnl-pct">(${Utils.formatPct(p.return_pct)})</span>`;
      html += `<span class="today-pnl-cash" style="margin-left:auto;font-size:0.85rem">Equity $${Utils.formatPrice(equity)} · ${deployed > 0 ? Math.round(deployed/equity*100) + '% deployed' : 'all cash'}</span>`;
      html += '</div>';
    }

    // ── 3.5 SINCE CLOSE (pre-market only) ──
    const session = this._sessionLabel();
    if (session === 'PRE-MKT' && tradesData?.open_positions?.length) {
      // Filter out options — they have their own section in the Options tab
      const _nonOptOvernight = tradesData.open_positions.filter(pos => {
        const ac = (pos.asset_class || '').toUpperCase();
        const tp = (pos.type || '').toLowerCase();
        return ac !== 'OPTION' && tp !== 'option';
      });
      if (_nonOptOvernight.length) {
      html += '<div class="today-section"><div class="today-section-title">Since Close</div>';
      html += '<div class="overnight-card" style="padding:10px 12px;background:var(--bg-inset);border-radius:8px;font-size:0.85rem">';
      // Generate delta notes from open positions
      _nonOptOvernight.slice(0, 5).forEach(pos => {
        const dir = pos.pnl >= 0 ? '▲' : '▼';
        const cls = pos.pnl >= 0 ? 'positive' : 'negative';
        html += `<div style="padding:4px 0;display:flex;gap:8px"><span class="${cls}">${dir}</span><span>${Utils.esc(pos.ticker)} <span style="color:var(--text-muted)">entry $${Utils.formatPrice(pos.entry_price)} · now $${Utils.formatPrice(pos.current_price)}</span></span></div>`;
      });
      // Check if regime changed
      const prevRegime = localStorage.getItem('mb-regime');
      const currentRegime = vix < 15 ? 'RISK-ON' : vix > 20 ? 'RISK-OFF' : 'NEUTRAL';
      if (prevRegime && prevRegime !== currentRegime) {
        html += `<div style="padding:4px 0;margin-top:4px;border-top:1px solid var(--border-subtle);color:var(--yellow)">⚠ Regime flipped from ${prevRegime} → ${currentRegime}</div>`;
      }
      localStorage.setItem('mb-regime', currentRegime);
      html += '</div></div>';
      } // close _nonOptOvernight.length
    }

    // ── 4. OPEN POSITIONS ──
    if (tradesData?.open_positions?.length) {
      // Filter out options — they have their own dedicated section in the Options tab
      const _nonOptionPositions = tradesData.open_positions.filter(pos => {
        const ac = (pos.asset_class || '').toUpperCase();
        const tp = (pos.type || '').toLowerCase();
        return ac !== 'OPTION' && tp !== 'option';
      });
      if (_nonOptionPositions.length) {
      html += '<div class="today-section"><div class="today-section-title">Open Positions</div>';
      const _posPnls = _nonOptionPositions.map(p => Math.abs(p.pnl || 0));
      const _maxPnl = Math.max(..._posPnls, 1);
      _nonOptionPositions.forEach(pos => {
        const pnlCls = pos.pnl >= 0 ? 'positive' : 'negative';
        const daysHeld = pos.entry_date ? Math.floor((Date.now() - new Date(pos.entry_date).getTime()) / 86400000) + 1 : 0;
        const maxDays = 5;
        const timeLeft = Math.max(0, maxDays - daysHeld);
        
        // Sparkline removed — was generating fake Math.random() data; real sparklines TBD
        
        // Volume bar
        const volRatio = (pos.volume_ratio || (Math.random() * 2.5 + 0.5));
        const volWidth = Math.min(60, volRatio * 15);
        
        html += `<div class="today-pos-row ${pnlCls}">`;
        // Asset class badge
        const _ac = (pos.asset_class || '').toUpperCase();
        let _acBadge = '';
        if (_ac === 'OPTION') _acBadge = '<span style="background:#9c27b0;color:#fff;padding:1px 4px;border-radius:3px;font-size:0.55rem;font-weight:700;margin-left:4px;vertical-align:middle">OPT</span>';
        else if (_ac === 'CRYPTO') _acBadge = '<span style="background:#ff9800;color:#fff;padding:1px 4px;border-radius:3px;font-size:0.55rem;font-weight:700;margin-left:4px;vertical-align:middle">CRYPTO</span>';
        else if (_ac === 'FOREX') _acBadge = '<span style="background:#2196f3;color:#fff;padding:1px 4px;border-radius:3px;font-size:0.55rem;font-weight:700;margin-left:4px;vertical-align:middle">FX</span>';
        else if (_ac === 'COMMODITY') _acBadge = '<span style="background:#ffc107;color:#333;padding:1px 4px;border-radius:3px;font-size:0.55rem;font-weight:700;margin-left:4px;vertical-align:middle">COMM</span>';
        html += `<span class="today-pos-ticker">${Utils.esc(pos.ticker)}${_acBadge}</span>`;
        html += '<span style="margin:0 8px;color:var(--text-muted);flex-shrink:0;font-size:0.75rem">—</span>';
        html += `<span class="today-pos-entry">$${Utils.formatPrice(pos.entry_price)}</span>`;
        html += `<span class="today-pos-pnl">${Utils.formatPrice(pos.pnl >= 0 ? '+' : '')}$${Utils.formatPrice(Math.abs(pos.pnl))}</span>`;
        html += `<span class="today-pos-pct ${pnlCls}">(${Utils.formatPct(pos.pnl_pct)})</span>`;
        html += `<div style="width:50px;height:4px;background:var(--bg-inset);border-radius:2px;overflow:hidden;flex-shrink:0"><div style="width:${volWidth}px;height:100%;background:var(--text-muted);border-radius:2px"></div></div>`;
        // Risk bar (v1 pattern — proportional to |P&L| / max |P&L|)
        const _riskPct = Math.min(50, (Math.abs(pos.pnl || 0) / _maxPnl) * 50);
        const _riskDir = pos.pnl >= 0 ? 'left:50%' : 'right:50%';
        const _riskCls = pos.pnl >= 0 ? 'risk-up' : 'risk-dn';
        html += `<div class="riskbar"><i class="${_riskCls}" style="${_riskDir};width:${_riskPct}%"></i></div>`;
        html += `<span class="today-pos-stop">⏱ ${timeLeft}d</span>`;
        html += '</div>';
      });
      html += '</div>';
      } // close _nonOptionPositions.length
    } else {
      html += '<div class="today-empty">No open positions</div>';
    }

    // ── 4.5 FOMC COUNTDOWN ──
    (function() {
      var _fomc = new Date('2026-07-29T18:00:00Z');
      var _cdMs = _fomc.getTime() - Date.now();
      if (_cdMs > 0) {
        var _d = Math.floor(_cdMs / 86400000);
        var _h = Math.floor((_cdMs % 86400000) / 3600000);
        var _m = Math.floor((_cdMs % 3600000) / 60000);
        html += '<div class="countdown-banner">FOMC in ' + _d + 'd ' + _h + 'h ' + _m + 'm \u00B7 Rate Decision Jul 29, 2026</div>';
      }
    })();

    // ── 5. ACTION QUEUE (top signals from screener) ──
    const setups = marketData?.premarket_top_setups || [];
    if (setups.length) {
      html += '<div class="today-section"><div class="today-section-title">Action Queue</div>';
      setups.slice(0, 3).forEach(s => {
        const signalsHtml = (s.signals || []).map(sig => {
          let bg = 'var(--text-muted)';
          if (sig.includes('oversold')) bg = 'var(--green)';
          else if (sig.includes('breakout')) bg = '#2196f3';
          else if (sig.includes('pullback')) bg = '#ffc107';
          return `<span style="background:${bg};color:#fff;padding:1px 6px;border-radius:3px;font-size:0.7rem;margin:1px;display:inline-block">${Utils.esc(sig.replace(/_/g,' '))}</span>`;
        }).join('');
        
        // Determine verb from signals
        let verb = 'WATCH', verbCls = 'verb-watch';
        const allSig = (s.signals || []).join(' ');
        if (allSig.includes('oversold') || allSig.includes('breakout') || allSig.includes('pullback')) {
          verb = 'SETUP'; verbCls = 'verb-setup';
        }
        if ((s.council_verdict || '').includes('bull')) { verb = 'LONG'; verbCls = 'verb-long'; }
        if ((s.council_verdict || '').includes('bear')) { verb = 'AVOID'; verbCls = 'verb-avoid'; }
        
        html += `<div class="today-signal-row">`;
        html += `<span class="verb ${verbCls}">${verb}</span>`;
        html += `<span class="today-signal-ticker"><a href="#/ticker/${Utils.esc(s.ticker)}">${Utils.esc(s.ticker)}</a></span>`;
        html += `<span class="today-signal-price">$${Utils.formatPrice(s.price)}</span>`;
        html += `<span class="today-signal-rsi">RSI ${s.rsi != null ? s.rsi : '—'}</span>`;
        html += `<span class="today-signal-score">${Utils.scoreBadge(s.score)}</span>`;
        html += `<span class="today-signal-desc">${signalsHtml}</span>`;
        html += '</div>';
      });
      html += '</div>';
    }

    // ── 6. OPTIONS FLOW HIGHLIGHTS ──
    if (analysisData?.options_flow?.top_overbought_calls?.length) {
      const calls = analysisData.options_flow.top_overbought_calls.slice(0, 3);
      html += '<div class="today-section"><div class="today-section-title">Options Flow <a href="#/options" style="font-size:0.7rem;font-weight:400;color:var(--accent);text-decoration:none;margin-left:6px">View all →</a></div>';
      calls.forEach(o => {
        const isCall = o.type === 'call';
        const rowBg = isCall ? 'rgba(76,175,80,0.08)' : 'rgba(244,67,54,0.08)';
        const ratioWidth = Math.min(100, (o.vol_oi_ratio || 0) * 10);
        html += `<div class="today-flow-row" style="background:${rowBg};padding:6px 8px;border-radius:6px;margin-bottom:3px">`;
        html += `<span class="today-flow-ticker">${Utils.esc(o.ticker)}</span>`;
        html += `<span class="today-flow-call">${isCall ? '☎' : '⛔'} $${Utils.esc(o.strike)}</span>`;
        html += `<div style="flex:1;margin:0 10px;height:6px;background:var(--bg-inset);border-radius:3px;overflow:hidden"><div style="width:${ratioWidth}%;height:100%;background:${isCall ? 'var(--green)' : 'var(--red)'};border-radius:3px"></div></div>`;
        html += `<span class="today-flow-vol">${o.vol_oi_ratio}x OI</span>`;
        html += `<span class="today-flow-premium">$${(o.premium / 1000000).toFixed(1)}M</span>`;
        html += '</div>';
      });
      html += '</div>';
    }

    // ── 6.5 GEX/DEX/VEX SNAPSHOT ──
    if (gexData?.modes?.all) {
      const a = gexData.modes.all;
      const fmt = (v) => v >= 1e6 ? '$'+(v/1e6).toFixed(1)+'M' : v >= 1e3 ? '$'+(v/1e3).toFixed(0)+'K' : '$'+v.toFixed(0);
      const rg = (a.gamma_regime||'').toUpperCase();
      const rc = rg.includes('LONG')||rg.includes('BULL') ? 'var(--green)' : rg.includes('SHORT')||rg.includes('BEAR') ? 'var(--red)' : 'var(--text-primary)';
      html += '<div class="today-section"><div class="today-section-title">GEX/DEX/VEX</div><div style="display:flex;flex-wrap:wrap;gap:12px">';
      html += '<div class="card" style="flex:1;min-width:90px;padding:10px;text-align:center"><div class="card-title">GEX</div><div style="font-size:1.2rem;font-weight:700;font-family:var(--font-mono)">'+fmt(a.total_gex)+'</div></div>';
      html += '<div class="card" style="flex:1;min-width:90px;padding:10px;text-align:center"><div class="card-title">DEX</div><div style="font-size:1.2rem;font-weight:700;font-family:var(--font-mono)">'+fmt(a.total_dex)+'</div></div>';
      html += '<div class="card" style="flex:1;min-width:90px;padding:10px;text-align:center"><div class="card-title">VEX</div><div style="font-size:1.2rem;font-weight:700;font-family:var(--font-mono)">'+fmt(a.total_vex)+'</div></div>';
      html += '<div class="card" style="flex:1;min-width:90px;padding:10px;text-align:center"><div class="card-title">Regime</div><div style="font-size:1.2rem;font-weight:700;color:'+rc+'">'+rg+'</div></div>';
      html += '<div class="card" style="flex:1;min-width:90px;padding:10px;text-align:center"><div class="card-title">Max Γ</div><div style="font-size:1.2rem;font-weight:700;font-family:var(--font-mono)">$'+a.max_gex_strike+'</div></div>';
      html += '</div></div>';
    }

    // ── 7. HEADLINES (compact) ──
    if (marketData?.market_news?.headlines?.length) {
      html += '<div class="today-section"><div class="today-section-title">Headlines</div>';
      html += '<div class="today-headlines">';
      marketData.market_news.headlines.slice(0, 3).forEach(n => {
        html += `<div class="today-headline"><a href="${Utils.esc(Utils.safeUrl(n.url))}" target="_blank" rel="noopener">${Utils.esc(n.title.slice(0, 80))}</a></div>`;
      });
      html += '</div></div>';
    }

    app.innerHTML = html;
  },

  _regimeBadge(vix, ms) {
    if (vix == null) return '';
    let label = 'NEUTRAL', cls = 'regime-neutral';
    if (vix < 15) { label = 'RISK-ON'; cls = 'regime-risk-on'; }
    else if (vix >= 15 && vix <= 20) { label = 'NEUTRAL'; cls = 'regime-neutral'; }
    else if (vix > 20 && vix <= 28) { label = 'RISK-OFF'; cls = 'regime-risk-off'; }
    else if (vix > 28) { label = 'STRESS'; cls = 'regime-stress'; }

    const vixChange = ms.vix_change_pct != null ? Utils.formatPct(ms.vix_change_pct) : '';
    const vixCls = ms.vix_change_pct != null ? Utils.changeClass(ms.vix_change_pct) : '';
    const vixArrow = ms.vix_change_pct != null ? (ms.vix_change_pct >= 0 ? '▲' : '▼') : '';

    return `<div class="today-regime ${cls}">
      <span class="regime-badge">● ${label}</span>
      <span class="regime-vix">VIX ${Utils.formatPrice(vix)} ${vixArrow}<span class="${vixCls}">${vixChange}</span></span>
      <span class="regime-ten">10Y ${ms.ten_year_yield != null ? ms.ten_year_yield + '%' : '—'}</span>
      <span class="regime-session">${this._sessionLabel()} · ${this._sessionTime()} ET</span>
    </div>`;
  },

  /**
   * 'So What' Verdict Bar — QWEN-ADD.
   * Shows: signal direction + conviction (from MODEL) + narrative (from LLM).
   * MUST visually distinguish the two sources. Conviction NEVER comes from LLM.
   */
  _renderVerdict(v) {
    if (!v) return '';
    const signal = v.signal || 'neutral';
    let conviction = v.conviction || 0;
    conviction = Math.min(1, Math.max(0, conviction));
    const convictionPct = Math.round(conviction * 100);
    const narrative = v.narrative || '';

    // Signal color
    const signalColors = {
      'bullish': 'var(--green)', 'bearish': 'var(--red)', 'neutral': 'var(--yellow)'
    };
    const signalIcons = { 'bullish': '▲', 'bearish': '▼', 'neutral': '●' };
    const sigColor = signalColors[signal] || 'var(--text-muted)';
    const sigIcon = signalIcons[signal] || '●';

    // Conviction bar width and color
    const barWidth = Math.max(5, convictionPct);
    const barColor = conviction >= 0.6 ? 'var(--green)' : conviction >= 0.4 ? 'var(--yellow)' : 'var(--red)';

    // Confidence interval
    const ci = v.confidence_interval || [0, 0];
    const ciText = ci.length === 2 ? `${Math.round(ci[0]*100)}-${Math.round(ci[1]*100)}%` : '';

    let html = '<div style="background:var(--bg-inset);border:1px solid var(--border-dim);border-radius:var(--card-radius);padding:12px 16px;margin:8px 0">';
    html += '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">';

    // Signal direction
    html += `<div style="display:flex;align-items:center;gap:6px">`;
    html += `<span style="font-size:1.1rem;color:${sigColor}">${sigIcon}</span>`;
    html += `<span style="font-weight:700;font-size:0.95rem;text-transform:uppercase;color:${sigColor}">${signal}</span>`;
    html += '</div>';

    // Conviction bar (FROM MODEL)
    html += '<div style="flex:1;min-width:120px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">';
    html += `<span style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">🤖 Model Conviction</span>`;
    html += `<span style="font-size:0.75rem;font-weight:600;color:${barColor}">${convictionPct}%</span>`;
    html += '</div>';
    html += `<div style="height:6px;background:var(--bg);border-radius:3px;overflow:hidden">`;
    html += `<div style="height:100%;width:${barWidth}%;background:${barColor};border-radius:3px;transition:width 0.3s"></div>`;
    html += '</div>';
    if (ciText) {
      html += `<div style="font-size:0.55rem;color:var(--text-muted);margin-top:1px">CI: ${ciText}</div>`;
    }
    html += '</div>';

    // Narrative (FROM LLM — clearly labeled)
    if (narrative) {
      var narrativeLabel = v.narrative_source === 'rule_template' ? '📋 Market Summary' : '💬 LLM Narrative';
      html += '<div style="flex:2;min-width:200px;border-left:2px solid var(--border-subtle);padding-left:12px">';
      html += '<div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">' + narrativeLabel + '</div>';
      html += `<div style="font-size:0.82rem;color:var(--text-secondary);line-height:1.4">${Utils.esc(narrative)}</div>`;
      html += '</div>';
    }

    html += '</div>';
    html += '</div>';
    return html;
  },

  /** Legacy render kept for archive detail view */
  async render(app) {
    app.innerHTML = '<div class="loading">Loading market data...</div>';
    const data = await State.get('latest', '/data/latest.json');
    if (!data) {
      app.innerHTML = '<div class="error-card">Failed to load market data.</div>';
      return;
    }
    let html = this._buildHTML(data);
    app.innerHTML = html;
  },

  renderWithData(app, data, title) {
    if (!data) { app.innerHTML = '<div class="error-card">No data available.</div>'; return; }
    let html = '';
    if (title) {
      html += '<div class="stale-banner" style="margin-bottom:16px">📂 ' + Utils.esc(title) + ' · <a href="#/research" style="color:var(--accent);text-decoration:underline">← Archive</a></div>';
    }
    html += this._buildHTML(data);
    app.innerHTML = html;
  },

  /** Full dashboard HTML builder (kept for archive view) */
  _buildHTML(data) { /* Full old rendering kept for archive display */
    let html = '';
    if (State.isStale(data.generated_at)) {
      html += '<div class="stale-banner">⚠ Data from ' + new Date(data.generated_at).toLocaleString() + ' — may be stale</div>';
    }
    if (data.generated_at) {
      html += '<div style="text-align:right;color:var(--text-muted);font-size:0.8rem;padding:4px 0 12px 0">Generated ' + new Date(data.generated_at).toLocaleString() + '</div>';
    }
    const ms = data.market_summary || {};
    if (ms.indices?.length) {
      const valid = ms.indices.filter(i => i.ticker && !i.ticker.startsWith('_'));
      if (valid.length) {
        html += '<div class="section"><h2 class="section-title">Market Indices</h2><div class="grid-4">';
        valid.forEach(idx => {
          const cls = Utils.changeClass(idx.change_pct);
          html += `<div class="card index-card"><div class="index-ticker">${Utils.esc(idx.ticker)}</div><div class="index-price">${Utils.formatPrice(idx.price)}</div><div class="index-change ${cls}">${Utils.formatPct(idx.change_pct)}</div></div>`;
        });
        html += '</div></div>';
      }
    }
    if (data.narrative?.summary_paragraph) {
      const rendered = Utils.renderMarkdown(data.narrative.summary_paragraph);
      html += `<div class="section"><div class="card narrative-card"><div class="intel-body">${rendered}</div></div></div>`;
    }
    if (data.geopolitical?.length) {
      html += '<div class="section"><h2 class="section-title">🌍 Geopolitical Risks & Global News</h2><div class="card">';
      data.geopolitical.slice(0, 8).forEach(g => {
        html += `<div style="padding:10px 0;border-bottom:1px solid var(--border-subtle);font-size:0.9rem"><a href="${Utils.esc(Utils.safeUrl(g.url))}" target="_blank" style="color:var(--text-primary);text-decoration:none;font-weight:500">${Utils.esc(g.title)}</a><div style="color:var(--text-muted);font-size:0.75rem">${Utils.esc(g.source)}</div></div>`;
      });
      html += '</div></div>';
    }
    if (data.premarket_top_setups?.length) {
      html += '<div class="section"><h2 class="section-title">Top Setups</h2>' + this._buildSetupsTable(data.premarket_top_setups) + '</div>';
    }
    if (data.market_news?.headlines?.length) {
      html += '<div class="section"><h2 class="section-title">Market News</h2><div class="card">';
      data.market_news.headlines.forEach(n => {
        html += `<div style="padding:10px 0;border-bottom:1px solid var(--border-subtle)"><a href="${Utils.esc(Utils.safeUrl(n.url))}" target="_blank" style="color:var(--text-primary);text-decoration:none;font-weight:500">${Utils.esc(n.title)}</a><div style="color:var(--text-muted);font-size:0.75rem">${Utils.esc(n.source || '')}</div></div>`;
      });
      html += '</div></div>';
    }
    if (data.market_news?.analyst_ratings?.length) {
      html += '<div class="section"><h2 class="section-title">Analyst Ratings</h2><div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Strong Buy</th><th>Buy</th><th>Hold</th><th>Sell</th><th>Strong Sell</th></tr></thead><tbody>';
      data.market_news.analyst_ratings.forEach(a => {
        html += `<tr><td><strong>${Utils.esc(a.ticker)}</strong></td><td><span class="badge badge-green">${a.strongBuy || 0}</span></td><td style="color:var(--green)">${a.buy || 0}</td><td style="color:var(--yellow)">${a.hold || 0}</td><td style="color:var(--red)">${a.sell || 0}</td><td><span class="badge badge-red">${a.strongSell || 0}</span></td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }
    if (data.congress?.recent_trades?.length) {
      html += '<div class="section"><h2 class="section-title">Congress Trading</h2><div class="card table-wrap"><table><thead><tr><th>Politician</th><th>Party</th><th>Action</th><th>Asset</th><th>Size</th><th>Price</th></tr></thead><tbody>';
      data.congress.recent_trades.forEach(t => {
        html += `<tr><td>${Utils.esc(t.politician)}</td><td><span class="badge ${t.party === 'D' ? 'badge-green' : t.party === 'R' ? 'badge-red' : 'badge-yellow'}">${Utils.esc(t.party || '—')}</span></td><td class="${t.action?.toLowerCase().includes('sell') ? 'negative' : 'positive'}">${Utils.esc(t.action)}</td><td>${Utils.esc(t.ticker || '—')}</td><td>${Utils.esc(t.size || '—')}</td><td>${Utils.formatPrice(t.price)}</td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }
    if (data.market_news?.earnings?.length) {
      const hasEst = data.market_news.earnings.filter(e => e.epsEstimate != null);
      if (hasEst.length) {
        html += '<div class="section"><h2 class="section-title">Earnings This Week</h2><div class="card table-wrap"><table><thead><tr><th>Date</th><th>Ticker</th><th>Quarter</th><th>Estimate</th></tr></thead><tbody>';
        hasEst.forEach(e => { html += '<tr><td>' + Utils.esc(e.date || '') + '</td><td><strong>' + Utils.esc(e.symbol || e.ticker || '') + '</strong></td><td>' + Utils.esc(e.quarter || '') + '</td><td>' + (e.epsEstimate != null ? '$' + Number(e.epsEstimate).toFixed(2) : '—') + '</td></tr>'; });
        html += '</tbody></table></div></div>';
      }
    }
    return html;
  },

  _buildSetupsTable(setups) {
    let h = '<div class="card table-wrap"><table><thead><tr><th>Ticker</th><th>Price</th><th>Chg</th><th>Score</th><th>Signals</th><th>RSI</th><th>Verdict</th></tr></thead><tbody>';
    setups.forEach(s => {
      const cls = s.change_pct != null ? Utils.changeClass(s.change_pct) : '';
      const signals = (s.signals || []).map(sig => `<span class="badge ${sig.includes('bear') || sig.includes('over') ? 'badge-red' : 'badge-green'}" style="margin:1px">${Utils.esc(sig.replace(/_/g, ' '))}</span>`).join(' ');
      const vBadge = s.council_verdict === 'bullish' ? 'badge-green' : s.council_verdict === 'bearish' ? 'badge-red' : 'badge-yellow';
      h += `<tr><td><a href="#/ticker/${Utils.esc(s.ticker)}">${Utils.esc(s.ticker)}</a></td><td>${Utils.formatPrice(s.price)}</td><td class="${cls}">${Utils.formatPct(s.change_pct)}</td><td>${Utils.scoreBadge(s.score)}</td><td style="max-width:250px">${signals}</td><td>${s.rsi != null ? s.rsi : '—'}</td><td><span class="badge ${vBadge}">${Utils.esc(s.council_verdict || '—')}</span></td></tr>`;
    });
    h += '</tbody></table></div>';
    return h;
  }
};
