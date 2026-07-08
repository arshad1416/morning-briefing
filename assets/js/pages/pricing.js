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
    app.innerHTML = `
      <div class="section"><h2 class="section-title">Plans</h2>
      <div class="grid-3">
        <div class="card"><div class="card-title">Free</div><p>Daily dashboard: regime, indices, headlines, Reddit pulse, GEX snapshot.</p></div>
        <div class="card"><div class="card-title">Basic</div><p>+ Research & Screener.</p><button class="btn" data-t="basic">Choose Basic</button></div>
        <div class="card"><div class="card-title">Pro</div><p>+ Charts & Models (and future alerts).</p><button class="btn" data-t="pro">Choose Pro</button></div>
      </div>
      <p style="font-size:.75rem;color:var(--text-muted);margin-top:12px">Prices shown at checkout. 14-day free trial on signup. Not investment advice.</p>
      </div>`;
    app.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => buy(b.dataset.t)));
  },
};
window.Pricing = Pricing;
