/**
 * Paywall — inline "upgrade to view" upsell markup. The route guards fall back
 * to a full-page redirect (#/pricing); this module renders an inline upsell used
 * by teased sections later. Minimal for Phase 1.
 * Attaches to window (plain-script global pattern).
 */
const Paywall = {
  html(needTier) {
    const tier = needTier === 'pro' ? 'Pro' : 'Basic';
    return `<div class="section"><div class="paywall">
      <div class="paywall-lock">🔒</div>
      <div class="paywall-title">A ${tier} feature</div>
      <p>Start your 14-day free trial — no card required — or sign in to unlock this.</p>
      <div class="auth-actions">
        <a class="btn btn-primary" href="#/pricing">See plans</a>
        <a class="btn btn-secondary" href="#/account">Sign in</a>
      </div>
    </div></div>`;
  },
};
window.Paywall = Paywall;
