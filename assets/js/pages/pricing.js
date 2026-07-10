/**
 * Pricing — public plans page. Reuses the Paywall package component (same
 * $49/$99 USD cards + monthly/annual toggle + checkout wiring) so pricing stays
 * in one place. Unauthenticated users are routed to #/account before checkout.
 * Attaches to window (plain-script global pattern).
 */
const Pricing = {
  async render(app) {
    const me = await Auth.me();
    const signedIn = !!(me && me.email);
    const ent = (me && me.entitlement) || {};
    const active = ent.entitled && (ent.tier === 'basic' || ent.tier === 'pro') ? ent.tier : undefined;
    app.innerHTML = `
      <div class="section pw-pricing">
        <div class="pw-pricing-head">
          <div class="auth-title">Choose your plan</div>
          <div class="auth-sub">The daily Dashboard is always free. Unlock the rest with a 7-day trial — no card required.</div>
        </div>
        <div class="pw-card pw-card-standalone">
          ${Paywall.packages({ signedIn, active })}
        </div>
      </div>`;
    Paywall.wire(app);
  },
};
window.Pricing = Pricing;
