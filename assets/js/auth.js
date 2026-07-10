/**
 * Auth — client-side auth + entitlement layer for the MapleGamma SPA.
 * Talks to the Cloudflare Worker under /api/auth/* and /api/billing/*.
 * Attaches to window (plain-script global pattern, no ES modules).
 */
const Auth = {
  _me: undefined,
  async me(force = false) {
    if (this._me !== undefined && !force) return this._me;
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      this._me = res.ok ? await res.json() : null;
    } catch { this._me = null; }
    return this._me;
  },
  async signup(payload) {
    const res = await fetch('/api/auth/signup', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    this._me = undefined;
    return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
  },
  async login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    });
    this._me = undefined;
    return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
  },
  async logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    this._me = null;
    // Full reload so the nav label + all cached state reset to signed-out.
    window.location.href = '/';
  },
  // consent=true (only from the signup page, where the Terms/not-advice/not-Quebec
  // boxes are ticked) passes ?c=1 so the server may mint a brand-new Google
  // account. From the login page we omit it — the server then bounces a
  // never-seen Google email to #/signup for consent instead of creating it.
  googleStart(consent) { window.location.href = '/api/auth/oauth/google/start' + (consent ? '?c=1' : ''); },
  async passkeyRegister() {
    const opts = await (await fetch('/api/auth/passkey/register/options', { method: 'POST', credentials: 'include' })).json();
    // @simplewebauthn/browser v11+ takes { optionsJSON }, not the options directly.
    const att = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: opts });
    const res = await fetch('/api/auth/passkey/register/verify', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challengeId: opts.challengeId, response: att }),
    });
    return res.ok;
  },
  async passkeyLogin(email) {
    const opts = await (await fetch('/api/auth/passkey/login/options', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
    })).json();
    const asrt = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: opts });
    const res = await fetch('/api/auth/passkey/login/verify', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: opts.challengeId, credentialId: asrt.id, response: asrt }),
    });
    this._me = undefined;
    return res.ok;
  },
  async guard(needTier) {
    const me = await this.me();
    // Not authenticated → pass needTier through so the router renders
    // the page (blurred background) and calls Paywall.lock() to show
    // package pricing with "Start 7-day free trial" CTAs.
    if (!me) { return { ok: false, needTier, me: null }; }
    const e = me.entitlement || {};
    const rank = { basic: 1, pro: 2 };
    const have = e.tier === 'trial' && e.entitled ? 2 : (e.entitled ? (rank[e.tier] || 0) : 0);
    // Authenticated but insufficient tier → return { ok: false, needTier, me }
    // The router will render the page (blurred) and overlay the paywall.
    if (have < (rank[needTier] || 0)) return { ok: false, needTier, me };
    return { ok: true, needTier, me };
  },
};
window.Auth = Auth;
