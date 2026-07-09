/**
 * Pricing — public plans page (Free / Basic / Pro). Reuses Paywall.packages so
 * the standalone page and the in-context paywall overlay stay identical.
 * Attaches to window (plain-script global pattern).
 */
const Pricing = {
  async render(app) {
    const me = await Auth.me();
    const ent = me && me.entitlement;
    const active = ent && ent.entitled ? (ent.tier === 'trial' ? 'pro' : ent.tier) : null;
    app.innerHTML = `
      <div class="section pw-pricing">
        <div class="pw-pricing-head">
          <h2 class="pw-heading">Choose your plan</h2>
          <p class="pw-sub">The daily Dashboard is always free. Unlock Research, Screener, Charts &amp; Models with a 7-day free trial — no card required.</p>
        </div>
        ${Paywall.packages({ signedIn: !!me, active })}
      </div>`;
    Paywall.wire(app);
  },
};
window.Pricing = Pricing;
