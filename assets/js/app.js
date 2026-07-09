/**
 * App initialization — register routes, start router, wire theme toggle.
 */
(function () {
  'use strict';
  console.log('app.js started');

  // ── Theme toggle ────────────────────────────────────────────
  // The <head> inline script already applied the saved/OS theme
  // before paint. Here we just wire the button UI to stay in sync.

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mb-theme', theme);
    updateToggleUI(theme);
  }

  function updateToggleUI(theme) {
    var btn   = document.getElementById('theme-toggle');
    var icon  = btn && btn.querySelector('.theme-toggle-icon');
    var label = btn && btn.querySelector('.theme-toggle-label');
    if (!btn) return;
    if (theme === 'dark') {
      if (icon)  icon.textContent  = '☀';
      if (label) label.textContent = 'Light';
      btn.setAttribute('aria-label', 'Switch to light mode');
    } else {
      if (icon)  icon.textContent  = '☾';
      if (label) label.textContent = 'Dark';
      btn.setAttribute('aria-label', 'Switch to dark mode');
    }
  }

  // Set initial button label once DOM is ready
  updateToggleUI(getTheme());

  var toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      setTheme(getTheme() === 'dark' ? 'light' : 'dark');
    });
  }

  // ── Routes ──
  // New consolidated routes
  Router.register('/',              function (app)         { Dashboard.renderToday(app); });
  Router.register('/today',         function (app)         { Dashboard.renderToday(app); });
  Router.register('/options',       function (app)         { OptionsFlow.render(app); });
  Router.register('/maplegamma',    function (app)         { MapleGamma.renderDashboard(app); });

  // Auth / billing pages (public)
  Router.register('/account',       function (app)         { Account.render(app); });
  Router.register('/pricing',       function (app)         { Pricing.render(app); });

  // Paid routes — gated by entitlement tier (guard redirects if not allowed)
  Router.register('/positions',     function (app)         { PaperTrades.render(app); }, function () { return Auth.guard('basic'); });
  Router.register('/research',      function (app)         { Research.render(app); },     function () { return Auth.guard('basic'); });
  Router.register('/screener',      function (app)         { Screener.render(app); },     function () { return Auth.guard('basic'); });
  Router.register('/charts',        function (app)         { Charts.render(app); },       function () { return Auth.guard('pro'); });
  Router.register('/models',        function (app)         { Models.render(app); },       function () { return Auth.guard('pro'); });

  // Legacy redirects
  Router.register('/mg',            function (app)         { window.location.hash = '#/maplegamma'; });
  Router.register('/archive',       function (app)         { window.location.hash = '#/research'; });
  Router.register('/backtest-research', function (app)    { window.location.hash = '#/research'; });
  Router.register('/trades',        function (app)         { window.location.hash = '#/positions'; });
  Router.register('/portfolio',     function (app)         { window.location.hash = '#/positions'; });
  Router.register('/simulation',    function (app)         { window.location.hash = '#/models'; });
  Router.register('/prediction-engine', function (app)    { window.location.hash = '#/models'; });
  Router.register('/chat',          function (app)         { window.location.hash = '#/research'; });

  Router.register('/ticker/:ticker',function (app, params) { TickerDetail.render(app, params); });
  Router.register('/archive/:date', function (app, params) { window.location.hash = '#/research'; });

  // ── Start ────────────────────────────────────────────────────
  Router.init();

  // ── Auth nav affordance ──
  // Runs here (after auth.js is loaded, since app.js is ordered last) rather
  // than as an inline <script> in index.html — the dynamic script loader would
  // execute an inline tag before auth.js runs, leaving Auth undefined.
  (function wireAuthNav() {
    var el = document.getElementById('nav-auth');
    if (!el || typeof Auth === 'undefined') return;
    Auth.me().then(function (me) {
      if (me && me.email) {
        el.textContent = me.email;
        el.setAttribute('title', 'Signed in as ' + me.email);
      } else {
        el.textContent = 'Sign in';
      }
    }).catch(function () { /* leave default "Sign in" label */ });
  })();

  // ── Shimmer loading helper ──
  window.showShimmer = function (container, lines) {
    lines = lines || 4;
    var html = '<div class="shimmer-placeholder">';
    for (var i = 0; i < lines; i++) {
      html += '<div class="shimmer-line"></div>';
    }
    html += '<div class="shimmer-card"></div>';
    html += '</div>';
    container.innerHTML = html;
  };

})();
