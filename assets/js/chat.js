/**
 * Chat — AI ticker analysis via Cloudflare Worker.
 * Supports ELI5 mode, live data display, markdown tables.
 */
const Chat = {
  WORKER_URL: 'https://morning-briefing-chat.rcobwq7u.workers.dev',
  _loading: false,
  _history: [],

  async render(app) {
    let html = '<div class="section"><h2 class="section-title">AI Analysis</h2>';
    html += '<p style="color:var(--text-secondary);margin-bottom:16px">Enter a ticker to get live analysis with data tables.</p>';

    html += '<div class="chat-container">';

    // Input row with ELI5 toggle and button
    html += '<div class="chat-input-group">';
    html += '<input type="text" class="chat-input" id="chat-input" placeholder="e.g., AAPL, NVDA, SPY" maxlength="10" autocomplete="off">';
    html += '<label class="eli5-toggle" title="Explain Like I\'m 5 — simpler language, no jargon">';
    html += '<input type="checkbox" id="eli5-check">';
    html += '<span class="eli5-label">ELI5</span>';
    html += '</label>';
    html += '<button class="chat-btn" id="chat-btn">Analyze</button>';
    html += '</div>';

    // Quick ticker buttons
    html += '<div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">';
    ['NVDA','AAPL','MSFT','TSLA','SPY','QQQ','MSTR'].forEach(t => {
      html += `<button class="quick-ticker" data-ticker="${t}">${t}</button>`;
    });
    html += '</div>';

    // History + output
    html += '<div id="history"></div>';
    html += '<div id="chat-output" class="chat-output"><span style="color:var(--text-muted)">Enter a ticker above or click one to start.</span></div>';

    html += '</div></div>';

    app.innerHTML = html;

    const input = document.getElementById('chat-input');
    const btn = document.getElementById('chat-btn');
    const eli5 = document.getElementById('eli5-check');
    const output = document.getElementById('chat-output');
    const history = document.getElementById('history');

    const analyze = () => {
      const ticker = input.value.trim().toUpperCase();
      if (!ticker || this._loading) return;
      if (!/^[A-Z]{1,5}$/.test(ticker)) {
        output.innerHTML = '<div class="error-card">Invalid ticker. Use 1-5 letters.</div>';
        return;
      }
      this.fetchAnalysis(ticker, eli5.checked, output, history);
    };

    btn.addEventListener('click', analyze);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') analyze(); });

    // Quick ticker buttons
    document.querySelectorAll('.quick-ticker').forEach(el => {
      el.addEventListener('click', () => {
        input.value = el.dataset.ticker;
        analyze();
      });
    });

    input.focus();
  },

  async fetchAnalysis(ticker, isELI5, outputEl, historyEl) {
    this._loading = true;
    const btn = document.getElementById('chat-btn');
    const input = document.getElementById('chat-input');
    input.disabled = true;
    btn.disabled = true;

    // Loading state with animation
    outputEl.innerHTML = `<div class="chat-loading">
      <div class="chat-loading-dots">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="chat-loading-text">Fetching live data for <strong>${ticker}</strong>...</div>
    </div>`;

    try {
      const res = await fetch(this.WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, eli5: isELI5 })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      // Render context block (live data badge)
      let fullHtml = data.contextBlock || '';

      // Render the analysis markdown → HTML using full markdown processor
      fullHtml += Utils.renderMarkdown(data.content);

      // Model info
      if (data.model) {
        fullHtml += `<div style="text-align:right;font-size:0.75rem;color:var(--text-muted);margin-top:16px">via ${data.model}</div>`;
      }

      // Add to history
      this._history.unshift({ ticker, html: fullHtml, ts: new Date().toLocaleTimeString(), mode: isELI5 ? 'ELI5' : 'Full' });
      this.renderHistory(historyEl);

      outputEl.innerHTML = fullHtml;
    } catch (err) {
      outputEl.innerHTML = `<div class="error-card">${err.message}</div>`;
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
    let html = '<div style="margin-bottom:12px;display:flex;gap:6px;flex-wrap:wrap">';
    this._history.forEach(item => {
      html += `<span class="badge" style="background:var(--bg-hover);cursor:pointer" title="${item.mode}">
        ${item.ticker} <span style="color:var(--text-muted);font-size:0.7rem">${item.ts}</span>
      </span>`;
    });
    html += '</div>';
    container.innerHTML = html;
  }
};
