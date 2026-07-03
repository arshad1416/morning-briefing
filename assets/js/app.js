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
  // Five-section IA: Briefing / Markets / GEX & Flow / Track Record / Research
  Router.register('/',              function (app)         { Dashboard.renderToday(app); });
  Router.register('/markets',       function (app)         { Markets.render(app); });
  Router.register('/gex',           function (app)         { GexFlow.render(app); });
  Router.register('/track-record',  function (app)         { PaperTrades.render(app); });
  Router.register('/research',      function (app)         { Research.render(app); });

  // Legacy redirects (preserve query string, e.g. ?filter=XLV)
  function redirect(target) {
    return function () {
      var q = window.location.hash.split('?')[1] || '';
      window.location.hash = '#' + target + (q ? (target.indexOf('?') >= 0 ? '&' : '?') + q : '');
    };
  }
  Router.register('/today',         redirect('/'));
  Router.register('/positions',     redirect('/track-record'));
  Router.register('/trades',        redirect('/track-record'));
  Router.register('/portfolio',     redirect('/track-record'));
  Router.register('/models',        redirect('/track-record?tab=predictions'));
  Router.register('/simulation',    redirect('/track-record?tab=predictions'));
  Router.register('/prediction-engine', redirect('/track-record?tab=predictions'));
  Router.register('/options',       redirect('/gex?tab=flow'));
  Router.register('/maplegamma',    redirect('/gex'));
  Router.register('/mg',            redirect('/gex'));
  Router.register('/screener',      redirect('/markets'));
  Router.register('/charts',        redirect('/markets?tab=charts'));
  Router.register('/archive',       redirect('/research'));
  Router.register('/backtest-research', redirect('/research'));
  Router.register('/chat',          redirect('/research'));

  Router.register('/ticker/:ticker',function (app, params) { TickerDetail.render(app, params); });
  Router.register('/archive/:date', function (app, params) { window.location.hash = '#/research'; });

  // ── Start ────────────────────────────────────────────────────
  Router.init();

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
