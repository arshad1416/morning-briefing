/**
 * App initialization — register routes, start router, wire theme toggle.
 */
(function () {
  'use strict';

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

  // ── Routes ──────────────────────────────────────────────────
  Router.register('/',              function (app)         { Dashboard.render(app); });
  Router.register('/watchlist',     function (app)         { Watchlist.render(app); });
  Router.register('/archive',       function (app)         { Archive.render(app); });
  Router.register('/trades',        function (app)         { PaperTrades.render(app); });
  Router.register('/prediction-engine', function (app)    { PredictionEngine.render(app); });
  Router.register('/chat',          function (app)         { Chat.render(app); });
  Router.register('/maplegamma',   function (app)         { MapleGamma.renderLanding(app); });
  Router.register('/mg',           function (app)         { MapleGamma.renderDashboard(app); });
  Router.register('/backtest-research', function (app)    { BacktestResearch.render(app); });
  Router.register('/portfolio',      function (app)         { Portfolio.render(app); });
  Router.register('/simulation',     function (app)         { Simulation.render(app); });
  Router.register('/screener',       function (app)         { Screener.render(app); });
  Router.register('/ticker/:ticker',function (app, params) { TickerDetail.render(app, params); });
  Router.register('/archive/:date', function (app, params) { Archive.renderDate(app, params); });

  // ── Start ────────────────────────────────────────────────────
  Router.init();

})();
