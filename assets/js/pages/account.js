/**
 * Account — sign in / create account page. Supports email+password, Google
 * OAuth, and passkey sign-in, with the legal consent gate (Terms / not-advice
 * acknowledgement / not-a-Quebec-resident) required before signup or Google.
 * Attaches to window (plain-script global pattern).
 */
const Account = {
  async render(app) {
    const me = await Auth.me();
    if (me) {
      app.innerHTML = `
        <div class="auth-wrap">
          <div class="auth-card">
            <div class="auth-title">You're signed in</div>
            <div class="auth-sub">${Utils.esc(me.email)}</div>
            <div class="auth-actions">
              <a class="btn btn-primary" href="#/pricing">Manage plan</a>
              <button class="btn btn-secondary" id="lo">Log out</button>
            </div>
          </div>
        </div>`;
      app.querySelector('#lo').onclick = (e) => { e.preventDefault(); Auth.logout(); }; return;
    }
    const gSvg = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
    const kSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>';
    app.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card">
          <div class="auth-title">Welcome to MapleGamma</div>
          <div class="auth-sub">Sign in, or create an account to start your 7-day free trial.</div>
          <div id="msg" class="auth-msg"></div>
          <input id="email" class="auth-field" type="email" autocomplete="email" placeholder="Email">
          <input id="pw" class="auth-field" type="password" autocomplete="current-password" placeholder="Password (10+ characters)">
          <div id="legal" class="auth-legal">
            <label><input type="checkbox" id="cTerms"> <span>I accept the <a href="/terms.html" target="_blank" rel="noopener">Terms</a> &amp; <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a></span></label>
            <label><input type="checkbox" id="cAck"> <span>I understand this is general information — not investment advice, paper-only; past performance ≠ future results</span></label>
            <label><input type="checkbox" id="cQC"> <span>I am not a resident of Quebec</span></label>
          </div>
          <div class="auth-actions">
            <button id="signup" class="btn btn-primary">Create account</button>
            <button id="login" class="btn btn-secondary">Log in</button>
          </div>
          <div class="auth-divider">or</div>
          <div class="auth-alt">
            <button id="google" class="btn btn-google btn-block">${gSvg}<span>Continue with Google</span></button>
            <button id="pkLogin" class="btn btn-secondary btn-block">${kSvg}<span>Sign in with a passkey</span></button>
          </div>
          <div class="auth-foot">Paper-trading &amp; general market information only. Not investment advice.</div>
        </div>
      </div>`;
    const v = (id) => app.querySelector(id).value.trim();
    const chk = (id) => app.querySelector(id).checked;
    const msg = (t) => { app.querySelector('#msg').textContent = t; };
    const consentOk = () => chk('#cTerms') && chk('#cAck') && chk('#cQC');

    app.querySelector('#signup').onclick = async () => {
      if (!consentOk()) return msg('Please accept the terms and confirm you are not in Quebec.');
      const r = await Auth.signup({ email: v('#email'), password: v('#pw'), acceptTerms: true, acceptAck: true, notQuebec: true });
      if (r.ok) window.location.hash = '#/'; else msg(errText(r.body.error));
    };
    app.querySelector('#login').onclick = async () => {
      const r = await Auth.login(v('#email'), v('#pw'));
      if (r.ok) window.location.hash = '#/'; else msg(errText(r.body.error));
    };
    app.querySelector('#google').onclick = () => {
      if (!consentOk()) return msg('Please accept the terms and confirm you are not in Quebec before continuing with Google.');
      Auth.googleStart();
    };
    app.querySelector('#pkLogin').onclick = async () => {
      const ok = await Auth.passkeyLogin(v('#email')); if (ok) window.location.hash = '#/'; else msg('Passkey sign-in failed.');
    };
    function errText(e) {
      return ({ email_taken: 'That email already has an account — log in instead.',
        quebec_not_available: 'Sorry, this service is not available to Quebec residents.',
        weak_password: 'Password must be at least 10 characters.',
        invalid_credentials: 'Wrong email or password.', too_many_attempts: 'Too many attempts — try again later.' }[e]) || 'Something went wrong.';
    }
  },
};
window.Account = Account;
