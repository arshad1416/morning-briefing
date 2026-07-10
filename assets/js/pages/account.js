/**
 * Account — the signed-in account hub (subscription + security). When signed
 * OUT this route redirects to the dedicated #/login page; account creation now
 * lives on #/signup (see auth-form.js). Both are reached from the nav ("Log in"
 * link + "Sign up" button) and the paywall CTAs.
 * Attaches to window (plain-script global pattern).
 */
const Account = {
  async render(app) {
    const me = await Auth.me();
    if (me) {
      // Signed-in view — CompCeiling-style stacked cards:
      // Signed in as / Subscription / Security & sign-in.
      const ent = me.entitlement || {};
      const paid = ent.tier === 'basic' || ent.tier === 'pro';
      const canceled = ent.status === 'canceled';
      const tierName = ent.tier === 'pro' ? 'Pro' : 'Basic';
      const iv = ent.billingInterval === 'annual' ? 'annual' : 'monthly';
      const plans = (window.Paywall && Paywall._plans) || { basic: { monthly: 49, annual: 490 }, pro: { monthly: 99, annual: 990 } };
      const price = paid ? `$${plans[ent.tier][iv]}/${iv === 'annual' ? 'yr' : 'mo'} CAD` : '';
      // periodEnd derives from Helcim's date-only dateBilling (UTC midnight) —
      // format in UTC so "2026-07-24" doesn't render as Jul 23 in Eastern.
      const fmtDate = (ms) => ms ? new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
      const daysLeft = ent.trialEndsAt ? Math.max(0, Math.ceil((ent.trialEndsAt - Date.now()) / 86400000)) : null;
      const optedIn = !!me.briefingOptIn;

      let subCard;
      if (paid && ent.entitled && !canceled) {
        subCard = `
          <p class="acct-line"><strong>${tierName}</strong> — ${price} <span class="acct-badge ok">active</span></p>
          <p class="acct-muted">Renews ${fmtDate(ent.periodEnd)}. Full access to ${ent.tier === 'pro' ? 'everything, including Charts &amp; Models' : 'Research &amp; the full Screener'}.</p>
          <div class="acct-actions">
            <a class="btn btn-primary" href="#/pricing">${ent.tier === 'basic' ? 'Upgrade or change plan' : 'Change plan'}</a>
            <button class="btn btn-secondary" id="cancel-sub">Cancel subscription</button>
          </div>
          ${iv === 'monthly' ? '<p class="acct-muted acct-hint">Switch to annual on the pricing page and get 2 months free.</p>' : ''}`;
      } else if (paid && ent.entitled && canceled) {
        subCard = `
          <p class="acct-line"><strong>${tierName}</strong> — ${price} <span class="acct-badge warn">cancels at period end</span></p>
          <p class="acct-muted">Access until ${fmtDate(ent.periodEnd)}.</p>
          <div class="acct-actions"><a class="btn btn-primary" href="#/pricing">Resubscribe</a></div>`;
      } else if (ent.tier === 'trial' && ent.entitled) {
        subCard = `
          <p class="acct-line"><strong>Free trial</strong> <span class="acct-badge ok">active</span></p>
          <p class="acct-muted">${daysLeft} day${daysLeft === 1 ? '' : 's'} left — full access to everything, no card required.</p>
          <div class="acct-actions"><a class="btn btn-primary" href="#/pricing">Choose a plan</a></div>`;
      } else if (ent.tier === 'trial') {
        subCard = `
          <p class="acct-line">Trial ended <span class="acct-badge off">expired</span></p>
          <div class="acct-actions"><a class="btn btn-primary" href="#/pricing">Choose a plan to keep your access</a></div>`;
      } else {
        subCard = `
          <p class="acct-line">No active subscription <span class="acct-badge off">inactive</span></p>
          <div class="acct-actions"><a class="btn btn-primary" href="#/pricing">Start a free trial or choose a plan</a></div>`;
      }

      app.innerHTML = `
        <div class="acct-wrap">
          <h1 class="acct-title">Account</h1>
          <div class="acct-card">
            <h3>Signed in as</h3>
            <div class="acct-row">
              <span class="acct-email">${Utils.esc(me.email)}</span>
              <button class="btn btn-secondary btn-sm" id="lo">Log out</button>
            </div>
          </div>
          <div class="acct-card">
            <h3>Subscription</h3>
            ${subCard}
          </div>
          <div class="acct-card">
            <h3>Security &amp; sign-in</h3>
            <p class="acct-muted">Sign in with Face ID, Touch ID, or a security key instead of a password.</p>
            <div class="acct-actions"><button class="btn btn-secondary" id="add-pk">Add a passkey</button></div>
            <p class="acct-muted acct-hint" id="pk-msg"></p>
          </div>
          <div class="acct-card">
            <h3>Morning Briefing email</h3>
            <p class="acct-muted">The free daily Morning Briefing — the market regime call, key levels, and headlines — emailed each weekday morning. Unsubscribe anytime.</p>
            <p class="acct-line">${optedIn
              ? 'Subscribed <span class="acct-badge ok">on</span>'
              : 'Not subscribed <span class="acct-badge off">off</span>'}</p>
            <div class="acct-actions"><button class="btn ${optedIn ? 'btn-secondary' : 'btn-primary'}" id="brief-toggle">${optedIn ? 'Unsubscribe' : 'Subscribe'}</button></div>
            <p class="acct-muted acct-hint" id="brief-msg">Daily delivery is rolling out shortly.</p>
          </div>
        </div>`;

      const cs = app.querySelector('#cancel-sub');
      if (cs) cs.onclick = async () => {
        if (!confirm('Cancel your subscription? You keep access until the end of the current period.')) return;
        cs.disabled = true; cs.textContent = 'Cancelling…';
        const r = await fetch('/api/billing/cancel', { method: 'POST', credentials: 'include' });
        if (r.ok) { Auth._me = undefined; Account.render(app); }
        else { cs.disabled = false; cs.textContent = 'Cancel subscription'; alert('Could not cancel — please try again.'); }
      };
      const pk = app.querySelector('#add-pk');
      const pkMsg = app.querySelector('#pk-msg');
      pk.onclick = async () => {
        pk.disabled = true;
        try {
          const ok = await Auth.passkeyRegister();
          pkMsg.textContent = ok ? 'Passkey added — you can now sign in without a password.' : 'Passkey setup failed — please try again.';
        } catch (e) {
          // Only a real user-dismissal is a "cancel"; surface anything else so
          // config/registration errors aren't silently mislabeled.
          pkMsg.textContent = (e && (e.name === 'NotAllowedError' || e.name === 'AbortError'))
            ? 'Passkey setup was cancelled or timed out.'
            : 'Passkey setup failed — ' + ((e && e.message) || 'please try again') + '.';
        }
        pk.disabled = false;
      };
      const bt = app.querySelector('#brief-toggle');
      const bm = app.querySelector('#brief-msg');
      if (bt) bt.onclick = async () => {
        const next = !optedIn;
        bt.disabled = true; bt.textContent = next ? 'Subscribing…' : 'Unsubscribing…';
        const r = await fetch('/api/account/briefing', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ optIn: next }),
        });
        if (r.ok) { Auth._me = undefined; Account.render(app); }
        else { bt.disabled = false; bt.textContent = optedIn ? 'Unsubscribe' : 'Subscribe'; bm.textContent = 'Could not update — please try again.'; }
      };
      app.querySelector('#lo').onclick = (e) => { e.preventDefault(); Auth.logout(); }; return;
    }
    // Signed out → the dedicated login page. New users reach #/signup via the
    // nav "Sign up" button and the paywall trial CTAs; the "New here?" link on
    // the login page also crosses over.
    window.location.hash = '#/login';
  },
};
window.Account = Account;
