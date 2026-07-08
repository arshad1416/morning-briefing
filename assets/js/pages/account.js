/**
 * Account — sign in / create account page. Supports email+password, Google
 * OAuth, and passkey sign-in, with the legal consent gate (Terms / not-advice
 * acknowledgement / not-a-Quebec-resident) required before signup or Google.
 * Attaches to window (plain-script global pattern).
 */
const Account = {
  async render(app) {
    const me = await Auth.me();
    if (me) { app.innerHTML = `<div class="section"><p>Signed in as ${me.email}. <a href="#/pricing">Manage plan</a> · <a href="#" id="lo">Log out</a></p></div>`;
      app.querySelector('#lo').onclick = (e) => { e.preventDefault(); Auth.logout(); }; return; }
    app.innerHTML = `
      <div class="section" style="max-width:460px;margin:0 auto">
        <h2 class="section-title">Sign in / Create account</h2>
        <div id="msg" style="color:var(--red);font-size:.85rem;min-height:1.2em"></div>
        <input id="email" placeholder="Email" style="width:100%;margin:6px 0;padding:10px">
        <input id="pw" type="password" placeholder="Password (10+ chars)" style="width:100%;margin:6px 0;padding:10px">
        <div id="legal" style="font-size:.8rem;margin:10px 0;line-height:1.6">
          <label><input type="checkbox" id="cTerms"> I accept the <a href="/terms.html" target="_blank">Terms</a> & <a href="/privacy.html" target="_blank">Privacy Policy</a></label><br>
          <label><input type="checkbox" id="cAck"> I understand this is general information, not investment advice, paper-only; past performance ≠ future results</label><br>
          <label><input type="checkbox" id="cQC"> I am not a resident of Quebec</label>
        </div>
        <button id="signup" class="btn">Create account</button>
        <button id="login" class="btn">Log in</button>
        <hr style="margin:16px 0">
        <button id="google" class="btn">Continue with Google</button>
        <button id="pkLogin" class="btn">Sign in with a passkey</button>
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
