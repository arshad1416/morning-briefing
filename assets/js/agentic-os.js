/**
 * AgenticOS — system dashboard for AI infrastructure.
 * Shows watchdog status, collector health, skill usage, cron state.
 */
var AgenticOS = (function () {
  'use strict';

  var CACHE_TTL = 300000; // 5 min

  function fetchJSON(path) {
    return fetch(path + '?v=' + Date.now())
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  function esc(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s || ''));
    return d.innerHTML;
  }

  function timeAgo(ts) {
    if (!ts) return 'never';
    var s = Math.floor((Date.now() / 1000) - ts);
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  function statusBadge(s) {
    var map = {
      'ok': '🟢',
      'active': '🟢',
      'error': '🔴',
      'fail': '🔴',
      'inactive': '⚪',
      'disabled': '⏸️',
      'idle': '💤',
      'unknown': '❓'
    };
    return '<span class="os-badge os-' + s + '">' + (map[s] || '❓') + ' ' + esc(s) + '</span>';
  }

  function renderSystemCard(sys) {
    return '<div class="os-card">' +
      '<h3 class="os-card-title">⚙️ System</h3>' +
      '<div class="os-card-body">' +
        '<div class="os-row"><span class="os-label">Model</span><span class="os-value">' + esc(sys.model) + '</span></div>' +
        '<div class="os-row"><span class="os-label">Provider</span><span class="os-value">' + esc(sys.provider) + '</span></div>' +
      '</div></div>';
  }

  function renderWatchdogCard(wd) {
    if (!wd || wd.status === 'inactive') {
      return '<div class="os-card"><h3 class="os-card-title">🛡️ Watchdog</h3><div class="os-card-body"><em>No data</em></div></div>';
    }
    return '<div class="os-card">' +
      '<h3 class="os-card-title">🛡️ Watchdog</h3>' +
      '<div class="os-card-body">' +
        '<div class="os-row"><span class="os-label">Status</span><span class="os-value">' + statusBadge(wd.status) + '</span></div>' +
        '<div class="os-row"><span class="os-label">Heartbeat</span><span class="os-value">' + timeAgo(wd.last_heartbeat) + '</span></div>' +
        '<div class="os-row"><span class="os-label">Broker</span><span class="os-value">' + (wd.broker_reachable ? '🟢 Reachable' : '🔴 Unreachable') + '</span></div>' +
        '<div class="os-row"><span class="os-label">Positions</span><span class="os-value">' + wd.open_positions + ' (' + wd.stops_armed + ' armed' + (wd.unprotected ? ', <span class="os-danger">' + wd.unprotected + ' UNPROTECTED</span>' : '') + ')</span></div>' +
      '</div></div>';
  }

  function renderRecCronCard(rc) {
    if (!rc) return '';
    return '<div class="os-card">' +
      '<h3 class="os-card-title">🔧 Rec Cron</h3>' +
      '<div class="os-card-body">' +
        '<div class="os-row"><span class="os-label">Status</span><span class="os-value">' + statusBadge(rc.status) + '</span></div>' +
        (rc.last_findings_sent ? '<div class="os-row"><span class="os-label">Last findings</span><span class="os-value">' + timeAgo(rc.last_findings_sent) + '</span></div>' : '') +
        (rc.kill_clock_running ? '<div class="os-row"><span class="os-label">Kill clock</span><span class="os-value os-danger">⚠️ ' + (rc.hours_until_auto_disable || 0) + 'h remaining</span></div>' : '<div class="os-row"><span class="os-label">Kill clock</span><span class="os-value">✅ Clean</span></div>') +
      '</div></div>';
  }

  function renderSkillsCard(sk) {
    if (!sk || !sk.total) return '';
    var cats = Object.entries(sk.by_category || {})
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 8)
      .map(function (c) { return '<span class="os-chip">' + esc(c[0]) + ': ' + c[1] + '</span>'; })
      .join('');
    return '<div class="os-card">' +
      '<h3 class="os-card-title">📦 Skills (' + sk.total + ')</h3>' +
      '<div class="os-card-body"><div class="os-chips">' + cats + '</div></div></div>';
  }

  function renderUsageCard(us) {
    if (!us) return '';
    return '<div class="os-card">' +
      '<h3 class="os-card-title">📊 Usage (7d)</h3>' +
      '<div class="os-card-body">' +
        '<div class="os-row"><span class="os-label">Active days</span><span class="os-value">' + us.days + '/7</span></div>' +
        '<div class="os-row"><span class="os-label">Prompts</span><span class="os-value">' + us.total_prompts + '</span></div>' +
        '<div class="os-row"><span class="os-label">Commands</span><span class="os-value">' + us.total_commands + '</span></div>' +
      '</div></div>';
  }

  function render(app) {
    app.innerHTML = '<div class="loading">Loading system status...</div>';

    fetchJSON('/data/agentic-os.json').then(function (osData) {
      var html = '<div class="os-container">';
      html += '<h2 class="os-header">🧠 Agentic OS <span class="os-subtitle">' + esc(osData.generated_at || '') + '</span></h2>';

      // Grid: two columns
      html += '<div class="os-grid">';

      // Top row — system + watchdog
      html += '<div class="os-grid-col">';
      if (osData.system) html += renderSystemCard(osData.system);
      if (osData.usage_7d) html += renderUsageCard(osData.usage_7d);
      html += '</div>';

      html += '<div class="os-grid-col">';
      if (osData.watchdog) html += renderWatchdogCard(osData.watchdog);
      if (osData.rec_cron) html += renderRecCronCard(osData.rec_cron);
      html += '</div>';

      // Full width — skills
      html += '<div class="os-grid-full">';
      if (osData.skills) html += renderSkillsCard(osData.skills);
      html += '</div>';

      html += '</div>'; // grid
      html += '</div>'; // container

      // Add inline styles
      html += '<style>' +
        '.os-container { padding: 20px; max-width: 1200px; margin: 0 auto; }' +
        '.os-header { font-size: 1.5rem; margin-bottom: 20px; color: var(--text-primary); }' +
        '.os-subtitle { font-size: 0.85rem; color: var(--text-secondary); font-weight: 400; margin-left: 10px; }' +
        '.os-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }' +
        '.os-grid-full { grid-column: 1 / -1; }' +
        '@media (max-width: 768px) { .os-grid { grid-template-columns: 1fr; } }' +
        '.os-card { background: var(--card-bg, #fff); border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 16px; border: 1px solid var(--border-color, #e5e7eb); }' +
        '.os-card-title { font-size: 1rem; margin: 0 0 12px 0; color: var(--text-primary); padding-bottom: 8px; border-bottom: 1px solid var(--border-color, #e5e7eb); }' +
        '.os-card-body { font-size: 0.9rem; }' +
        '.os-row { display: flex; justify-content: space-between; padding: 4px 0; }' +
        '.os-label { color: var(--text-secondary, #6b7280); }' +
        '.os-value { color: var(--text-primary); font-weight: 500; text-align: right; }' +
        '.os-danger { color: #dc2626; font-weight: 700; }' +
        '.os-badge { padding: 2px 8px; border-radius: 4px; font-size: 0.85rem; }' +
        '.os-chips { display: flex; flex-wrap: wrap; gap: 6px; }' +
        '.os-chip { background: var(--badge-bg, #f3f4f6); padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; color: var(--text-primary); }' +
      '</style>';

      app.innerHTML = html;
    }).catch(function (err) {
      app.innerHTML = '<div class="error-card">' +
        '<h3>Could not load Agentic OS data</h3>' +
        '<p>' + esc(err.message) + '</p>' +
        '<p><em>The data generator may not have run yet. It runs as part of the morning briefing pipeline on the Pi.</em></p>' +
        '</div>';
    });
  }

  return { render: render };
})();
