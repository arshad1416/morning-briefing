/**
 * Charts — TradingView-style candlestick chart page using lightweight-charts.
 * Ticker selector, timeframe toggle, indicator overlays (20/50 EMA, VWAP),
 * indicator panes (RSI, ATR), dark/light theme support.
 */
const Charts = {
  // ── 60 V3 tickers ──
  TICKERS: [
    'AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','SPY','QQQ','IWM',
    'DIA','AMD','AVGO','NFLX','ADBE','CRM','INTC','CSCO','PYPL','QCOM',
    'TXN','AMGN','GILD','SBUX','COST','WMT','HD','MCD','NKE','DIS',
    'JPM','BAC','GS','V','MA','UNH','JNJ','PFE','MRK','ABBV',
    'XOM','CVX','BA','CAT','GE','HON','LIN','UPS','RTX','LMT',
    'VZ','T','CMCSA','NEE','SO','DUK','PLD','AMT','CCI','EQIX'
  ],

  // ── State ──
  _chart: null,
  _mainSeries: null,
  _volumeSeries: null,
  _ema20Series: null,
  _ema50Series: null,
  _vwapSeries: null,
  _rsiChart: null,
  _rsiSeries: null,
  _rsiOverbought: null,
  _rsiOversold: null,
  _atrChart: null,
  _atrSeries: null,
  _currentTicker: null,
  _currentTimeframe: '1D',
  _data: null,
  _vpData: null,
  _vpPriceLines: [],
  _resizeObserver: null,
  _themeListener: null,

  // ── Render ──
  async render(app) {
    app.innerHTML = '<div class="loading">Loading charts...</div>';

    // Load saved ticker
    this._currentTicker = localStorage.getItem('charts-ticker') || 'SPY';
    this._currentTimeframe = localStorage.getItem('charts-timeframe') || '1D';

    // Build page shell
    app.innerHTML = this._buildPageShell();

    // Load data
    await this._loadData(app);

    // Wire UI controls
    this._wireTickerSelector(app);
    this._wireTimeframeButtons(app);
    this._wireThemeListener(app);

    // Resize handler
    this._setupResizeObserver(app);
  },

  // ── Page HTML ──
  _buildPageShell() {
    return `
      <div class="charts-page">
        <div class="charts-header">
          <h2 class="section-title" style="margin:0">Charts</h2>
          <div class="charts-controls">
            <div class="ticker-selector-wrapper" id="ticker-selector-wrapper">
              <input
                type="text"
                id="ticker-search"
                placeholder="Search ticker..."
                value="${this._currentTicker}"
                autocomplete="off"
                spellcheck="false"
              />
              <div class="ticker-dropdown" id="ticker-dropdown"></div>
            </div>
            <div class="timeframe-group">
              <button class="timeframe-btn ${this._currentTimeframe === '1D' ? 'active' : ''}" data-tf="1D">1D</button>
              <button class="timeframe-btn ${this._currentTimeframe === '1W' ? 'active' : ''}" data-tf="1W">1W</button>
              <button class="timeframe-btn ${this._currentTimeframe === '1M' ? 'active' : ''}" data-tf="1M">1M</button>
              <button class="timeframe-btn ${this._currentTimeframe === '1Y' ? 'active' : ''}" data-tf="1Y">1Y</button>
            </div>
          </div>
        </div>
        <div id="charts-main" class="charts-main">
          <div class="chart-card">
            <div class="chart-container-wrap">
              <div id="main-chart-container"></div>
            </div>
            <div class="chart-legend" id="chart-legend"></div>
            <div class="chart-info-bar" id="chart-info-bar"></div>
          </div>
          <div class="chart-card">
            <div class="chart-container-wrap">
              <div id="rsi-chart-container" class="indicator-pane-container rsi-pane"></div>
            </div>
          </div>
          <div class="chart-card">
            <div class="chart-container-wrap">
              <div id="atr-chart-container" class="indicator-pane-container atr-pane"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // ── Load Data ──
  async _loadData(app) {
    const container = document.getElementById('charts-main');
    if (!container) return;

    // Show loading
    container.innerHTML = '<div class="charts-loading">Loading chart data...</div>';

    try {
      const url = `/data/charts/${this._currentTicker}.json`;
      const data = await State.get('chart-' + this._currentTicker, url).catch(() => null);

      if (!data) {
        container.innerHTML = `
          <div class="charts-error">
            <div class="error-icon">📈</div>
            <div class="error-text">No chart data available for <strong>${this._currentTicker}</strong>.</div>
            <div class="error-hint">The Phase 1 Pi data pipeline hasn't generated this file yet. Check back after the next data run.</div>
          </div>
        `;
        return;
      }

      this._data = data;

      // Get timeframe data
      const tf = this._currentTimeframe;
      const ohlcv = data.timeframes && data.timeframes[tf];

      if (!ohlcv || !ohlcv.length) {
        container.innerHTML = `
          <div class="charts-error">
            <div class="error-icon">⏳</div>
            <div class="error-text">No <strong>${tf}</strong> data for ${this._currentTicker}.</div>
            <div class="error-hint">Try a different timeframe.</div>
          </div>
        `;
        return;
      }

      // Rebuild the chart containers (they were overwritten by loading state)
      container.innerHTML = `
        <div class="chart-card">
          <div class="chart-container-wrap">
            <div id="main-chart-container"></div>
          </div>
          <div class="chart-legend" id="chart-legend"></div>
          <div class="chart-info-bar" id="chart-info-bar"></div>
        </div>
        <div class="chart-card">
          <div class="chart-container-wrap">
            <div id="rsi-chart-container" class="indicator-pane-container rsi-pane"></div>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-container-wrap">
            <div id="atr-chart-container" class="indicator-pane-container atr-pane"></div>
          </div>
        </div>
      `;

      // Render charts
      this._renderCharts(ohlcv);

    } catch (err) {
      console.error('Charts load error:', err);
      container.innerHTML = `
        <div class="charts-error">
          <div class="error-icon">⚠</div>
          <div class="error-text">Error loading chart data.</div>
          <div class="error-hint">${Utils.esc(err.message)}</div>
        </div>
      `;
    }
  },

  // ── Render Charts ──
  _renderCharts(ohlcv) {
    const theme = this._getTheme();
    const isDark = theme === 'dark';

    // Colors
    const bgColor = isDark ? '#1F1E1A' : '#FFFFFF';
    const textColor = isDark ? '#D6D0C4' : '#1A1813';
    const gridColor = isDark ? '#2A2824' : '#E7E2D5';
    const borderColor = isDark ? '#2A2824' : '#E7E2D5';
    const upColor = '#4CAF50';
    const downColor = '#EF5350';
    const volumeUpColor = 'rgba(76,175,80,0.4)';
    const volumeDownColor = 'rgba(239,83,80,0.4)';

    const chartOptions = {
      layout: {
        background: { type: 'solid', color: bgColor },
        textColor: textColor,
        fontSize: 11,
        fontFamily: "'Spline Sans Mono', monospace",
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: isDark ? '#5A5448' : '#A39C8A', style: LightweightCharts.LineStyle.Dashed, labelBackgroundColor: isDark ? '#35322D' : '#E7E2D5' },
        horzLine: { color: isDark ? '#5A5448' : '#A39C8A', style: LightweightCharts.LineStyle.Dashed, labelBackgroundColor: isDark ? '#35322D' : '#E7E2D5' },
      },
      rightPriceScale: {
        borderColor: borderColor,
        scaleMargins: { top: 0.05, bottom: 0.25 },
      },
      timeScale: {
        borderColor: borderColor,
        timeVisible: false,
        secondsVisible: false,
        tickMarkFormatter: (time) => {
          const d = new Date(time * 1000);
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const yy = String(d.getFullYear()).slice(-2);
          return `${mm}/${dd}/${yy}`;
        },
      },
      width: document.getElementById('main-chart-container').clientWidth || 800,
      height: 480,
    };

    // Clean up previous chart
    this._destroyCharts();

    // Create main chart
    const mainContainer = document.getElementById('main-chart-container');
    if (!mainContainer) return;

    const chart = LightweightCharts.createChart(mainContainer, chartOptions);
    this._chart = chart;

    // ── Candlestick series ──
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: upColor,
      downColor: downColor,
      borderUpColor: upColor,
      borderDownColor: downColor,
      wickUpColor: upColor,
      wickDownColor: downColor,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    const candlestickData = ohlcv.map(d => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    candlestickSeries.setData(candlestickData);
    this._mainSeries = candlestickSeries;

    // ── Volume bars ──
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const volumeData = ohlcv.map(d => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? volumeUpColor : volumeDownColor,
    }));

    volumeSeries.setData(volumeData);
    this._volumeSeries = volumeSeries;

    // ── Indicator calculations ──
    const ema20 = this._calcEMA(ohlcv, 20);
    const ema50 = this._calcEMA(ohlcv, 50);
    const vwap = this._calcVWAP(ohlcv);

    // ── 20 EMA overlay ──
    const ema20Series = chart.addLineSeries({
      color: '#FF9800',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: '20 EMA',
    });
    ema20Series.setData(ema20);
    this._ema20Series = ema20Series;

    // ── 50 EMA overlay ──
    const ema50Series = chart.addLineSeries({
      color: '#E91E63',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: '50 EMA',
    });
    ema50Series.setData(ema50);
    this._ema50Series = ema50Series;

    // ── VWAP overlay ──
    const vwapSeries = chart.addLineSeries({
      color: '#2196F3',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'VWAP',
    });
    vwapSeries.setData(vwap);
    this._vwapSeries = vwapSeries;

    // ── Volume Profile ──
    const vpPeriod = this._currentTimeframe === '1D' ? 50 :
                     this._currentTimeframe === '1W' ? 20 :
                     this._currentTimeframe === '1M' ? 12 :
                     this._currentTimeframe === '1Y' ? 5 : 20;
    this._vpData = this._calcVolumeProfile(ohlcv, vpPeriod);
    this._renderVolumeProfile();

    // Fit content
    chart.timeScale().fitContent();

    // ── Info bar ──
    this._updateInfoBar(ohlcv);

    // ── Legend ──
    this._updateLegend();

    // ── RSI Pane ──
    this._renderRSI(ohlcv, theme);

    // ── ATR Pane ──
    this._renderATR(ohlcv, theme);
  },

  // ── RSI Pane ──
  _renderRSI(ohlcv, theme) {
    const rsiContainer = document.getElementById('rsi-chart-container');
    if (!rsiContainer) return;

    const isDark = theme === 'dark';
    const bgColor = isDark ? '#1F1E1A' : '#FFFFFF';
    const textColor = isDark ? '#D6D0C4' : '#1A1813';
    const gridColor = isDark ? '#2A2824' : '#E7E2D5';
    const borderColor = isDark ? '#2A2824' : '#E7E2D5';
    const width = rsiContainer.clientWidth || 800;

    const rsiChart = LightweightCharts.createChart(rsiContainer, {
      layout: {
        background: { type: 'solid', color: bgColor },
        textColor: textColor,
        fontSize: 10,
        fontFamily: "'Spline Sans Mono', monospace",
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      rightPriceScale: {
        borderColor: borderColor,
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
      timeScale: {
        borderColor: borderColor,
        visible: false,
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: isDark ? '#5A5448' : '#A39C8A', style: LightweightCharts.LineStyle.Dashed, labelBackgroundColor: isDark ? '#35322D' : '#E7E2D5' },
        horzLine: { color: isDark ? '#5A5448' : '#A39C8A', style: LightweightCharts.LineStyle.Dashed, labelBackgroundColor: isDark ? '#35322D' : '#E7E2D5' },
      },
      width: width,
      height: 155,
    });
    this._rsiChart = rsiChart;

    // RSI line
    const rsiData = this._calcRSI(ohlcv, 14);
    const rsiSeries = rsiChart.addLineSeries({
      color: '#9C27B0',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'RSI (14)',
    });
    rsiSeries.setData(rsiData);
    this._rsiSeries = rsiSeries;

    // Overbought line (70)
    const obLine = rsiChart.addLineSeries({
      color: 'rgba(239,83,80,0.5)',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const obData = rsiData.map(d => ({ time: d.time, value: 70 }));
    obLine.setData(obData);
    this._rsiOverbought = obLine;

    // Oversold line (30)
    const osLine = rsiChart.addLineSeries({
      color: 'rgba(76,175,80,0.5)',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const osData = rsiData.map(d => ({ time: d.time, value: 30 }));
    osLine.setData(osData);
    this._rsiOversold = osLine;

    // Label
    const labelEl = document.createElement('div');
    labelEl.style.cssText = `position:absolute;top:2px;left:8px;font-size:0.65rem;font-family:'Spline Sans Mono',monospace;color:${textColor};text-transform:uppercase;letter-spacing:0.06em;opacity:0.7;z-index:10`;
    labelEl.textContent = 'RSI (14)';
    rsiContainer.style.position = 'relative';
    rsiContainer.appendChild(labelEl);

    rsiChart.timeScale().fitContent();
  },

  // ── ATR Pane ──
  _renderATR(ohlcv, theme) {
    const atrContainer = document.getElementById('atr-chart-container');
    if (!atrContainer) return;

    const isDark = theme === 'dark';
    const bgColor = isDark ? '#1F1E1A' : '#FFFFFF';
    const textColor = isDark ? '#D6D0C4' : '#1A1813';
    const gridColor = isDark ? '#2A2824' : '#E7E2D5';
    const borderColor = isDark ? '#2A2824' : '#E7E2D5';
    const width = atrContainer.clientWidth || 800;

    const atrChart = LightweightCharts.createChart(atrContainer, {
      layout: {
        background: { type: 'solid', color: bgColor },
        textColor: textColor,
        fontSize: 10,
        fontFamily: "'Spline Sans Mono', monospace",
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      rightPriceScale: {
        borderColor: borderColor,
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
      timeScale: {
        borderColor: borderColor,
        visible: false,
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: isDark ? '#5A5448' : '#A39C8A', style: LightweightCharts.LineStyle.Dashed, labelBackgroundColor: isDark ? '#35322D' : '#E7E2D5' },
        horzLine: { color: isDark ? '#5A5448' : '#A39C8A', style: LightweightCharts.LineStyle.Dashed, labelBackgroundColor: isDark ? '#35322D' : '#E7E2D5' },
      },
      width: width,
      height: 135,
    });
    this._atrChart = atrChart;

    const atrData = this._calcATR(ohlcv, 14);
    const atrSeries = atrChart.addLineSeries({
      color: '#FF5722',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'ATR (14)',
    });
    atrSeries.setData(atrData);
    this._atrSeries = atrSeries;

    // Label
    const labelEl = document.createElement('div');
    labelEl.style.cssText = `position:absolute;top:2px;left:8px;font-size:0.65rem;font-family:'Spline Sans Mono',monospace;color:${textColor};text-transform:uppercase;letter-spacing:0.06em;opacity:0.7;z-index:10`;
    labelEl.textContent = 'ATR (14)';
    atrContainer.style.position = 'relative';
    atrContainer.appendChild(labelEl);

    atrChart.timeScale().fitContent();
  },

  // ── Update Info Bar ──
  _updateInfoBar(ohlcv) {
    const bar = document.getElementById('chart-info-bar');
    if (!bar || !ohlcv.length) return;

    const last = ohlcv[ohlcv.length - 1];
    const prev = ohlcv.length > 1 ? ohlcv[ohlcv.length - 2] : null;
    const change = prev ? last.close - prev.close : 0;
    const changePct = prev && prev.close > 0 ? (change / prev.close) * 100 : 0;
    const changeClass = change >= 0 ? 'positive' : 'negative';
    const changeSign = change >= 0 ? '+' : '';

    // Volume sum
    const totalVolume = ohlcv.reduce((s, d) => s + d.volume, 0);
    const avgVolume = totalVolume / ohlcv.length;
    const volumeStr = avgVolume >= 1e9 ? (avgVolume / 1e9).toFixed(2) + 'B' :
                      avgVolume >= 1e6 ? (avgVolume / 1e6).toFixed(2) + 'M' :
                      avgVolume >= 1e3 ? (avgVolume / 1e3).toFixed(1) + 'K' :
                      avgVolume.toFixed(0);

    const dateStr = last.time || '';

    // Volume Profile snippet
    let vpHtml = '';
    if (this._vpData && ohlcv.length >= 10) {
      const vp = this._vpData;
      const pocVolStr = vp.poc.volume >= 1e6 ? (vp.poc.volume / 1e6).toFixed(1) + 'M' :
                        vp.poc.volume >= 1e3 ? (vp.poc.volume / 1e3).toFixed(1) + 'K' :
                        vp.poc.volume.toFixed(0);
      vpHtml = `
        <div class="chart-info-separator"></div>
        <div class="chart-info-item">
          <span class="chart-info-label vp-poc">POC</span>
          <span class="chart-info-value vp-poc">$${vp.poc.price.toFixed(2)}</span>
          <span class="chart-info-label" style="font-size:0.6rem;opacity:0.6">(${pocVolStr})</span>
        </div>
        <div class="chart-info-item">
          <span class="chart-info-label vp-vah">VAH</span>
          <span class="chart-info-value vp-vah">$${vp.vah.price.toFixed(2)}</span>
        </div>
        <div class="chart-info-item">
          <span class="chart-info-label vp-val">VAL</span>
          <span class="chart-info-value vp-val">$${vp.val.price.toFixed(2)}</span>
        </div>
        <div class="chart-info-item">
          <span class="chart-info-label">VA%</span>
          <span class="chart-info-value">${vp.valueAreaPct.toFixed(1)}%</span>
        </div>
      `;
    }

    bar.innerHTML = `
      <div class="chart-info-item">
        <span class="chart-info-label">${this._currentTicker}</span>
        <span class="chart-info-value">${Utils.formatPrice(last.close)}</span>
        <span class="chart-info-value ${changeClass}">${changeSign}${change.toFixed(2)} (${changeSign}${changePct.toFixed(2)}%)</span>
      </div>
      <div class="chart-info-item">
        <span class="chart-info-label">Open</span>
        <span class="chart-info-value">${Utils.formatPrice(last.open)}</span>
      </div>
      <div class="chart-info-item">
        <span class="chart-info-label">High</span>
        <span class="chart-info-value">${Utils.formatPrice(last.high)}</span>
      </div>
      <div class="chart-info-item">
        <span class="chart-info-label">Low</span>
        <span class="chart-info-value">${Utils.formatPrice(last.low)}</span>
      </div>
      <div class="chart-info-item">
        <span class="chart-info-label">Prev Close</span>
        <span class="chart-info-value">${prev ? Utils.formatPrice(prev.close) : '—'}</span>
      </div>
      <div class="chart-info-item">
        <span class="chart-info-label">Avg Vol</span>
        <span class="chart-info-value">${volumeStr}</span>
      </div>
      ${vpHtml}
      <div class="chart-info-item" style="margin-left:auto">
        <span class="chart-info-label">${dateStr}</span>
      </div>
    `;
  },

  // ── Legend ──
  _updateLegend() {
    const legend = document.getElementById('chart-legend');
    if (!legend) return;

    legend.innerHTML = `
      <div class="chart-legend-item">
        <span class="chart-legend-swatch" style="background:#FF9800"></span>
        20 EMA
      </div>
      <div class="chart-legend-item">
        <span class="chart-legend-swatch" style="background:#E91E63"></span>
        50 EMA
      </div>
      <div class="chart-legend-item">
        <span class="chart-legend-swatch" style="background:#2196F3"></span>
        VWAP
      </div>
      <div class="chart-legend-item">
        <span class="chart-legend-swatch" style="background:#FF9800;height:2px;border-top:2px solid #FF9800"></span>
        POC
      </div>
      <div class="chart-legend-item">
        <span class="chart-legend-swatch" style="background:transparent;border-top:2px dashed #4CAF50"></span>
        VAH
      </div>
      <div class="chart-legend-item">
        <span class="chart-legend-swatch" style="background:transparent;border-top:2px dashed #F44336"></span>
        VAL
      </div>
      <div class="chart-legend-item">
        <span class="chart-legend-swatch" style="background:#9C27B0"></span>
        RSI (14)
      </div>
      <div class="chart-legend-item">
        <span class="chart-legend-swatch" style="background:#FF5722"></span>
        ATR (14)
      </div>
    `;
  },

  // ── Ticker Selector ──
  _wireTickerSelector(app) {
    const input = document.getElementById('ticker-search');
    const dropdown = document.getElementById('ticker-dropdown');
    if (!input || !dropdown) return;

    let highlightedIndex = -1;
    let filteredTickers = this.TICKERS;

    const renderDropdown = (filter) => {
      const q = filter.toUpperCase();
      filteredTickers = this.TICKERS.filter(t => t.includes(q));
      highlightedIndex = -1;

      if (!filteredTickers.length) {
        dropdown.innerHTML = '<div class="ticker-dropdown-item" style="color:var(--text-muted);cursor:default">No matches</div>';
        dropdown.classList.add('open');
        return;
      }

      dropdown.innerHTML = filteredTickers.map((t, i) =>
        `<div class="ticker-dropdown-item" data-ticker="${t}" data-index="${i}">
          <span>${t}</span>
        </div>`
      ).join('');
      dropdown.classList.add('open');

      // Highlight first
      const first = dropdown.querySelector('[data-index="0"]');
      if (first) first.classList.add('highlighted');
    };

    const selectTicker = (ticker) => {
      input.value = ticker;
      dropdown.classList.remove('open');
      dropdown.innerHTML = '';
      if (ticker !== this._currentTicker) {
        this._currentTicker = ticker;
        localStorage.setItem('charts-ticker', ticker);
        this._loadData(app);
      }
    };

    // Input events
    input.addEventListener('input', () => {
      renderDropdown(input.value);
    });

    input.addEventListener('focus', () => {
      renderDropdown(input.value || '');
    });

    // Close on blur (with delay for click)
    input.addEventListener('blur', () => {
      setTimeout(() => dropdown.classList.remove('open'), 200);
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
      const items = dropdown.querySelectorAll('.ticker-dropdown-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
        items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightedIndex));
        if (items[highlightedIndex]) items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, 0);
        items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightedIndex));
        if (items[highlightedIndex]) items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0 && items[highlightedIndex]) {
          selectTicker(items[highlightedIndex].dataset.ticker);
        } else if (filteredTickers.length === 1) {
          selectTicker(filteredTickers[0]);
        }
      } else if (e.key === 'Escape') {
        dropdown.classList.remove('open');
      }
    });

    // Dropdown click
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.ticker-dropdown-item');
      if (item && item.dataset.ticker) {
        selectTicker(item.dataset.ticker);
      }
    });

    // Initial dropdown with all tickers
    renderDropdown('');
  },

  // ── Timeframe Buttons ──
  _wireTimeframeButtons(app) {
    app.querySelectorAll('.timeframe-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tf = btn.dataset.tf;
        if (tf === this._currentTimeframe) return;

        this._currentTimeframe = tf;
        localStorage.setItem('charts-timeframe', tf);

        // Update active state
        app.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Reload data
        this._loadData(app);
      });
    });
  },

  // ── Theme Listener ──
  _wireThemeListener(app) {
    // Remove old listener
    if (this._themeListener) {
      document.removeEventListener('click', this._themeListener);
    }

    this._themeListener = (e) => {
      const toggle = e.target.closest('#theme-toggle');
      if (toggle) {
        // Wait for theme to apply
        setTimeout(() => this._retheme(), 50);
      }
    };

    document.addEventListener('click', this._themeListener);
  },

  // ── Retheme ──
  _retheme() {
    const theme = this._getTheme();
    const isDark = theme === 'dark';
    const bgColor = isDark ? '#1F1E1A' : '#FFFFFF';
    const textColor = isDark ? '#D6D0C4' : '#1A1813';
    const gridColor = isDark ? '#2A2824' : '#E7E2D5';
    const borderColor = isDark ? '#2A2824' : '#E7E2D5';

    const commonOptions = {
      layout: {
        background: { type: 'solid', color: bgColor },
        textColor: textColor,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      rightPriceScale: { borderColor: borderColor },
      timeScale: { borderColor: borderColor },
      crosshair: {
        vertLine: { color: isDark ? '#5A5448' : '#A39C8A', labelBackgroundColor: isDark ? '#35322D' : '#E7E2D5' },
        horzLine: { color: isDark ? '#5A5448' : '#A39C8A', labelBackgroundColor: isDark ? '#35322D' : '#E7E2D5' },
      },
    };

    if (this._chart) {
      this._chart.applyOptions(commonOptions);
    }

    if (this._rsiChart) {
      this._rsiChart.applyOptions(commonOptions);
    }

    if (this._atrChart) {
      this._atrChart.applyOptions(commonOptions);
    }
  },

  // ── Resize Observer ──
  _setupResizeObserver(app) {
    // Clean up old observer
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }

    const mainContainer = document.getElementById('main-chart-container');
    if (!mainContainer) return;

    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          if (this._chart) {
            this._chart.applyOptions({ width: Math.floor(width) });
          }
          const rsiContainer = document.getElementById('rsi-chart-container');
          if (this._rsiChart && rsiContainer) {
            this._rsiChart.applyOptions({ width: Math.floor(rsiContainer.clientWidth) });
          }
          const atrContainer = document.getElementById('atr-chart-container');
          if (this._atrChart && atrContainer) {
            this._atrChart.applyOptions({ width: Math.floor(atrContainer.clientWidth) });
          }
        }
      }
    });

    this._resizeObserver.observe(mainContainer);
  },

  // ── Destroy Charts ──
  _destroyCharts() {
    if (this._chart) {
      this._chart.remove();
      this._chart = null;
    }
    if (this._rsiChart) {
      this._rsiChart.remove();
      this._rsiChart = null;
    }
    if (this._atrChart) {
      this._atrChart.remove();
      this._atrChart = null;
    }

    this._mainSeries = null;
    this._volumeSeries = null;
    this._ema20Series = null;
    this._ema50Series = null;
    this._vwapSeries = null;
    this._rsiSeries = null;
    this._rsiOverbought = null;
    this._rsiOversold = null;
    this._atrSeries = null;
    this._clearVpPriceLines();
    this._vpData = null;
  },

  // ── Theme ──
  _getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  },

  // ═════════════════════════════════════════════════════════════
  //  INDICATOR CALCULATIONS
  // ═════════════════════════════════════════════════════════════

  /**
   * Exponential Moving Average
   */
  _calcEMA(data, period) {
    const k = 2 / (period + 1);
    const result = [];
    let prev = data[0].close;
    data.forEach((d, i) => {
      const val = i === 0 ? d.close : d.close * k + prev * (1 - k);
      result.push({ time: d.time, value: parseFloat(val.toFixed(2)) });
      prev = val;
    });
    return result;
  },

  /**
   * Volume-Weighted Average Price (cumulative)
   */
  _calcVWAP(data) {
    let cumV = 0;
    let cumPV = 0;
    return data.map(d => {
      const typical = (d.high + d.low + d.close) / 3;
      cumPV += typical * d.volume;
      cumV += d.volume;
      return { time: d.time, value: parseFloat((cumPV / cumV).toFixed(2)) };
    });
  },

  /**
   * Relative Strength Index (14-period)
   */
  _calcRSI(data, period) {
    if (data.length < period + 1) return [{ time: data[0].time, value: 50 }];

    const gains = [];
    const losses = [];
    for (let i = 1; i < data.length; i++) {
      const diff = data[i].close - data[i - 1].close;
      gains.push(diff > 0 ? diff : 0);
      losses.push(diff < 0 ? -diff : 0);
    }

    let avgG = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgL = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    const rsi = [{
      time: data[period].time,
      value: avgL === 0 ? 100 : parseFloat((100 - 100 / (1 + avgG / avgL)).toFixed(2)),
    }];

    for (let i = period; i < gains.length; i++) {
      avgG = (avgG * (period - 1) + gains[i]) / period;
      avgL = (avgL * (period - 1) + losses[i]) / period;
      rsi.push({
        time: data[i + 1].time,
        value: avgL === 0 ? 100 : parseFloat((100 - 100 / (1 + avgG / avgL)).toFixed(2)),
      });
    }

    return rsi;
  },

  /**
   * Average True Range (14-period)
   */
  _calcATR(data, period) {
    if (data.length < 2) return [{ time: data[0].time, value: 0 }];

    const tr = [{ time: data[0].time, value: data[0].high - data[0].low }];
    for (let i = 1; i < data.length; i++) {
      const hl = data[i].high - data[i].low;
      const hc = Math.abs(data[i].high - data[i - 1].close);
      const lc = Math.abs(data[i].low - data[i - 1].close);
      tr.push({ time: data[i].time, value: Math.max(hl, hc, lc) });
    }

    // SMA of TR for first ATR value, then use Wilder's smoothed ATR
    if (tr.length < period) return [{ time: tr[tr.length - 1].time, value: 0 }];

    const atr = [];
    let firstAtr = tr.slice(0, period).reduce((s, t) => s + t.value, 0) / period;
    atr.push({ time: tr[period - 1].time, value: parseFloat(firstAtr.toFixed(2)) });

    for (let i = period; i < tr.length; i++) {
      firstAtr = (firstAtr * (period - 1) + tr[i].value) / period;
      atr.push({ time: tr[i].time, value: parseFloat(firstAtr.toFixed(2)) });
    }

    return atr;
  },

  /**
   * Volume Profile — buckets volume by price level over the last N periods.
   * Returns { poc: {price, volume}, vah: {price}, val: {price}, valueAreaVolume, totalVolume }
   * or null if insufficient data.
   */
  _calcVolumeProfile(data, period) {
    const window = data.slice(-period);
    if (window.length < 10) return null;

    // Determine bucket size (~30 buckets across the price range)
    let allLow = Infinity, allHigh = -Infinity;
    for (const d of window) {
      if (d.low < allLow) allLow = d.low;
      if (d.high > allHigh) allHigh = d.high;
    }
    const range = allHigh - allLow;
    if (range === 0) return null; // single price level — no distribution
    const bucketSize = Math.max(0.2, range / 30);

    // Bucket volume by price level (distribute each candle's volume to its midpoint bucket)
    const buckets = {};
    let totalVolume = 0;

    for (const d of window) {
      const vol = d.volume || 0;
      if (vol === 0) continue;
      const price = (d.high + d.low) / 2;
      const bucketIdx = Math.floor((price - allLow) / bucketSize);
      const key = (bucketIdx * bucketSize + allLow).toFixed(2);
      buckets[key] = (buckets[key] || 0) + vol;
      totalVolume += vol;
    }

    if (totalVolume === 0) return null;

    // Sort buckets by price
    const sorted = Object.entries(buckets)
      .map(([price, vol]) => ({ price: parseFloat(price), volume: vol }))
      .sort((a, b) => a.price - b.price);

    // Find POC — the bucket with highest volume
    const poc = sorted.reduce((max, b) => b.volume > max.volume ? b : max, sorted[0]);

    // Calculate Value Area (70% of total volume), expanding outward from POC
    const valueAreaTarget = totalVolume * 0.7;
    const pocIdx = sorted.indexOf(poc);
    let cumVol = poc.volume;
    let upper = pocIdx + 1;
    let lower = pocIdx - 1;

    while (cumVol < valueAreaTarget && (upper < sorted.length || lower >= 0)) {
      const upVol = upper < sorted.length ? sorted[upper].volume : 0;
      const lowVol = lower >= 0 ? sorted[lower].volume : 0;
      if (upVol >= lowVol && upper < sorted.length) {
        cumVol += upVol;
        upper++;
      } else if (lower >= 0) {
        cumVol += lowVol;
        lower--;
      } else {
        break;
      }
    }

    const vahIdx = Math.min(upper - 1, sorted.length - 1);
    const valIdx = Math.max(lower + 1, 0);

    return {
      poc: { price: poc.price, volume: poc.volume },
      vah: { price: sorted[vahIdx].price },
      val: { price: sorted[valIdx].price },
      valueAreaVolume: cumVol,
      totalVolume: totalVolume,
      valueAreaPct: totalVolume > 0 ? (cumVol / totalVolume) * 100 : 0,
    };
  },

  /**
   * Render Volume Profile price lines on the candlestick series.
   */
  _renderVolumeProfile() {
    // Clean up old price lines first
    this._clearVpPriceLines();

    const vp = this._vpData;
    if (!vp) return;

    const series = this._mainSeries;
    if (!series) return;

    const isDark = this._getTheme() === 'dark';

    // Theme-aware colors: orange POC (solid), green VAH (dashed), red VAL (dashed)
    const pocColor = '#FF9800';
    const vahColor = '#4CAF50';
    const valColor = '#F44336';

    this._vpPriceLines.push(series.createPriceLine({
      price: vp.poc.price,
      color: pocColor,
      lineWidth: 2,
      lineStyle: LightweightCharts.LineStyle.Solid,
      axisLabelVisible: true,
      title: `POC ${vp.poc.price.toFixed(2)}`,
    }));

    this._vpPriceLines.push(series.createPriceLine({
      price: vp.vah.price,
      color: vahColor,
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: true,
      title: `VAH ${vp.vah.price.toFixed(2)}`,
    }));

    this._vpPriceLines.push(series.createPriceLine({
      price: vp.val.price,
      color: valColor,
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: true,
      title: `VAL ${vp.val.price.toFixed(2)}`,
    }));
  },

  /**
   * Remove all Volume Profile price lines from the chart.
   */
  _clearVpPriceLines() {
    const series = this._mainSeries;
    if (series && this._vpPriceLines.length) {
      for (const line of this._vpPriceLines) {
        series.removePriceLine(line);
      }
    }
    this._vpPriceLines = [];
  },
};
