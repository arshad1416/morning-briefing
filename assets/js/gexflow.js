/**
 * GEX & Flow — the MapleGamma gamma dashboard and unusual options flow,
 * merged into one first-class nav section. The flow tables are the
 * evidence layer for the gamma story, so they live together.
 */
const GexFlow = {
  async render(app) {
    const q = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const wantTab = q.get('tab') === 'flow' ? 'flow' : 'gamma';

    let html = '<div class="section">';
    html += '<div class="research-tabs" style="display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap">';
    html += '<button class="research-tab' + (wantTab === 'gamma' ? ' active' : '') + '" data-subtab="gx-gamma">Gamma Profile</button>';
    html += '<button class="research-tab' + (wantTab === 'flow' ? ' active' : '') + '" data-subtab="gx-flow">Options Flow</button>';
    html += '</div>';
    html += '<div class="research-pane" id="gx-gamma"' + (wantTab === 'flow' ? ' style="display:none"' : '') + '></div>';
    html += '<div class="research-pane" id="gx-flow"' + (wantTab === 'flow' ? '' : ' style="display:none"') + '></div>';
    html += '</div>';
    app.innerHTML = html;

    const gammaPane = document.getElementById('gx-gamma');
    const flowPane = document.getElementById('gx-flow');
    if (wantTab === 'flow' && flowPane) {
      OptionsFlow.render(flowPane);
      flowPane.dataset.loaded = '1';
    } else if (gammaPane) {
      MapleGamma.renderDashboard(gammaPane);
      gammaPane.dataset.loaded = '1';
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
          if (this.dataset.subtab === 'gx-flow') OptionsFlow.render(pane);
          else MapleGamma.renderDashboard(pane);
        }
      });
    });
  }
};
