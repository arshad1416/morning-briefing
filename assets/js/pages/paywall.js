/**
 * Paywall — inline "upgrade to view" upsell markup. The route guards fall back
 * to a full-page redirect (#/pricing); this module renders an inline upsell used
 * by teased sections later. Minimal for Phase 1.
 * Attaches to window (plain-script global pattern).
 */
const Paywall = {
  html(needTier) {
    return `<div class="section"><div class="card" style="text-align:center;padding:32px">
      <div class="card-title">This is a ${needTier === 'pro' ? 'Pro' : 'Basic'} feature</div>
      <p>Start your 14-day free trial or upgrade to view.</p>
      <a class="btn" href="#/pricing">See plans</a> <a class="btn" href="#/account">Sign in</a>
    </div></div>`;
  },
};
window.Paywall = Paywall;
