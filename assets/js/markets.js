/**
 * Markets — Screener + Charts under one roof.
 * Charts sub-tab only appears when the chart data pipeline has produced files.
 */
const Markets = {
  _chartsAvailable: null, // cached probe result

  /** Probe once whether the charts pipeline has generated data */
  async _probeCharts() {
    if (this._chartsAvailable != null) return this._chartsAvailable;
    try {
      const res = await fetch('/data/charts/SPY.json?_t=' + Date.now(), { method: 'GET' });
      this._chartsAvailable = res.ok;
    } catch (_e) {
      this._chartsAvailable = false;
    }
    return this._chartsAvailable;
  },

  async render(app) {
    app.innerHTML = '<div class="loading">Loading markets...</div>';

    const q = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const hasCharts = await this._probeCharts();
    const wantTab = q.get('tab') === 'charts' && hasCharts ? 'charts' : 'screener';

    let html = '<div class="section">';
    html += '<div class="research-tabs" style="display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap">';
    html += '<button class="research-tab' + (wantTab === 'screener' ? ' active' : '') + '" data-subtab="mk-screener">Screener</button>';
    if (hasCharts) {
      html += '<button class="research-tab' + (wantTab === 'charts' ? ' active' : '') + '" data-subtab="mk-charts">Charts</button>';
    }
    html += '</div>';
    html += '<div class="research-pane" id="mk-screener"' + (wantTab === 'charts' ? ' style="display:none"' : '') + '></div>';
    if (hasCharts) {
      html += '<div class="research-pane" id="mk-charts"' + (wantTab === 'charts' ? '' : ' style="display:none"') + '></div>';
    }
    html += '</div>';
    app.innerHTML = html;

    // Render the active pane immediately; the other lazily on first click
    const screenerPane = document.getElementById('mk-screener');
    const chartsPane = document.getElementById('mk-charts');
    if (wantTab === 'charts' && chartsPane) {
      Charts.render(chartsPane);
      chartsPane.dataset.loaded = '1';
    } else if (screenerPane) {
      Screener.render(screenerPane);
      screenerPane.dataset.loaded = '1';
    }

    app.querySelectorAll('.research-tab').forEach(tab => {
      tab.addEventListener('click', function () {
        app.querySelectorAll('.research-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        app.querySelectorAll('.research-pane').forEach(p => p.style.display = 'none');
        const pane = document.getElementById(this.dataset.subtab);
        if (!pane) return;
        pane.style.display = 'block';
        if (!pane.dataset.loaded) {
          pane.dataset.loaded = '1';
          if (this.dataset.subtab === 'mk-charts') Charts.render(pane);
          else Screener.render(pane);
        }
      });
    });
  }
};
