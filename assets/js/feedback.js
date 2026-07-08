/**
 * Feedback — floating bottom-right bubble on every page, mirroring CompCeiling.
 * Collapsed 52px pill → compact form (type: feature/bug/general + message +
 * optional email). POSTs to the chat Worker's /feedback route, which forwards
 * to Telegram and stores to KV. No backend on the static site itself.
 */
const Feedback = {
  // Same origin the chat client already talks to (see chat.js CONFIG).
  _endpoint: 'https://morning-briefing-chat.rcobwq7u.workers.dev/feedback',
  _open: false,
  _sending: false,

  init() {
    if (document.getElementById('mg-feedback')) return;
    const wrap = document.createElement('div');
    wrap.id = 'mg-feedback';
    wrap.innerHTML = this._html();
    document.body.appendChild(wrap);
    this._injectStyles();
    this._wire();
  },

  _html() {
    return `
      <button id="fb-bubble" aria-label="Send feedback" title="Send feedback">
        <span class="fb-bubble-icon">✍</span>
        <span class="fb-bubble-label">Feedback</span>
      </button>
      <div id="fb-panel" role="dialog" aria-label="Feedback form" hidden>
        <div class="fb-head">
          <span class="fb-title">Send feedback</span>
          <button id="fb-close" aria-label="Close">&times;</button>
        </div>
        <div class="fb-types">
          <button class="fb-type active" data-type="general">💬 General</button>
          <button class="fb-type" data-type="feature">✨ Feature</button>
          <button class="fb-type" data-type="bug">🐞 Bug</button>
        </div>
        <textarea id="fb-message" rows="4" maxlength="2000"
          placeholder="What's on your mind? Bugs, ideas, anything…"></textarea>
        <input id="fb-email" type="email" maxlength="200"
          placeholder="Email (optional, if you'd like a reply)">
        <button id="fb-submit">Send</button>
        <div id="fb-status" class="fb-status" aria-live="polite"></div>
      </div>`;
  },

  _wire() {
    const bubble = document.getElementById('fb-bubble');
    const panel = document.getElementById('fb-panel');
    const close = document.getElementById('fb-close');
    const submit = document.getElementById('fb-submit');

    const toggle = (show) => {
      this._open = show;
      panel.hidden = !show;
      bubble.classList.toggle('hidden', show);
      if (show) document.getElementById('fb-message').focus();
    };
    bubble.addEventListener('click', () => toggle(true));
    close.addEventListener('click', () => toggle(false));

    document.querySelectorAll('.fb-type').forEach((b) => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.fb-type').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
      });
    });

    submit.addEventListener('click', () => this._send());
  },

  async _send() {
    if (this._sending) return;
    const msg = document.getElementById('fb-message').value.trim();
    const email = document.getElementById('fb-email').value.trim();
    const type = document.querySelector('.fb-type.active')?.dataset.type || 'general';
    const status = document.getElementById('fb-status');
    const submit = document.getElementById('fb-submit');

    if (msg.length < 3) {
      status.textContent = 'Please add a little more detail.';
      status.className = 'fb-status err';
      return;
    }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      status.textContent = 'That email doesn’t look right.';
      status.className = 'fb-status err';
      return;
    }

    this._sending = true;
    submit.disabled = true;
    submit.textContent = 'Sending…';
    status.textContent = '';
    status.className = 'fb-status';

    try {
      const res = await fetch(this._endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          message: msg,
          email: email || null,
          page: location.hash || '#/',
          ua: navigator.userAgent.slice(0, 200),
        }),
      });
      if (res.ok) {
        status.textContent = '✅ Thanks — got it.';
        status.className = 'fb-status ok';
        document.getElementById('fb-message').value = '';
        document.getElementById('fb-email').value = '';
        setTimeout(() => {
          const panel = document.getElementById('fb-panel');
          const bubble = document.getElementById('fb-bubble');
          if (panel) panel.hidden = true;
          if (bubble) bubble.classList.remove('hidden');
        }, 1400);
      } else {
        const j = await res.json().catch(() => ({}));
        status.textContent = j.error === 'rate_limited'
          ? 'You’ve sent a few already — try again later.'
          : 'Couldn’t send just now. Please try again.';
        status.className = 'fb-status err';
      }
    } catch (e) {
      status.textContent = 'Network error — please try again.';
      status.className = 'fb-status err';
    } finally {
      this._sending = false;
      submit.disabled = false;
      submit.textContent = 'Send';
    }
  },

  _injectStyles() {
    if (document.getElementById('fb-styles')) return;
    const s = document.createElement('style');
    s.id = 'fb-styles';
    s.textContent = `
      #mg-feedback { position: fixed; right: 18px; bottom: 18px; z-index: 9000;
        font-family: var(--font-ui, -apple-system, sans-serif); }
      #fb-bubble { display: flex; align-items: center; gap: 8px; height: 52px;
        padding: 0 18px; border-radius: 26px; border: 1px solid var(--border-dim, #2a3050);
        background: var(--accent, #6366f1); color: #fff; font-size: 0.9rem; font-weight: 600;
        cursor: pointer; box-shadow: 0 6px 22px rgba(0,0,0,0.32); transition: transform .15s, box-shadow .15s; }
      #fb-bubble:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,0.4); }
      #fb-bubble.hidden { display: none; }
      .fb-bubble-icon { font-size: 1.05rem; }
      @media (max-width: 560px) { .fb-bubble-label { display: none; } #fb-bubble { padding: 0; width: 52px; justify-content: center; } }
      #fb-panel { width: 320px; max-width: calc(100vw - 32px); background: var(--bg-card, #0e1220);
        border: 1px solid var(--border-dim, #2a3050); border-radius: 14px; padding: 16px;
        box-shadow: 0 16px 44px rgba(0,0,0,0.5); }
      .fb-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
      .fb-title { font-weight: 700; color: var(--text-primary, #e6e8f0); font-size: 1rem; }
      #fb-close { background: none; border: none; color: var(--text-muted, #8a90a6); font-size: 1.4rem;
        line-height: 1; cursor: pointer; padding: 0 4px; }
      .fb-types { display: flex; gap: 6px; margin-bottom: 10px; }
      .fb-type { flex: 1; padding: 7px 4px; border-radius: 8px; border: 1px solid var(--border-subtle, #1c2236);
        background: var(--bg-inset, #11152a); color: var(--text-secondary, #b8bccb); font-size: 0.75rem;
        cursor: pointer; transition: all .12s; }
      .fb-type.active { border-color: var(--accent, #6366f1); color: var(--text-primary, #e6e8f0);
        background: rgba(99,102,241,0.14); }
      #fb-message, #fb-email { width: 100%; box-sizing: border-box; margin-bottom: 10px; padding: 9px 11px;
        border-radius: 8px; border: 1px solid var(--border-subtle, #1c2236); background: var(--bg-inset, #11152a);
        color: var(--text-primary, #e6e8f0); font-size: 0.85rem; font-family: inherit; resize: vertical; }
      #fb-submit { width: 100%; padding: 10px; border: none; border-radius: 8px; background: var(--accent, #6366f1);
        color: #fff; font-weight: 600; font-size: 0.88rem; cursor: pointer; }
      #fb-submit:disabled { opacity: 0.6; cursor: default; }
      .fb-status { min-height: 18px; margin-top: 8px; font-size: 0.78rem; }
      .fb-status.ok { color: var(--green, #16c784); }
      .fb-status.err { color: var(--red, #ea3943); }
    `;
    document.head.appendChild(s);
  },
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Feedback.init());
} else {
  Feedback.init();
}
