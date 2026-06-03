/**
 * Chat — AI ticker analysis via Cloudflare Worker.
 */
const Chat = {
  WORKER_URL: 'https://morning-briefing-chat.rcobwq7u.workers.dev',
  _loading: false,
  _history: [],

  async render(app) {
    let html = '<div class="section"><h2 class="section-title">AI Ticker Analysis</h2>';
    html += '<p style="color:var(--text-secondary);margin-bottom:16px">Enter a ticker symbol for AI-generated analysis with data tables.</p>';

    html += '<div class="chat-container">';
    html += '<div class="chat-input-group">';
    html += '<input type="text" class="chat-input" id="chat-input" placeholder="e.g., AAPL, NVDA, SPY" maxlength="10" autocomplete="off">';
    html += '<button class="chat-btn" id="chat-btn">Analyze</button>';
    html += '</div>';

    html += '<div id="history"></div>';
    html += '<div id="chat-output" class="chat-output"><span style="color:var(--text-muted)">Enter a ticker above to get started.</span></div>';
    html += '</div></div>';

    app.innerHTML = html;

    // Attach event listeners
    const input = document.getElementById('chat-input');
    const btn = document.getElementById('chat-btn');
    const output = document.getElementById('chat-output');
    const historyContainer = document.getElementById('history');

    const analyze = () => {
      const ticker = input.value.trim().toUpperCase();
      if (!ticker || this._loading) return;
      if (!/^[A-Z]{1,5}$/.test(ticker)) {
        output.innerHTML = '<div class="error-card">Invalid ticker. Enter 1-5 uppercase letters (e.g., AAPL).</div>';
        return;
      }
      this.fetchAnalysis(ticker, output, historyContainer);
    };

    btn.addEventListener('click', analyze);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') analyze(); });
    input.focus();
  },

  async fetchAnalysis(ticker, outputEl, historyEl) {
    this._loading = true;
    const btn = document.getElementById('chat-btn');
    const input = document.getElementById('chat-input');
    input.disabled = true;
    btn.disabled = true;
    outputEl.innerHTML = `<div class="loading-dots"></div><span style="color:var(--text-muted);margin-left:8px">Analyzing ${ticker}...</span>`;

    try {
      const res = await fetch(this.WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker })
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const contentHtml = Utils.renderTable(data.content);

      // Add to history (prepend most recent)
      this._history.unshift({ ticker, html: contentHtml, ts: new Date().toLocaleTimeString() });
      this.renderHistory(historyEl);

      // Show current result
      outputEl.innerHTML = contentHtml;
      if (data.model) {
        outputEl.innerHTML += `<div style="text-align:right;font-size:0.75rem;color:var(--text-muted);margin-top:16px">via ${data.model}</div>`;
      }
    } catch (err) {
      outputEl.innerHTML = `<div class="error-card">Analysis failed: ${err.message}</div>`;
    } finally {
      this._loading = false;
      const btnNow = document.getElementById('chat-btn');
      const inputNow = document.getElementById('chat-input');
      if (btnNow) btnNow.disabled = false;
      if (inputNow) { inputNow.disabled = false; inputNow.focus(); }
    }
  },

  renderHistory(container) {
    if (!this._history.length) { container.innerHTML = ''; return; }
    let html = '<div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">';
    this._history.forEach(item => {
      html += `<span class="badge" style="background:var(--bg-hover);cursor:default">${item.ticker} <span style="color:var(--text-muted);font-size:0.7rem">${item.ts}</span></span>`;
    });
    html += '</div>';
    container.innerHTML = html;
  }
};
