/**
 * Paywall — blur-and-overlay gate + subscription package cards.
 *
 * The overlay is only the visual layer; the *data* is enforced server-side
 * (Worker data_gate.js). Checkout drives the billing worker: in mock mode the
 * server grants entitlement directly (reload); in live mode it returns a
 * HelcimPay.js checkoutToken and we render the payment modal, then POST the
 * validated response to /confirm.
 *
 * Attaches to window (plain-script global pattern).
 */
const Paywall = {
  _interval: 'monthly',
  _plans: {
    basic: {
      name: 'Basic', monthly: 49, annual: 490,
      blurb: 'Everything in Free, plus the full research desk.',
      feats: [
        'Everything in Free',
        'Full multi-factor screener — all tickers scored',
        'Research desk: AI analysis, news, earnings &amp; SEC filings',
        'Prediction-market sentiment + trade ideas',
        'Simulated portfolio, positions &amp; trade journal',
      ],
    },
    pro: {
      name: 'Pro', monthly: 99, annual: 990, popular: true,
      blurb: 'Everything in Basic, plus charts, models &amp; the AI council.',
      feats: [
        'Everything in Basic',
        'Interactive charts — candles, RSI, ATR &amp; volume',
        'Gamma walls + strike-level options exposure',
        'Model calibration, accuracy &amp; walk-forward validation',
        'Prediction engine, live simulation &amp; 5-model council history',
        'Options strategy status + crypto strategy cohorts¹',
      ],
    },
  },

  price(tier) {
    const p = this._plans[tier];
    return this._interval === 'annual'
      ? { big: `$${p.annual}`, unit: '/yr CAD' }
      : { big: `$${p.monthly}`, unit: '/mo CAD' };
  },

  // Subscription package cards (with billing-interval toggle), reused by the
  // overlay and the /pricing page. signedIn=false → 7-day trial CTA; true → checkout.
  packages(opts) {
    opts = opts || {};
    const trialAvailable = !opts.signedIn;
    const iv = this._interval;
    const toggle = `
      <div class="pw-toggle" role="tablist" aria-label="Billing interval">
        <button class="pw-toggle-btn${iv === 'monthly' ? ' active' : ''}" data-interval="monthly" role="tab" aria-selected="${iv === 'monthly'}">Monthly</button>
        <button class="pw-toggle-btn${iv === 'annual' ? ' active' : ''}" data-interval="annual" role="tab" aria-selected="${iv === 'annual'}">Annual <span class="pw-save">2 months free</span></button>
      </div>`;

    const card = (t) => {
      const paid = t.key === 'basic' || t.key === 'pro';
      const pr = paid ? this.price(t.key) : { big: '$0', unit: '' };
      let h = `<div class="pw-plan${t.popular ? ' pw-plan-pop' : ''}${opts.active === t.key ? ' pw-plan-active' : ''}">`;
      if (t.popular) h += '<div class="pw-badge">Most popular</div>';
      h += `<div class="pw-plan-name">${t.name}</div>`;
      h += `<div class="pw-plan-price">${pr.big}<span>${pr.unit}</span></div>`;
      h += `<div class="pw-plan-blurb">${t.blurb}</div>`;
      h += '<ul class="pw-feats">' + t.feats.map((f) => `<li>${f}</li>`).join('') + '</ul>';
      if (paid) {
        if (opts.active === t.key) h += '<div class="pw-plan-foot">Your plan</div>';
        else if (trialAvailable) h += '<button class="btn btn-primary pw-cta" data-cta="trial">Start 7-day free trial</button>';
        else h += `<button class="btn ${t.popular ? 'btn-primary' : 'btn-secondary'} pw-cta" data-cta="${t.key}">Choose ${t.name}</button>`;
      } else if (trialAvailable) {
        h += '<button class="btn btn-primary pw-cta" data-cta="free">Sign Up for Free</button>';
      } else {
        h += '<div class="pw-plan-foot">Included</div>';
      }
      return h + '</div>';
    };

    const free = { key: 'free', name: 'Free',
      blurb: 'The daily dashboard, always free.',
      feats: [
        'Daily market regime, indices &amp; AI verdict',
        'Headlines, Reddit pulse &amp; key catalysts',
        'GEX/DEX/VEX snapshot + dealer gamma regime',
        'Customizable dashboard layout',
      ] };

    let html = '<div class="pw-billing">' + toggle + '<div class="pw-plans">';
    html += card(free) + card({ key: 'basic', ...this._plans.basic }) + card({ key: 'pro', ...this._plans.pro });
    html += '</div>';
    html += '<div class="pw-note">¹ Preview data is public today; subscriber-only controls and deeper analysis are rolling out with Pro.</div>';
    html += trialAvailable
      ? '<div class="pw-note">7-day free trial — no card required. Cancel anytime. General information only, not investment advice.</div>'
      : '<div class="pw-note">Cancel anytime. General information only, not investment advice.</div>';
    return html + '</div>';
  },

  lock(app, needTier, me) {
    const inner = app.innerHTML;
    const signedIn = !!me;
    const tierLabel = needTier === 'pro' ? 'Pro' : 'Basic';
    const heading = signedIn
      ? `Your trial has ended — subscribe to keep ${tierLabel} access`
      : `Unlock ${tierLabel} with a 7-day free trial`;
    const sub = signedIn
      ? 'Choose a plan to continue where you left off.'
      : 'Create an account to start your free trial — no card required.';
    app.innerHTML = `
      <div class="pw-locked">
        <div class="pw-blur" aria-hidden="true">${inner}</div>
        <div class="pw-overlay" role="dialog" aria-label="Subscribe to continue">
          <div class="pw-card">
            <div class="pw-lock" aria-hidden="true">🔒</div>
            <h2 class="pw-heading">${heading}</h2>
            <p class="pw-sub">${sub}</p>
            ${Paywall.packages({ signedIn })}
            <div class="pw-foot-actions">
              ${signedIn
                ? '<button class="btn btn-ghost" id="pw-logout">Log out</button>'
                : '<a class="btn btn-ghost" href="#/login">I already have an account</a>'}
            </div>
          </div>
        </div>
      </div>`;
    Paywall.wire(app);
  },

  wire(app) {
    app.querySelectorAll('.pw-cta').forEach((btn) => {
      btn.onclick = () => {
        const cta = btn.dataset.cta;
        if (cta === 'trial' || cta === 'free') { window.location.hash = '#/signup'; return; }
        Paywall.startCheckout(cta, btn);
      };
    });
    const lo = app.querySelector('#pw-logout');
    if (lo) lo.onclick = (e) => { e.preventDefault(); Auth.logout(); };
    // Billing-interval toggle: re-render the whole .pw-billing block in place.
    app.querySelectorAll('.pw-toggle-btn').forEach((tb) => {
      tb.onclick = () => {
        const i = tb.dataset.interval;
        if (i === Paywall._interval) return;
        Paywall._interval = i;
        const billing = tb.closest('.pw-billing');
        const host = billing && billing.parentElement;
        if (host) { billing.outerHTML = Paywall.packages({ signedIn: !host.querySelector('[data-cta="trial"]') }); Paywall.wire(host); }
      };
    });
  },

  async startCheckout(tier, btn) {
    if (btn) { btn.disabled = true; btn.dataset._t = btn.textContent; btn.textContent = 'Loading…'; }
    const done = () => { if (btn) { btn.disabled = false; btn.textContent = btn.dataset._t || 'Choose'; } };
    let res, body;
    try {
      res = await fetch('/api/billing/checkout', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, interval: Paywall._interval }),
      });
      body = await res.json().catch(() => ({}));
    } catch { done(); window.location.hash = '#/account'; return; }
    if (!res.ok) { done(); if (res.status === 401) window.location.hash = '#/account'; else alert('Checkout unavailable — please try again.'); return; }
    if (body.mock) { Auth._me = undefined; window.location.reload(); return; }   // mock-billing mode
    if (body.checkoutToken) { await Paywall.openHelcim(body.checkoutToken, done); return; }
    done(); window.location.hash = '#/account';
  },

  // Render the HelcimPay.js payment modal and confirm on success (live mode).
  async openHelcim(checkoutToken, done) {
    try { await Paywall._loadHelcim(); } catch { if (done) done(); alert('Payment module failed to load.'); return; }
    const handler = async (event) => {
      if (!event.data || event.data.eventName !== `helcim-pay-js-${checkoutToken}`) return;
      if (event.data.eventStatus === 'ABORTED' || event.data.eventStatus === 'HIDE') {
        window.removeEventListener('message', handler); if (done) done(); return;
      }
      if (event.data.eventStatus === 'SUCCESS') {
        window.removeEventListener('message', handler);
        let payload = event.data.eventMessage;
        if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch { /* leave */ } }
        const r = await fetch('/api/billing/confirm', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        if (r.ok) { Auth._me = undefined; window.location.reload(); }
        else { const e = await r.json().catch(() => ({})); if (done) done(); alert('Could not activate subscription: ' + (e.error || 'error')); }
      }
    };
    window.addEventListener('message', handler);
    window.appendHelcimPayIframe(checkoutToken);
  },

  _loadHelcim() {
    if (window.appendHelcimPayIframe) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://secure.helcim.app/helcim-pay/services/start.js';
      s.onload = () => resolve();
      s.onerror = reject;
      document.head.appendChild(s);
    });
  },
};
window.Paywall = Paywall;
