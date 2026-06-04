/**
 * MapleGamma — GEX/DEX/VEX Trading Dashboard
 * Vanilla JS, no dependencies, Canvas 2D chart.
 *
 * Architecture:
 *   MapleGamma.renderLanding(app)  — marketing page (#/maplegamma)
 *   MapleGamma.renderDashboard(app) — logged-in dashboard (#/mg)
 *
 * Internal Widget Methods:
 *   _buildMetricsBar(data, ticker)
 *   _buildChart(data, ticker, canvasEl)
 *   _buildZoneCards(data, ticker)
 *   _buildGammaTable(data, ticker)
 *   _buildExpiryBreakdown(data, ticker)
 *   _buildOIHeatmap(data, ticker)
 *   _buildFlowTable(data)
 */
const MapleGamma = {
  /* ─────────────────────────────────────────────────────────────
     LANDING PAGE (public, for conversion)
     ───────────────────────────────────────────────────────────── */
  renderLanding(app) {
    app.innerHTML = `
      <div class="mg-landing">
        <!-- Hero -->
        <div class="mg-hero">
          <div class="mg-hero-eyebrow" style="display:flex;align-items:center;justify-content:center;margin-bottom:12px">
            <img src="/assets/img/maplegamma-logo.svg" alt="MapleGamma" height="65" style="height:65px">
          </div>
          <h1 class="mg-hero-title">
            Gamma Intelligence<br>
            for the <em>Canadian Trader</em>
          </h1>
          <p class="mg-hero-subtitle">
            See where the smart money is positioned. Spot gamma floors and
            ceilings before the market moves. Real-time GEX, DEX &amp; VEX
            for SPX and TSX.
          </p>
          <div class="mg-hero-actions">
            <a href="#/mg" class="mg-btn mg-btn-primary">Try Dashboard Free →</a>
            <a href="javascript:void(0)" class="mg-btn mg-btn-secondary" onclick="setTimeout(function(){var el=document.getElementById('mg-pricing');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})},100)">View Pricing ↓</a>
          </div>

          <!-- Live preview stats -->
          <div class="mg-hero-stats">
            <div class="mg-hero-stat">
              <div class="ticker">SPX</div>
              <div class="price">7,609.14</div>
              <span class="gamma-tag bullish">Γ +1.5B</span>
            </div>
            <div class="mg-hero-stat">
              <div class="ticker">TSX</div>
              <div class="price">35,083.91</div>
              <span class="gamma-tag bullish">Γ +0.6B</span>
            </div>
            <div class="mg-hero-stat">
              <div class="ticker">VIX</div>
              <div class="price">15.76</div>
              <span class="gamma-tag neutral">Γ neutral</span>
            </div>
          </div>
        </div>

        <!-- Simplify explainer -->
        <div class="mg-explainers">
          <div class="mg-explainer-card">
            <div class="icon">🛡️</div>
            <h3>Gamma Floors</h3>
            <p>Where dealer hedging creates strong support. When price
            approaches a gamma floor, put sellers delta-hedge by buying —
            creating a natural bid.</p>
          </div>
          <div class="mg-explainer-card">
            <div class="icon">🚧</div>
            <h3>Gamma Ceilings</h3>
            <p>Where call concentration creates resistance. At the ceiling,
            market makers sell the underlying as they delta-hedge, capping
            upward moves.</p>
          </div>
        </div>

        <!-- Features -->
        <div class="mg-features">
          <div class="mg-feature-card">
            <div class="icon">📊</div>
            <h4>GEX / DEX / VEX</h4>
            <p>Gamma, delta, and vega exposure in one view. See not just where
            the pin action is, but how sensitive and how volatile it could get.</p>
          </div>
          <div class="mg-feature-card">
            <div class="icon">📍</div>
            <h4>Floor &amp; Ceiling Zones</h4>
            <p>Auto-detected support and resistance zones derived from live
            gamma profiles. Push alerts when price approaches key levels.</p>
          </div>
          <div class="mg-feature-card">
            <div class="icon">🐋</div>
            <h4>Options Flow</h4>
            <p>Real-time unusual options activity. See the whale trades,
            sweepers, and large blocks as they hit the tape.</p>
          </div>
          <div class="mg-feature-card">
            <div class="icon">🍁</div>
            <h4>Canadian + US Markets</h4>
            <p>SPX, QQQ, IWM <em>and</em> TSX, TSX 60, TSX-V gamma profiles.
            The only service with institutional-grade Canadian gamma data.</p>
          </div>
          <div class="mg-feature-card">
            <div class="icon">📋</div>
            <h4>Full Gamma Table</h4>
            <p>Exportable gamma exposure table by strike. Every expiration,
            every ticker. Sort, filter, and download to CSV.</p>
          </div>
          <div class="mg-feature-card">
            <div class="icon">🤖</div>
            <h4>AI Narrative</h4>
            <p>What does all this gamma data mean? Our AI interprets the
            profile in plain English. "SPX is pinned between 5,700 and 5,850."</p>
          </div>
        </div>

        <!-- Pricing -->
        <div class="mg-pricing" id="mg-pricing">
          <div class="mg-pricing-card most-popular">
            <div class="plan-name">MapleGamma Pro</div>
            <div class="price">$150 <span style="font-size:1rem;color:var(--text-muted)">CAD/month</span></div>
            <div class="price-note">Includes portfolio tracker + ticker watchlist</div>
            <ul class="features">
              <li>Real-time GEX/DEX/VEX for SPX</li>
              <li>Gamma profile charts with floor/ceiling zones</li>
              <li>Full gamma table — exportable to CSV</li>
              <li>Unusual options flow + whale alerts</li>
              <li>AI market narrative + gamma interpretation</li>
              <li>Portfolio tracker with live prices</li>
              <li>Discord community access</li>
            </ul>
            <a href="#/mg" class="mg-btn mg-btn-primary" style="width:100%;justify-content:center">Subscribe Now →</a>
            <div class="guarantee">14-day money-back guarantee. Cancel anytime.</div>
          </div>

          <!-- Add-ons -->
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px">
            <div class="mg-pricing-card" style="padding:16px;text-align:center">
              <div style="font-size:1.5rem;margin-bottom:6px">🍁</div>
              <div style="font-weight:600;font-size:0.9rem">Canadian Data</div>
              <div class="price" style="font-size:1.2rem">+$50</div>
              <div style="font-size:0.7rem;color:var(--text-muted)">CAD/month</div>
              <ul class="features" style="margin-top:8px">
                <li>TSX, TSX-V, TSX60 gamma</li>
                <li>Canadian options chains</li>
                <li>Cross-border analysis</li>
              </ul>
            </div>
            <div class="mg-pricing-card" style="padding:16px;text-align:center">
              <div style="font-size:1.5rem;margin-bottom:6px">🤖</div>
              <div style="font-weight:600;font-size:0.9rem">AI Rebalance</div>
              <div class="price" style="font-size:1.2rem">+$50</div>
              <div style="font-size:0.7rem;color:var(--text-muted)">CAD/month</div>
              <ul class="features" style="margin-top:8px">
                <li>Full P&amp;L tracking</li>
                <li>AI portfolio analysis</li>
                <li>Rebalance suggestions</li>
              </ul>
            </div>
            <div class="mg-pricing-card" style="padding:16px;text-align:center">
              <div style="font-size:1.5rem;margin-bottom:6px">🔑</div>
              <div style="font-weight:600;font-size:0.9rem">API Access</div>
              <div class="price" style="font-size:1.2rem">+$100</div>
              <div style="font-size:0.7rem;color:var(--text-muted)">CAD/month</div>
              <ul class="features" style="margin-top:8px">
                <li>REST API access</li>
                <li>Self-serve API keys</li>
                <li>Unlimited queries</li>
              </ul>
            </div>
            <div class="mg-pricing-card" style="padding:16px;text-align:center">
              <div style="font-size:1.5rem;margin-bottom:6px">🎮</div>
              <div style="font-weight:600;font-size:0.9rem">Simulation</div>
              <div class="price" style="font-size:1.2rem">+$50</div>
              <div style="font-size:0.7rem;color:var(--text-muted)">CAD/month</div>
              <ul class="features" style="margin-top:8px">
                <li>AI portfolio builder</li>
                <li>Live P&amp;L tracking</li>
                <li>Rebalance signals</li>
              </ul>
            </div>
          </div>
          <div style="text-align:center;margin-top:12px;font-size:0.85rem;color:var(--accent);font-weight:600">Full Stack: $400 CAD/mo — Everything included</div>
        </div>

        <!-- Comparison -->
        <div class="mg-compare">
          <div class="mg-section-title">MapleGamma vs The Competition</div>
          <div class="card table-wrap">
            <table>
              <thead><tr><th>Feature</th><th>MapleGamma</th><th>Vol.land</th><th>Unusual Whales</th></tr></thead>
              <tbody>
                <tr><td>GEX (Gamma Exposure)</td><td class="mg-check">✓ Real-time</td><td>✓</td><td class="mg-cross">✗</td></tr>
                <tr><td>DEX (Delta Exposure)</td><td class="mg-check">✓</td><td>✓</td><td class="mg-cross">✗</td></tr>
                <tr><td>VEX (Vega Exposure)</td><td class="mg-check">✓</td><td class="mg-cross">✗</td><td class="mg-cross">✗</td></tr>
                <tr><td>Canadian Market Data</td><td class="mg-check">✓ TSX, TSX-V, TSX60</td><td class="mg-cross">✗</td><td class="mg-cross">✗</td></tr>
                <tr><td>Floor/Ceiling Zone Detection</td><td class="mg-check">✓ Auto-detected</td><td>Manual only</td><td class="mg-cross">✗</td></tr>
                <tr><td>Beginner Mode</td><td class="mg-check">✓ Zones-first layout</td><td class="mg-cross">✗</td><td class="mg-cross">✗</td></tr>
                <tr><td>AI Narrative</td><td class="mg-check">✓</td><td class="mg-cross">✗</td><td>Mr. Whale</td></tr>
                <tr><td>Unusual Options Flow</td><td class="mg-check">✓</td><td class="mg-cross">✗</td><td>✓</td></tr>
                <tr><td>Price</td><td class="mg-check">$150 CAD/mo — Pro</td><td>$50/mo basic</td><td>$63–$170/mo</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align:center;color:var(--text-muted);font-size:0.75rem;padding:40px 0 20px;border-top:1px solid var(--border-dim)">
          MapleGamma is a trading analytics tool. Not financial advice. Data is provided for informational purposes only.<br>
          © 2026 MapleGamma. All rights reserved.
        </div>
      </div>
    `;
  },

  /* ─────────────────────────────────────────────────────────────
     DASHBOARD (logged-in, all 7 widgets)
     ───────────────────────────────────────────────────────────── */
  async renderDashboard(app) {
    app.innerHTML = '<div class="mg-dashboard"><div class="mg-skeleton mg-skel-chart" style="margin-bottom:16px"></div><div class="mg-skeleton mg-skel-card" style="margin-bottom:16px"></div><div class="mg-skeleton mg-skel-chart"></div></div>';

    let data;
    try {
      data = await State.get('mg-data', '/data/maplegamma-data.json');
    } catch (_e) {
      data = null;
    }
    if (!data) {
      app.innerHTML = `
        <div class="mg-dashboard">
          <div class="mg-error-card">
            <strong>⚠ Data Unavailable</strong>
            <p>Failed to load gamma data. The market is closed or there's a connection issue.</p>
            <button onclick="location.hash='#/mg'">Retry</button>
          </div>
        </div>`;
      return;
    }
    this._data = data;

    const tickers = Object.keys(data.tickers);
    const defaultTicker = 'SPX';
    this._selectedTicker = defaultTicker;
    this._selectedOverlay = 'gex';

    let html = `<div class="mg-dashboard">`;

    // ── Stale warning ──
    if (data.generated_at && State.isStale(data.generated_at)) {
      html += `<div class="mg-stale-banner">⚠ Data from ${new Date(data.generated_at).toLocaleTimeString()} — market may be closed</div>`;
    }

    // ── WIDGET 1: Metics Bar ──
    html += this._buildMetricsBar(data, defaultTicker);

    // ── Ticker + Expiry Selector ──
    html += `<div class="mg-ticker-bar" id="mg-ticker-bar">`;
    html += tickers.map(t => `<button class="mg-ticker-pill ${t === defaultTicker ? 'active' : ''}" data-ticker="${t}">${t}</button>`).join('');
    html += `<span style="flex:1"></span>`;
    html += [`All Exp`, `Weekly`, `Monthly`].map(e => `<button class="mg-expiry-pill ${e === 'All Exp' ? 'active' : ''}">${e}</button>`).join('');
    html += `</div>`;

    // ── WIDGET 2: Gamma Profile Chart ──
    html += `<div class="mg-section"><div class="mg-chart-card" id="mg-chart-card">`;
    html += this._buildChartHeader();
    html += `<div class="mg-chart-canvas-wrap"><canvas id="mg-gamma-chart"></canvas></div>`;
    const tickerData = data.tickers[defaultTicker];
    html += `<div class="mg-chart-narrative" id="mg-chart-narrative">▶ ${tickerData.narrative}</div>`;
    html += `</div></div>`;

    // ── WIDGET 3: Floor / Ceiling Zone Cards ──
    html += `<div class="mg-zone-grid" id="mg-zone-grid">`;
    html += this._buildZoneCards(data, defaultTicker);
    html += `</div>`;

    // ── WIDGET 4: Mode Toggle + Full Gamma Table ──
    html += `<div class="mg-section" id="mg-table-section">`;
    html += `
      <div class="mg-mode-toggle" id="mg-mode-toggle">
        <label class="active"><input type="radio" name="mg-mode" value="simple" checked> 🌿 Beginner: Zones</label>
        <label><input type="radio" name="mg-mode" value="advanced"> ⚡ Advanced: Full Table</label>
      </div>
      <div id="mg-table-content">`; // simple mode = nothing extra shown
    html += this._buildGammaTableHTML(data, defaultTicker);
    html += `</div></div>`;

    // ── WIDGET 5: Net GEX by Expiration ──
    html += `<div class="mg-section"><div class="mg-section-title">Net Gamma by Expiration — ${defaultTicker}</div>`;
    html += `<div class="mg-expiry-grid" id="mg-expiry-grid">`;
    html += this._buildExpiryHTML(data, defaultTicker);
    html += `</div></div>`;

    // ── WIDGET 6: OI Heatmap ──
    html += `<div class="mg-section"><div class="mg-section-title">Open Interest by Strike × Expiration — ${defaultTicker}</div>`;
    html += `<div class="card"><div class="mg-heatmap-wrap">`;
    html += this._buildOIHeatmapHTML(data, defaultTicker);
    html += `</div></div></div>`;

    // ── WIDGET 7: Unusual Options Flow ──
    html += `<div class="mg-section">`;
    html += this._buildFlowHTML(data);
    html += `</div>`;

    // Timestamp
    html += `<div style="text-align:center;color:var(--text-muted);font-size:0.75rem;padding:16px">Generated ${new Date(data.generated_at).toLocaleString()}</div>`;

    html += `</div>`;
    app.innerHTML = html;

    // ── Draw chart ──
    this._drawGammaChart(data, defaultTicker, 'gex');

    // ── Wire interactions ──
    this._wireInteractions(data);
  },

  /* ─────────────────────────────────────────────────────────────
     WIDGET 1: KEY METRICS BAR
     ───────────────────────────────────────────────────────────── */
  _buildMetricsBar(data, ticker) {
    const t = data.tickers[ticker];
    const m = data.market_overview;
    const price = t.current_price;
    const chg = t.change_pct;
    const chgCls = Utils.changeClass(chg);
    const regimeCls = t.gamma_regime;

    return `
      <div class="mg-metrics-bar" id="mg-metrics-bar">
        <div class="mg-metric-card">
          <div class="mg-metric-label">${ticker}</div>
          <div class="mg-metric-value">${Utils.formatPrice(price)}</div>
          <div class="mg-metric-sub mg-metric-change ${chgCls}">${Utils.formatPct(chg)}</div>
        </div>
        <div class="mg-metric-card">
          <div class="mg-metric-label">Total GEX <span style="font-size:9px;color:var(--text-disabled)">per \$1%</span></div>
          <div class="mg-metric-value ${t.total_gex >= 0 ? 'positive' : 'negative'}">${this._fmtGex(t.total_gex)}</div>
          <div class="mg-metric-sub">Gamma Exposure</div>
        </div>
        <div class="mg-metric-card">
          <div class="mg-metric-label">Total DEX <span style="font-size:9px;color:var(--text-disabled)">per \$1%</span></div>
          <div class="mg-metric-value ${t.total_dex >= 0 ? 'positive' : 'negative'}">${this._fmtGex(t.total_dex)}</div>
          <div class="mg-metric-sub">Delta Exposure</div>
        </div>
        <div class="mg-metric-card">
          <div class="mg-metric-label">Total VEX <span style="font-size:9px;color:var(--text-disabled)">per 1%IV</span></div>
          <div class="mg-metric-value ${t.total_vex >= 0 ? 'positive' : 'negative'}">${this._fmtGex(t.total_vex)}</div>
          <div class="mg-metric-sub">Vega Exposure</div>
        </div>
        <div class="mg-metric-card">
          <div class="mg-metric-label">Gamma Regime</div>
          <div class="mg-metric-value"><span class="mg-regime-badge ${regimeCls}">${regimeCls === 'bullish' ? '🟢' : regimeCls === 'bearish' ? '🔴' : '🟡'} ${regimeCls}</span></div>
          <div class="mg-metric-sub"><span class="mg-live-dot"></span><span class="mg-live-label">LIVE</span></div>
        </div>
      </div>`;
  },

  /* ─────────────────────────────────────────────────────────────
     WIDGET 2: CHART HEADER
     ───────────────────────────────────────────────────────────── */
  _buildChartHeader() {
    return `
      <div class="mg-chart-header">
        <div class="mg-chart-title"><span class="mg-live-dot"></span><span class="mg-live-label">LIVE</span> Gamma Exposure Profile</div>
        <div class="mg-chart-toggle-group" id="mg-chart-overlays">
          <button class="mg-chart-toggle active" data-overlay="gex">GEX</button>
          <button class="mg-chart-toggle" data-overlay="dex">DEX</button>
          <button class="mg-chart-toggle" data-overlay="all">All</button>
        </div>
      </div>`;
  },

  /* ─────────────────────────────────────────────────────────────
     WIDGET 2: CANVAS CHART — Gamma Profile
     ───────────────────────────────────────────────────────────── */
  _drawGammaChart(data, ticker, overlay) {
    const canvas = document.getElementById('mg-gamma-chart');
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    const w = rect.width || 800;
    const h = rect.height || 360;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const t = data.tickers[ticker];
    const profile = t.gamma_profile;
    if (!profile || !profile.length) return;

    // Layout
    const pad = { top: 20, right: 20, bottom: 35, left: 55 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    const strikes = profile.map(p => p.strike);
    const minStrike = strikes[0];
    const maxStrike = strikes[strikes.length - 1];

    const netGex = profile.map(p => p.net_gex);
    const maxAbs = Math.max(...netGex.map(Math.abs), 1);
    const dexVals = profile.map(p => Math.abs(p.dex || 0));
    const maxDex = Math.max(...dexVals, 1);

    const strikeW = chartW / (strikes.length - 1);

    // Current price x-position
    const currentPrice = t.current_price;
    const priceFrac = (currentPrice - minStrike) / (maxStrike - minStrike);
    const priceX = pad.left + priceFrac * chartW;

    // ── Background ──
    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, w, h);

    // Read theme CSS vars once
    const rootStyle = getComputedStyle(document.documentElement);
    const cssBorderSubtle = rootStyle.getPropertyValue('--border-subtle').trim() || 'rgba(128,128,128,0.15)';
    const cssBorderMid = rootStyle.getPropertyValue('--border-mid').trim() || 'rgba(128,128,128,0.25)';
    const cssAccent = rootStyle.getPropertyValue('--mg-accent').trim() || '#e2a84a';
    const cssTextMuted = rootStyle.getPropertyValue('--text-muted').trim() || '#7a90b0';

    // ── Grid lines ──
    ctx.strokeStyle = cssBorderSubtle;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }

    // ── Zero line ──
    const zeroY = pad.top + chartH / 2;
    ctx.strokeStyle = cssBorderMid;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, zeroY);
    ctx.lineTo(w - pad.right, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Floor zone shading ──
    const floorStart = t.floor_zone ? Math.max(t.floor_zone.range_start, minStrike) : minStrike;
    const floorEnd = t.floor_zone ? Math.min(t.floor_zone.range_end, maxStrike) : minStrike;
    if (floorEnd > floorStart) {
      const fX1 = pad.left + ((floorStart - minStrike) / (maxStrike - minStrike)) * chartW;
      const fX2 = pad.left + ((floorEnd - minStrike) / (maxStrike - minStrike)) * chartW;
      ctx.fillStyle = 'rgba(74,222,128,0.08)';
      ctx.fillRect(fX1, pad.top, fX2 - fX1, chartH);
    }

    // ── Ceiling zone shading ──
    const ceilStart = t.ceiling_zone ? Math.max(t.ceiling_zone.range_start, minStrike) : maxStrike;
    const ceilEnd = t.ceiling_zone ? Math.min(t.ceiling_zone.range_end, maxStrike) : maxStrike;
    if (ceilEnd > ceilStart) {
      const cX1 = pad.left + ((ceilStart - minStrike) / (maxStrike - minStrike)) * chartW;
      const cX2 = pad.left + ((ceilEnd - minStrike) / (maxStrike - minStrike)) * chartW;
      ctx.fillStyle = 'rgba(248,113,113,0.08)';
      ctx.fillRect(cX1, pad.top, cX2 - cX1, chartH);
    }

    // ── Bars (GEX) ──
    const barW = Math.max(strikeW * 0.6, 2);
    profile.forEach((p, i) => {
      const x = pad.left + i * strikeW - barW / 2;
      const val = p.net_gex;
      const barH = (Math.abs(val) / maxAbs) * (chartH / 2);
      const y = val >= 0 ? zeroY - barH : zeroY;
      const color = val >= 0 ? 'rgba(74,222,128,0.6)' : 'rgba(248,113,113,0.6)';
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barW, barH);
    });

    // ── DEX overlay (if toggled) ──
    if (overlay === 'dex' || overlay === 'all') {
      ctx.strokeStyle = '#7cb9f4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      profile.forEach((p, i) => {
        const x = pad.left + i * strikeW;
        const dexFrac = (p.dex || 0) / maxDex; // normalize
        const y = zeroY - dexFrac * (chartH / 2);
        if (i === 0) ctx.moveTo(x, Math.max(pad.top, Math.min(pad.top + chartH, y)));
        else ctx.lineTo(x, Math.max(pad.top, Math.min(pad.top + chartH, y)));
      });
      ctx.stroke();
    }

    // ── Current price line ──
    ctx.strokeStyle = cssAccent;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(priceX, pad.top);
    ctx.lineTo(priceX, pad.top + chartH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Price label
    ctx.fillStyle = cssAccent;
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Utils.formatPrice(currentPrice), priceX, pad.top - 5);

    // ── Axis labels ──
    ctx.fillStyle = cssTextMuted;
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    const labelStep = Math.max(1, Math.floor(strikes.length / 8));
    strikes.forEach((s, i) => {
      if (i % labelStep === 0 || i === strikes.length - 1 || s === currentPrice) {
        const x = pad.left + i * strikeW;
        ctx.fillText(String(s), x, pad.top + chartH + 18);
      }
    });

    // ── Y-axis label ──
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('+' + this._fmtGexShort(maxAbs), pad.left - 6, pad.top + 4);
    ctx.fillText('-' + this._fmtGexShort(maxAbs), pad.left - 6, pad.top + chartH - 4);
    ctx.textBaseline = 'middle';
    ctx.fillText('0', pad.left - 6, zeroY);

    // ── Zone labels ──
    ctx.font = 'bold 9px "IBM Plex Mono", monospace';
    if (floorEnd > floorStart) {
      const fX = pad.left + ((floorStart + floorEnd) / 2 - minStrike) / (maxStrike - minStrike) * chartW;
      ctx.fillStyle = 'rgba(74,222,128,0.7)';
      ctx.textAlign = 'center';
      ctx.fillText('🛡️ FLOOR ZONE', fX, pad.top + chartH - 4);
    }
    if (ceilEnd > ceilStart) {
      const cX = pad.left + ((ceilStart + ceilEnd) / 2 - minStrike) / (maxStrike - minStrike) * chartW;
      ctx.fillStyle = 'rgba(248,113,113,0.7)';
      ctx.textAlign = 'center';
      ctx.fillText('🚧 CEILING ZONE', cX, pad.top + 12);
    }

    // ── Legend ──
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '9px "IBM Plex Mono", monospace';
    ctx.fillStyle = 'rgba(74,222,128,0.7)';
    ctx.fillRect(w - 130, pad.top + 4, 8, 8);
    ctx.fillStyle = cssTextMuted;
    ctx.fillText('+GEX (support)', w - 118, pad.top + 2);
    ctx.fillStyle = 'rgba(248,113,113,0.7)';
    ctx.fillRect(w - 130, pad.top + 18, 8, 8);
    ctx.fillStyle = cssTextMuted;
    ctx.fillText('-GEX (resistance)', w - 118, pad.top + 16);
  },

  /* ─────────────────────────────────────────────────────────────
     WIDGET 3: FLOOR / CEILING ZONE CARDS
     ───────────────────────────────────────────────────────────── */
  _buildZoneCards(data, ticker) {
    const t = data.tickers[ticker];
    const floor = t.floor_zone;
    const ceiling = t.ceiling_zone;
    let html = '';

    if (floor) {
      html += `
        <div class="mg-zone-card mg-zone-floor" data-zone="floor">
          <div class="mg-zone-icon">🛡️</div>
          <div class="mg-zone-name">Gamma Floor</div>
          <div class="mg-zone-range">${Utils.formatPrice(floor.range_start)} — ${Utils.formatPrice(floor.range_end)}</div>
          <div><span class="mg-zone-strength ${floor.strength}">${floor.strength}</span></div>
          <div class="mg-zone-gex">Total GEX: <strong class="positive">+${this._fmtGex(floor.total_gex)}</strong></div>
          <div class="mg-zone-narrative">"${floor.narrative}"</div>
          <div class="mg-zone-detail" id="mg-zone-detail-floor"></div>
        </div>`;
    }

    if (ceiling) {
      html += `
        <div class="mg-zone-card mg-zone-ceiling" data-zone="ceiling">
          <div class="mg-zone-icon">🚧</div>
          <div class="mg-zone-name">Gamma Ceiling</div>
          <div class="mg-zone-range">${Utils.formatPrice(ceiling.range_start)} — ${Utils.formatPrice(ceiling.range_end)}</div>
          <div><span class="mg-zone-strength ${ceiling.strength}">${ceiling.strength}</span></div>
          <div class="mg-zone-gex">Total GEX: <strong class="negative">${this._fmtGex(ceiling.total_gex)}</strong></div>
          <div class="mg-zone-narrative">"${ceiling.narrative}"</div>
          <div class="mg-zone-detail" id="mg-zone-detail-ceiling"></div>
        </div>`;
    }

    return html;
  },

  /* ─────────────────────────────────────────────────────────────
     WIDGET 4: FULL GAMMA TABLE
     ───────────────────────────────────────────────────────────── */
  _buildGammaTableHTML(data, ticker) {
    const t = data.tickers[ticker];
    const profile = t.gamma_profile;
    const currentPrice = t.current_price;
    const strikeRange = profile.length > 1 ? profile[profile.length - 1].strike - profile[0].strike : 100;
    const threshold = Math.max(strikeRange * 0.001, 1);

    let rows = profile.map((p, i) => {
      const isFirst = i === 0 && currentPrice <= profile[0].strike;
      const isLast = i === profile.length - 1 && currentPrice >= profile[i].strike;
      const isCurrent = isFirst || isLast || (i > 0 && currentPrice >= profile[i-1].strike && currentPrice < p.strike);
      const isExact = Math.abs(p.strike - currentPrice) < threshold;
      const rowCls = (isCurrent || isExact) ? 'current-price' : '';
      const netCls = p.net_gex >= 0 ? 'mg-gex-pos' : 'mg-gex-neg';
      return `<tr class="${rowCls}">
        <td>${Utils.formatPrice(p.strike, 0)}</td>
        <td class="mg-gex-pos">${this._fmtGexShort(p.call_gex)}</td>
        <td class="mg-gex-neg">${this._fmtGexShort(p.put_gex)}</td>
        <td class="${netCls}">${this._fmtGexShort(p.net_gex)}</td>
        <td>${p.dex >= 0 ? '+' : ''}${p.dex.toFixed(2)}</td>
        <td>${this._fmtGexShort(p.vex)}</td>
        <td>${p.oi.toLocaleString()}</td>
      </tr>`;
    }).join('');

    return `
      <div class="mg-table-card">
        <div class="mg-table-header">
          <div class="mg-table-title">Gamma Exposure Table — ${ticker} — All Expirations</div>
          <div class="mg-table-actions">
            <button class="mg-table-btn" onclick="MapleGamma._exportCSV('${ticker}')">📥 Export CSV</button>
          </div>
        </div>
        <div style="overflow-x:auto">
          <table class="mg-gamma-table" id="mg-gamma-table">
            <thead>
              <tr>
                <th data-sort="strike">Strike</th>
                <th data-sort="call_gex">Calls GEX</th>
                <th data-sort="put_gex">Puts GEX</th>
                <th data-sort="net_gex">Net GEX</th>
                <th data-sort="dex">DEX</th>
                <th data-sort="vex">VEX</th>
                <th data-sort="oi">OI</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  },

  /* ─────────────────────────────────────────────────────────────
     WIDGET 5: NET GEX BY EXPIRATION
     ───────────────────────────────────────────────────────────── */
  _buildExpiryHTML(data, ticker) {
    const t = data.tickers[ticker];
    if (!t.gex_by_expiration) return '';
    return t.gex_by_expiration.map(e => `
      <div class="mg-expiry-card">
        <div class="mg-expiry-name">${e.bucket}</div>
        <div class="mg-expiry-dot ${e.color}"></div>
        <div class="mg-expiry-value ${e.color}">${e.net_gex >= 0 ? '+' : ''}${this._fmtGex(e.net_gex)}</div>
        <div class="mg-expiry-note">${e.narrative}</div>
      </div>
    `).join('');
  },

  /* ─────────────────────────────────────────────────────────────
     WIDGET 6: OI HEATMAP
     ───────────────────────────────────────────────────────────── */
  _buildOIHeatmapHTML(data, ticker) {
    const t = data.tickers[ticker];
    const h = t.oi_heatmap;
    if (!h) return '<div style="padding:20px;color:var(--text-muted);text-align:center">No OI heatmap data available.</div>';

    // Find max value for normalization
    const vals = h.values;
    const allVals = vals && Array.isArray(vals) ? vals.flat() : [];
    const maxVal = allVals.length ? Math.max(...allVals, 1) : 1;

    let html = '<table class="mg-heatmap"><thead><tr><th>Strike</th>';
    h.weeks.forEach(w => { html += `<th>${w}</th>`; });
    html += '</tr></thead><tbody>';

    h.strikes.forEach((strike, i) => {
      html += `<tr><td>${Utils.formatPrice(strike, 0)}</td>`;
      h.values[i].forEach(v => {
        const intensity = v / maxVal;
        const r = Math.round(226 * intensity);
        const g = Math.round(168 * (1 - intensity * 0.5));
        const b = Math.round(74 * (1 - intensity * 0.7));
        const bg = `rgba(${r}, ${g}, ${b}, ${0.15 + intensity * 0.4})`;
        const textColor = intensity > 0.5 ? 'var(--text-primary)' : 'var(--text-body)';
        html += `<td style="background:${bg};color:${textColor}">${v}%</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    html += '<div class="heat-label" style="text-align:right;padding:6px 10px">OI concentration: lighter = lower, darker = higher</div>';
    return html;
  },

  /* ─────────────────────────────────────────────────────────────
     WIDGET 7: UNUSUAL OPTIONS FLOW
     ───────────────────────────────────────────────────────────── */
  _buildFlowHTML(data) {
    const flow = data.unusual_flow || [];
    let rows = flow.map(f => {
      const sentCls = f.sentiment === 'bullish' ? 'mg-sentiment-bull' : 'mg-sentiment-bear';
      const sentIcon = f.sentiment === 'bullish' ? '🟢' : '🔴';
      const premCls = f.premium >= 0 ? 'positive' : 'negative';
      return `<tr>
        <td>${f.ticker}</td>
        <td>${f.action}</td>
        <td>${Utils.formatPrice(f.strike, 0)}</td>
        <td>${f.expiration}</td>
        <td class="mg-flow-prem ${premCls}">${f.premium >= 0 ? '+' : ''}${this._fmtGex(f.premium)}</td>
        <td class="${sentCls}">${sentIcon} ${f.sentiment}</td>
      </tr>`;
    }).join('');

    return `
      <div class="mg-flow-card">
        <div class="mg-flow-header">
          <div class="mg-flow-title">🐋 Unusual Options Flow</div>
          <a href="javascript:void(0)" class="mg-flow-link" onclick="MapleGamma._toggleFlow()">View All Flow →</a>
        </div>
        <div style="overflow-x:auto">
          <table class="mg-flow-table">
            <thead>
              <tr><th>Ticker</th><th>Action</th><th>Strike</th><th>Exp</th><th>Premium</th><th>Sentiment</th></tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No unusual flow in the last 24h</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
  },

  /* ─────────────────────────────────────────────────────────────
     INTERACTIONS
     ───────────────────────────────────────────────────────────── */
  _wireInteractions(data) {
    const self = this;

    // ── Ticker pills ──
    document.querySelectorAll('.mg-ticker-pill').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.mg-ticker-pill').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const ticker = this.dataset.ticker;
        self._selectedTicker = ticker;
        self._updateDashboardForTicker(data, ticker);
      });
    });

    // ── Expiry pills ──
    document.querySelectorAll('.mg-expiry-pill').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.mg-expiry-pill').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        // Future: filter chart/table by selected expiry bucket
        // For now, visual selection only — data filtering is a feature enhancement
      });
    });

    // ── Chart overlay toggles ──
    document.querySelectorAll('#mg-chart-overlays .mg-chart-toggle').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#mg-chart-overlays .mg-chart-toggle').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        self._selectedOverlay = this.dataset.overlay;
        self._drawGammaChart(data, self._selectedTicker, self._selectedOverlay);
      });
    });

    // ── Zone card expand ──
    document.querySelectorAll('.mg-zone-card').forEach(card => {
      card.addEventListener('click', function () {
        const detail = this.querySelector('.mg-zone-detail');
        if (!detail) return;
        const isOpen = detail.classList.contains('open');
        detail.classList.toggle('open');
        if (!isOpen && !detail.dataset.loaded) {
          const zone = this.dataset.zone;
          self._loadZoneDetail(data, self._selectedTicker, zone, detail);
          detail.dataset.loaded = '1';
        }
      });
    });

    // ── Mode toggle: Beginner vs Advanced ──
    document.querySelectorAll('#mg-mode-toggle input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', function () {
        document.querySelectorAll('#mg-mode-toggle label').forEach(l => l.classList.remove('active'));
        this.parentElement.classList.add('active');
        const mode = this.value;
        self._toggleTableMode(data, self._selectedTicker, mode);
      });
    });

    // ── Table sorting ──
    document.querySelectorAll('#mg-gamma-table thead th').forEach(th => {
      th.addEventListener('click', function () {
        const sortKey = this.dataset.sort;
        if (!sortKey) return;
        const isAsc = this.classList.contains('sorted-asc');
        document.querySelectorAll('#mg-gamma-table thead th').forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
        this.classList.add(isAsc ? 'sorted-desc' : 'sorted-asc');
        self._sortGammaTable(data, self._selectedTicker, sortKey, !isAsc);
      });
    });
  },

  /* ─────────────────────────────────────────────────────────────
     UPDATE DASHBOARD ON TICKER SWITCH
     ───────────────────────────────────────────────────────────── */
  _updateDashboardForTicker(data, ticker) {
    const t = data.tickers[ticker];
    if (!t) return;

    // Update metrics bar
    document.getElementById('mg-metrics-bar').outerHTML = this._buildMetricsBar(data, ticker);

    // Update chart narrative
    const narrativeEl = document.getElementById('mg-chart-narrative');
    if (narrativeEl) narrativeEl.textContent = '▶ ' + t.narrative;

    // Update chart
    this._drawGammaChart(data, ticker, this._selectedOverlay);

    // Update zone cards
    document.getElementById('mg-zone-grid').innerHTML = this._buildZoneCards(data, ticker);
    // Re-wire zone cards
    document.querySelectorAll('.mg-zone-card').forEach(card => {
      card.addEventListener('click', function () {
        const detail = this.querySelector('.mg-zone-detail');
        if (!detail) return;
        const isOpen = detail.classList.contains('open');
        detail.classList.toggle('open');
        if (!isOpen && !detail.dataset.loaded) {
          const zone = this.dataset.zone;
          MapleGamma._loadZoneDetail(data, ticker, zone, detail);
          detail.dataset.loaded = '1';
        }
      });
    });
    // Reset load flags
    document.querySelectorAll('.mg-zone-detail').forEach(d => d.dataset.loaded = '');

    // Update gamma table
    document.getElementById('mg-table-content').innerHTML = this._buildGammaTableHTML(data, ticker);
    // Re-wire table sort
    document.querySelectorAll('#mg-gamma-table thead th').forEach(th => {
      th.addEventListener('click', function () {
        const sortKey = this.dataset.sort;
        if (!sortKey) return;
        const isAsc = this.classList.contains('sorted-asc');
        document.querySelectorAll('#mg-gamma-table thead th').forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
        this.classList.add(isAsc ? 'sorted-desc' : 'sorted-asc');
        MapleGamma._sortGammaTable(data, ticker, sortKey, !isAsc);
      });
    });

    // Update expiry breakdown
    const expiryGrid = document.getElementById('mg-expiry-grid');
    if (expiryGrid && t.gex_by_expiration) {
      expiryGrid.innerHTML = this._buildExpiryHTML(data, ticker);
    }

    // Update OI heatmap
    const heatmapWrap = document.querySelector('.mg-heatmap-wrap');
    if (heatmapWrap && t.oi_heatmap) {
      heatmapWrap.innerHTML = this._buildOIHeatmapHTML(data, ticker);
    }
  },

  /* ─────────────────────────────────────────────────────────────
     ZONE DETAIL (progressive disclosure)
     ───────────────────────────────────────────────────────────── */
  _loadZoneDetail(data, ticker, zone, detailEl) {
    const t = data.tickers[ticker];
    const zoneData = zone === 'floor' ? t.floor_zone : t.ceiling_zone;
    if (!zoneData) return;

    // Find strikes in the zone
    const strikesInZone = t.gamma_profile.filter(p =>
      p.strike >= zoneData.range_start && p.strike <= zoneData.range_end
    );

    if (!strikesInZone.length) {
      detailEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.8rem">No strikes in this zone range.</div>';
      return;
    }

    let html = '<table><thead><tr><th>Strike</th><th>Calls GEX</th><th>Puts GEX</th><th>Net GEX</th><th>OI</th></tr></thead><tbody>';
    strikesInZone.forEach(p => {
      const netCls = p.net_gex >= 0 ? 'mg-gex-pos' : 'mg-gex-neg';
      html += `<tr>
        <td>${Utils.formatPrice(p.strike, 0)}</td>
        <td class="mg-gex-pos">${this._fmtGexShort(p.call_gex)}</td>
        <td class="mg-gex-neg">${this._fmtGexShort(p.put_gex)}</td>
        <td class="${netCls}">${this._fmtGexShort(p.net_gex)}</td>
        <td>${p.oi.toLocaleString()}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    detailEl.innerHTML = html;
  },

  /* ─────────────────────────────────────────────────────────────
     TABLE MODE TOGGLE
     ───────────────────────────────────────────────────────────── */
  _toggleTableMode(data, ticker, mode) {
    const content = document.getElementById('mg-table-content');
    if (mode === 'advanced') {
      // Show the full gamma table
      content.innerHTML = this._buildGammaTableHTML(data, ticker);
      // Re-wire sort
      document.querySelectorAll('#mg-gamma-table thead th').forEach(th => {
        th.addEventListener('click', function () {
          const sortKey = this.dataset.sort;
          if (!sortKey) return;
          const isAsc = this.classList.contains('sorted-asc');
          document.querySelectorAll('#mg-gamma-table thead th').forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
          this.classList.add(isAsc ? 'sorted-desc' : 'sorted-asc');
          MapleGamma._sortGammaTable(data, ticker, sortKey, !isAsc);
        });
      });
    } else {
      // Simple mode: hide the table, show the zone cards reference
      content.innerHTML = `
        <div style="padding:20px 0;color:var(--text-muted);font-size:var(--text-sm);text-align:center">
          🌿 In Beginner Mode, focus on the <strong>Floor &amp; Ceiling Zone cards</strong> above.
          Switch to <strong>Advanced</strong> for the full gamma exposure table.
        </div>`;
    }
  },

  /* ─────────────────────────────────────────────────────────────
     TABLE SORTING
     ───────────────────────────────────────────────────────────── */
  _sortGammaTable(data, ticker, key, ascending) {
    const t = data.tickers[ticker];
    let profile = [...t.gamma_profile];
    const keyMap = {
      'strike': p => p.strike,
      'call_gex': p => p.call_gex,
      'put_gex': p => p.put_gex,
      'net_gex': p => p.net_gex,
      'dex': p => p.dex,
      'vex': p => p.vex,
      'oi': p => p.oi
    };
    const getVal = keyMap[key];
    if (!getVal) return;

    profile.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      return ascending ? va - vb : vb - va;
    });

    const currentPrice = t.current_price;
    const strikeRange = profile.length > 1 ? profile[profile.length - 1].strike - profile[0].strike : 100;
    const threshold = Math.max(strikeRange * 0.001, 1);
    const rows = profile.map((p, i) => {
      const isFirst = i === 0 && currentPrice <= profile[0].strike;
      const isLast = i === profile.length - 1 && currentPrice >= profile[i].strike;
      const isCurrent = isFirst || isLast || (i > 0 && currentPrice >= profile[i-1].strike && currentPrice < p.strike);
      const isExact = Math.abs(p.strike - currentPrice) < threshold;
      const rowCls = (isCurrent || isExact) ? 'current-price' : '';
      const netCls = p.net_gex >= 0 ? 'mg-gex-pos' : 'mg-gex-neg';
      return `<tr class="${rowCls}">
        <td>${Utils.formatPrice(p.strike, 0)}</td>
        <td class="mg-gex-pos">${this._fmtGexShort(p.call_gex)}</td>
        <td class="mg-gex-neg">${this._fmtGexShort(p.put_gex)}</td>
        <td class="${netCls}">${this._fmtGexShort(p.net_gex)}</td>
        <td>${p.dex >= 0 ? '+' : ''}${p.dex.toFixed(2)}</td>
        <td>${this._fmtGexShort(p.vex)}</td>
        <td>${p.oi.toLocaleString()}</td>
      </tr>`;
    }).join('');

    const tbody = document.querySelector('#mg-gamma-table tbody');
    if (tbody) tbody.innerHTML = rows;
  },

  /* ─────────────────────────────────────────────────────────────
     CSV EXPORT
     ───────────────────────────────────────────────────────────── */
  _exportCSV(ticker) {
    // Use cached data from dashboard render
    const data = this._data;
    if (!data || !data.tickers || !data.tickers[ticker]) return;
    const profile = data.tickers[ticker].gamma_profile;
    let csv = 'Strike,Calls GEX,Puts GEX,Net GEX,DEX,VEX,OI\n';
    profile.forEach(p => {
      csv += `${p.strike},${p.call_gex},${p.put_gex},${p.net_gex},${p.dex},${p.vex},${p.oi}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maplegamma-${ticker}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /* ─────────────────────────────────────────────────────────────
     HELPERS
     ───────────────────────────────────────────────────────────── */
  _toggleFlow() {
    const table = document.querySelector('.mg-flow-table');
    if (!table) return;
    const allRows = table.querySelectorAll('tr');
    const hidden = table.querySelector('.mg-flow-hidden');
    if (hidden) {
      // Show all rows
      allRows.forEach(r => r.style.display = '');
      hidden.remove();
      this._toggleFlowBtn = 'Collapse';
    } else {
      // Hide all but first 5, add expand button
      const link = document.querySelector('.mg-flow-link');
      allRows.forEach((r, i) => { if (i > 4 && !i === allRows.length - 1) r.style.display = 'none'; });
      if (link) link.textContent = '^ Collapse';
    }
  },

  _fmtGex(val) {
    if (val == null) return '—';
    const abs = Math.abs(val);
    if (abs >= 1e9) return (val >= 0 ? '+' : '') + (abs / 1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return (val >= 0 ? '+' : '') + (abs / 1e6).toFixed(0) + 'M';
    if (abs >= 1e3) return (val >= 0 ? '+' : '') + (abs / 1e3).toFixed(0) + 'K';
    return (val >= 0 ? '+' : '') + String(val);
  },

  _fmtGexShort(val) {
    if (val == null) return '—';
    const abs = Math.abs(val);
    const sign = val >= 0 ? '+' : '';
    if (abs >= 1e9) return sign + (abs / 1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return sign + (abs / 1e6).toFixed(0) + 'M';
    if (abs >= 1e3) return sign + (abs / 1e3).toFixed(0) + 'K';
    return sign + String(val);
  }
};
