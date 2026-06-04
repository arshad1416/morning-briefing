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

  // ── Routes ── Register handlers with direct references ───────────
  // Store module references at registration time (not closure-delayed)
  var _routes = {
    '/':                Dashboard,
    '/watchlist':       Watchlist,
    '/archive':         Archive,
    '/trades':          PaperTrades,
    '/prediction-engine': PredictionEngine,
    '/chat':            Chat,
    '/maplegamma':      MapleGamma,
    '/mg':              MapleGamma,
    '/backtest-research': BacktestResearch,
    '/portfolio':        Portfolio,
    '/simulation':       Simulation,
    '/screener':         Screener,
    '/ticker/:ticker':  TickerDetail,
    '/archive/:date':   Archive,
  };
  for (var path in _routes) {
    if (_routes[path]) {
      (function(mod, p) {
        if (p === '/mg') {
          Router.register(p, function (app) { mod.renderDashboard(app); });
        } else if (p === '/maplegamma') {
          Router.register(p, function (app) { mod.renderLanding(app); });
        } else if (p.indexOf(':') >= 0) {
          Router.register(p, function (app, params) { mod.render(app, params); });
        } else {
          Router.register(p, function (app) { mod.render(app); });
        }
      })(_routes[path], path);
    }
  }

  // ── Start ────────────────────────────────────────────────────
  Router.init();

})();
