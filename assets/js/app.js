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
  Router.register('/positions',     function (app)         { PaperTrades.render(app); });
  Router.register('/options',       function (app)         { OptionsFlow.render(app); });
  Router.register('/maplegamma',    function (app)         { MapleGamma.renderDashboard(app); });
  Router.register('/research',      function (app)         { Research.render(app); });
  Router.register('/charts',        function (app)         { Charts.render(app); });
  Router.register('/models',        function (app)         { Models.render(app); });
  Router.register('/screener',      function (app)         { Screener.render(app); });

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

})();
