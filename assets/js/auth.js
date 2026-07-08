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
    window.location.hash = '#/';
  },
  googleStart() { window.location.href = '/api/auth/oauth/google/start'; },
  passkeysSupported() {
    return !!(window.SimpleWebAuthnBrowser && SimpleWebAuthnBrowser.browserSupportsWebAuthn());
  },
  // Register a passkey on the current device (signed-in). Challenge is carried
  // by an httpOnly cookie, so verify just posts the attestation. v13 API.
  async passkeyRegister() {
    const optionsJSON = await (await fetch('/api/auth/passkey/register/options', { method: 'POST', credentials: 'include' })).json();
    const attestation = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON });
    const res = await fetch('/api/auth/passkey/register/verify', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(attestation),
    });
    return res.ok;
  },
  // Usernameless sign-in: no email — the authenticator offers its discoverable
  // passkey and the server looks it up by assertion id. Works across all
  // MapleGamma domains via Related Origin Requests (one rpID = maplegamma.com).
  async passkeyLogin() {
    const optionsJSON = await (await fetch('/api/auth/passkey/login/options', { method: 'POST', credentials: 'include' })).json();
    const assertion = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON });
    const res = await fetch('/api/auth/passkey/login/verify', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(assertion),
    });
    this._me = undefined;
    return res.ok;
  },
  async guard(needTier) {
    const me = await this.me();
    if (!me) { window.location.hash = '#/account'; return false; }
    const e = me.entitlement || {};
    const rank = { basic: 1, pro: 2 };
    const have = e.tier === 'trial' && e.entitled ? 2 : (e.entitled ? (rank[e.tier] || 0) : 0);
    if (have < (rank[needTier] || 0)) { window.location.hash = '#/pricing'; return false; }
    return true;
  },
};
window.Auth = Auth;
