/**
 * Paywall — blur-and-overlay gate for premium routes.
 *
 * Gate.route(render, tier) renders the real page, then (for non-subscribers)
 * blurs it and lays the subscription packages over top. The data itself is
 * already off-limits server-side (the hard data gate), so this is the UX
 * enforcement layer — no need to hide the DOM we just rendered.
 *
 * Attaches to window (plain-script global pattern).
 */
const Paywall = {
  _interval: 'monthly',

  // Subscription package cards, reused by the overlay and the /pricing page.
  // `signedIn`=false → offer the 7-day trial CTA; true (no entitlement) → checkout.
  packages(opts) {
    opts = opts || {};
    const trialAvailable = !opts.signedIn;
    const tiers = [
      { key: 'free', name: 'Free', price: '$0', unit: '',
        blurb: 'The daily dashboard, always free.',
        feats: ['Market regime &amp; indices', 'Headlines &amp; Reddit pulse', 'GEX/DEX snapshot'] },
      { key: 'basic', name: 'Basic', price: '$19', unit: '/mo CAD',
        blurb: 'Everything in Free, plus the full research desk.',
        feats: ['Full Screener — all tickers, scored', 'Research: analysis, news, earnings, SEC', 'Reddit + prediction-market sentiment'], cta: 'basic' },
      { key: 'pro', name: 'Pro', price: '$39', unit: '/mo CAD', popular: true,
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

  wire(app) {
    app.querySelectorAll('.pw-cta').forEach((btn) => {
      btn.onclick = async () => {
        const cta = btn.dataset.cta;
        if (cta === 'trial' || cta === 'free') { window.location.hash = '#/account'; return; }
        const res = await fetch('/api/billing/checkout', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: cta }),
        });
        if (res.ok) { Auth._me = undefined; window.location.reload(); }
        else window.location.hash = '#/account';
      };
    });
    const lo = app.querySelector('#pw-logout');
    if (lo) lo.onclick = (e) => { e.preventDefault(); Auth.logout(); };
  },
};
window.Paywall = Paywall;
