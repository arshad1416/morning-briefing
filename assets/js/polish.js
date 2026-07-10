/**
 * polish.js — motion layer (reversible). The signature "trading terminal"
 * moment: live figures count up when a view renders, so data feels like it's
 * landing rather than just appearing. Scoped to the hero numbers only —
 * count-up everywhere would be noise (impeccable: delight at moments, not pages).
 *
 * Additive + self-contained: remove this file + its loader entry and the site
 * is exactly as before. Fully respects prefers-reduced-motion (numbers stay
 * static, no observer). Attaches nothing global.
 */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return; // leave every number in its final state

  // Only the figures a trader's eye lands on first — P&L, equity, indices,
  // model conviction, VIX. Deliberately NOT table cells / position rows.
  var SEL = [
    '.today-pnl-val', '.today-pnl-pct', '.today-pnl-cash',
    '.index-price', '.index-change',
    '.today-signal-score', '.regime-vix',
  ].join(',');

  var DUR = 820;
  // ease-out-quart — confident deceleration, no bounce.
  function ease(p) { return 1 - Math.pow(1 - p, 4); }

  function run(el) {
    if (el.__pol) return;
    var text = (el.textContent || '').trim();
    // sign · non-digit prefix ($, VIX ) · number (with commas) · suffix (%, text)
    var m = text.match(/^([+\-]?)([^\d]*?)([\d][\d,]*(?:\.\d+)?)(.*)$/s);
    if (!m) return;
    var sign = m[1], pre = m[2], numStr = m[3], suf = m[4];
    var target = parseFloat(numStr.replace(/,/g, ''));
    if (!isFinite(target) || target === 0) return; // nothing to count toward
    el.__pol = 1;

    var dec = (numStr.split('.')[1] || '').length;
    // Always group thousands so the comma never flickers in/out mid-count.
    function fmt(v) {
      var s = v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      return sign + pre + s + suf;
    }

    var t0 = null;
    function step(now) {
      if (t0 === null) t0 = now;
      var p = Math.min(1, (now - t0) / DUR);
      el.textContent = p < 1 ? fmt(target * ease(p)) : fmt(target);
      if (p < 1) requestAnimationFrame(step);
    }
    el.textContent = fmt(0);
    requestAnimationFrame(step);
  }

  function scan() {
    var app = document.getElementById('app');
    if (app) app.querySelectorAll(SEL).forEach(run);
  }

  function boot() {
    var app = document.getElementById('app');
    if (!app) { setTimeout(boot, 120); return; }
    scan();
    // Route renders replace #app's direct children in one shot; watch childList
    // only (NOT subtree) so our own per-frame textContent writes don't re-trigger.
    new MutationObserver(function () { requestAnimationFrame(scan); })
      .observe(app, { childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
