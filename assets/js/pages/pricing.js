/**
 * Pricing — public plans page (Free / Basic / Pro) with mock-checkout buttons.
 * Unauthenticated users are routed to #/account before checkout.
 * Attaches to window (plain-script global pattern).
 */
const Pricing = {
  async render(app) {
    const me = await Auth.me();
    const buy = async (tier) => {
      if (!me) { window.location.hash = '#/account'; return; }
      const res = await fetch('/api/billing/checkout', { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier }) });
      if (res.ok) { Auth._me = undefined; window.location.hash = '#/'; }
      else alert('Checkout unavailable right now.');
    };
    const proTag = me?.entitlement?.entitled ? '' : '<div class="price-badge">7-day trial</div>';
    app.innerHTML = `
      <div class="section">
        <div class="pricing-head">
          <div class="auth-title">Choose your plan</div>
          <div class="auth-sub">The daily Dashboard is always free. Unlock the rest with a 7-day trial — no card required.</div>
        </div>
        <div class="pricing-grid">
          <div class="price-card">
            <div class="price-name">Free</div>
            <div class="price-tag">$0</div>
            <ul class="price-feats">
              <li>Daily market regime &amp; indices</li>
              <li>Headlines &amp; Reddit pulse</li>
              <li>GEX snapshot &amp; action-queue teaser</li>
              <li class="muted">Research &amp; Screener</li>
              <li class="muted">Charts &amp; Models</li>
            </ul>
            <a class="btn btn-secondary btn-block" href="#/">Current plan</a>
          </div>
          <div class="price-card">
            <div class="price-name">Basic</div>
            <div class="price-tag">$—<span style="font-size:.7rem;color:var(--text-muted)"> /mo</span></div>
            <ul class="price-feats">
              <li>Everything in Free</li>
              <li>Full Research room</li>
              <li>Full Stock Screener</li>
              <li class="muted">Charts &amp; Models</li>
            </ul>
            <button class="btn btn-secondary btn-block" data-t="basic">Choose Basic</button>
          </div>
          <div class="price-card featured">
            ${proTag}
            <div class="price-name">Pro</div>
            <div class="price-tag">$—<span style="font-size:.7rem;color:var(--text-muted)"> /mo</span></div>
            <ul class="price-feats">
              <li>Everything in Basic</li>
              <li>Interactive Charts (candles, RSI, ATR)</li>
              <li>Prediction Models &amp; accuracy</li>
              <li>Alerts (coming soon)</li>
            </ul>
            <button class="btn btn-primary btn-block" data-t="pro">Start Pro trial</button>
          </div>
        </div>
        <p class="pricing-note">Prices confirmed at checkout. Paper-trading &amp; general information only — not investment advice.</p>
      </div>`;
    app.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => buy(b.dataset.t)));
  },
};
window.Pricing = Pricing;
