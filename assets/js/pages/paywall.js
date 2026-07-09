/**
 * Paywall — blur-and-overlay gate for premium routes.
 *
 * Gate.route(render, tier) renders the real page, then (for non-subscribers)
 * blurs it and lays the subscription packages over top. The blur is only the
 * visual layer — the *data* is enforced server-side (Worker data_gate.js: premium
 * JSON lives in private R2 and 401/403s for non-subscribers), so the blurred page
 * never actually contains the premium numbers.
 *
 * Attaches to window (plain-script global pattern).
 */
const Gate = {
  meets(userTier, need) {
    const rank = { basic: 1, pro: 2 };
    const have = userTier === 'trial' ? 2 : (rank[userTier] || 0);
    return have >= (rank[need] || 0);
  },
  // Wrap a page render fn with entitlement enforcement.
  route(render, needTier) {
    return async function (app, params) {
      const me = await Auth.me();
      const ok = me && me.entitlement && me.entitlement.entitled && Gate.meets(me.entitlement.tier, needTier);
      await Promise.resolve(render(app, params));
      if (!ok) Paywall.lock(app, needTier, me);
    };
  },
};
window.Gate = Gate;

const Paywall = {
  _interval: 'monthly',

  // Subscription package cards, reused by the overlay and the /pricing page.
  // `signedIn`=false → offer the 7-day trial CTA; true (no entitlement) → checkout.
  packages(opts) {
    opts = opts || {};
    const trialAvailable = !opts.signedIn;
    const i = Paywall._interval;
    const tiers = [
      { key: 'free', name: 'Free', price: '$0', unit: '',
        blurb: 'The daily overview, always free.',
        feats: ['Market regime &amp; indices', 'Headlines &amp; Reddit pulse', 'GEX/DEX snapshot'] },
      { key: 'basic', name: 'Basic',
        price: i === 'annual' ? '$490' : '$49', unit: i === 'annual' ? '/yr USD' : '/mo USD',
        blurb: 'Everything in Free, plus the full research desk.',
        feats: ['Full Screener — all tickers, scored', 'Research: analysis, news, earnings, SEC', 'Reddit + prediction-market sentiment'], cta: 'basic' },
      { key: 'pro', name: 'Pro', popular: true,
        price: i === 'annual' ? '$990' : '$99', unit: i === 'annual' ? '/yr USD' : '/mo USD',
        blurb: 'Everything in Basic, plus charts, models &amp; the AI council.',
        feats: ['Interactive charts — candles, RSI, ATR', 'Model accuracy &amp; walk-forward backtests', 'Prediction engine + council history'], cta: 'pro' },
    ];
    let html = '<div class="pw-plans">';
    tiers.forEach((t) => {
      html += `<div class="pw-plan${t.popular ? ' pw-plan-pop' : ''}${opts.active === t.key ? ' pw-plan-active' : ''}">`;
      if (t.popular) html += '<div class="pw-badge">Most popular</div>';
      html += `<div class="pw-plan-name">${t.name}</div>`;
      html += `<div class="pw-plan-price">${t.price}<span>${t.unit}</span></div>`;
      html += `<div class="pw-plan-blurb">${t.blurb}</div>`;
      html += '<ul class="pw-feats">' + t.feats.map((f) => `<li>${f}</li>`).join('') + '</ul>';
      if (t.cta) {
        if (opts.active === t.key) html += '<div class="pw-plan-foot">Your plan</div>';
        else if (trialAvailable) html += '<button class="btn btn-primary pw-cta" data-cta="trial">Start 7-day free trial</button>';
        else html += `<button class="btn ${t.popular ? 'btn-primary' : 'btn-secondary'} pw-cta" data-cta="${t.cta}">Choose ${t.name}</button>`;
      } else if (trialAvailable) {
        // Free tier, visitor not signed in → let them create a free account.
        html += '<button class="btn btn-primary pw-cta" data-cta="free">Sign Up for Free</button>';
      } else {
        html += '<div class="pw-plan-foot">Included</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    // Billing period toggle (paid plans only)
    html += '<div class="pw-toggle-wrap"><div class="pw-toggle" role="tablist" aria-label="Billing period">';
    html += '<button class="pw-toggle-btn' + (Paywall._interval === 'monthly' ? ' active' : '') + '" data-interval="monthly">Monthly</button>';
    html += '<button class="pw-toggle-btn' + (Paywall._interval === 'annual' ? ' active' : '') + '" data-interval="annual">Annual <span class="pw-save">Save 16%</span></button>';
    html += '</div></div>';
    if (trialAvailable) html += '<div class="pw-note">7-day free trial — no card required. Cancel anytime. General information only, not investment advice.</div>';
    return html;
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
                : '<a class="btn btn-ghost" href="#/account">I already have an account</a>'}
            </div>
          </div>
        </div>
      </div>`;
    Paywall.wire(app);
  },

  // Load the HelcimPay.js script on demand
  _helcimPromise: null,
  _loadHelcim() {
    if (!this._helcimPromise) {
      this._helcimPromise = new Promise((resolve, reject) => {
        if (window.appendHelcimPayIframe) return resolve();
        const s = document.createElement('script');
        s.src = 'https://secure.helcim.app/helcim-pay/services/start.js';
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => { this._helcimPromise = null; reject(new Error('Helcim failed to load')); };
        document.head.appendChild(s);
      });
    }
    return this._helcimPromise;
  },

  wire(app) {
    app.querySelectorAll('.pw-cta').forEach((btn) => {
      btn.onclick = async () => {
        const cta = btn.dataset.cta;
        // Trial and free account flows: redirect to signup
        if (cta === 'trial' || cta === 'free') { window.location.hash = '#/account'; return; }

        // Paid tier: create HelcimPay checkout session
        btn.disabled = true;
        btn.textContent = 'Loading…';

        const res = await fetch('/api/billing/checkout', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier: cta, interval: Paywall._interval }),
        });

        if (!res.ok) { window.location.hash = '#/account'; return; }
        const j = await res.json();

        // Mock billing → reload to show activated sub
        if (j.mock) { Auth._me = undefined; window.location.reload(); return; }
        if (!j.checkoutToken) { window.location.hash = '#/account'; return; }

        // Load HelcimPay.js and show the iframe
        try {
          await Paywall._loadHelcim();
        } catch {
          btn.disabled = false;
          btn.textContent = 'Payment unavailable';
          return;
        }

        const sessionId = j.sessionId;
        const identifier = 'helcim-pay-js-' + j.checkoutToken;

        const onMessage = (event) => {
          if (event.data?.eventName !== identifier) return;

          if (event.data.eventStatus === 'ABORTED') {
            window.removeEventListener('message', onMessage);
            window.removeHelcimPayIframe?.();
            btn.disabled = false;
            btn.textContent = 'Payment cancelled — try again';
            return;
          }

          if (event.data.eventStatus === 'SUCCESS') {
            window.removeEventListener('message', onMessage);
            let payload = event.data.eventMessage;
            if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch {} }

            fetch('/api/billing/activate', {
              method: 'POST', credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: payload.data, hash: payload.hash, sessionId }),
            }).then((actRes) => {
              window.removeHelcimPayIframe?.();
              if (actRes.ok) { Auth._me = undefined; window.location.reload(); }
              else { btn.disabled = false; btn.textContent = 'Activation failed — contact support'; }
            }).catch(() => {
              window.removeHelcimPayIframe?.();
              btn.disabled = false;
              btn.textContent = 'Activation failed — try again';
            });
          }
        };

        window.addEventListener('message', onMessage);
        window.appendHelcimPayIframe?.(j.checkoutToken);
      };
    });
    const lo = app.querySelector('#pw-logout');
    if (lo) lo.onclick = (e) => { e.preventDefault(); Auth.logout(); };
    // Billing interval toggle
    app.querySelectorAll('.pw-toggle-btn').forEach((tb) => {
      tb.onclick = () => {
        const i = tb.dataset.interval;
        if (i === Paywall._interval) return;
        Paywall._interval = i;
        // Re-render packages in place — find the parent pw-card or pw-locked
        const card = tb.closest('.pw-card') || tb.closest('.pw-locked');
        if (card) {
          const wrap = card.querySelector('.pw-plans');
          if (wrap) {
            const signedIn = !card.querySelector('[data-cta="trial"]');
            // Re-render plans + toggle; keep the rest of the card intact
            const toggleWrap = wrap.nextElementSibling?.classList.contains('pw-toggle-wrap') ? wrap.nextElementSibling : null;
            wrap.outerHTML = Paywall.packages({ signedIn, active: undefined });
            Paywall.wire(card);
          }
        }
      };
    });
  },
};
window.Paywall = Paywall;
