/**
 * Client-side SPA router for Morning Briefing Dashboard.
 * Uses hash-based routing (#/path) — no server config needed on Cloudflare Pages.
 */
const Router = {
  routes: {},
  currentHash: null,
  navLinks: null,

  init() {
    this.navLinks = document.querySelectorAll('.nav-link');
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute(); // Handle initial load
  },

  register(path, handler, guard) {
    // Store an entry object so routes can carry an optional async guard.
    // Routes registered without a guard behave exactly as before.
    this.routes[path] = { handler: handler, guard: guard };
  },

  async handleRoute() {
    const fullHash = window.location.hash.slice(1) || '/';
    const hash = fullHash.split('?')[0]; // Strip query string from hash
    this.currentHash = hash;

    // Update active nav link
    this.navLinks.forEach(link => {
      const linkHash = link.getAttribute('href')?.slice(1).split('?')[0] || '';
      link.classList.toggle('active', linkHash === hash);
    });

    const app = document.getElementById('app');
    if (!app) return;

    // Clear stale content before routing
    app.innerHTML = '<div class="loading">Loading...</div>';
    app.classList.remove('page-enter');

    // Try exact match first
    if (this.routes[hash]) {
      const entry = this.routes[hash];
      // Run the route guard (if any) before rendering.
      // Two failure modes:
      //   • needTier = null  → not authenticated; guard already redirected to
      //     #/account. Skip rendering entirely (no paywall overlay).
      //   • needTier = 'basic'|'pro' → authenticated but tier insufficient.
      //     Render the page (blurred background), then overlay the paywall.
      let guardResult = { ok: true };
      if (entry.guard) {
        const r = await entry.guard();
        guardResult = r || { ok: false };
      }
      if (!guardResult.ok && !guardResult.needTier) return; // auth redirect — don't render
      const paywallNeeded = guardResult && guardResult.ok === false && guardResult.needTier;
      try {
        Promise.resolve(entry.handler(app)).then(function () {
          if (paywallNeeded) {
            Paywall.lock(app, guardResult.needTier, guardResult.me);
          }
          requestAnimationFrame(function () {
            app.classList.add('page-enter');
          });
        }).catch(function (e) {
          app.innerHTML = '<div class="error-card">Error loading page: ' + Utils.esc(e.message) + '</div>';
          requestAnimationFrame(function () {
            app.classList.add('page-enter');
          });
        });
      } catch(e) {
        app.innerHTML = '<div class="error-card">Error loading page: ' + Utils.esc(e.message) + '</div>';
        requestAnimationFrame(function () {
          app.classList.add('page-enter');
        });
      }
      return;
    }

    // Try parameterized route (e.g., #/ticker/NVDA)
    const parts = hash.split('/');
    for (const [pattern, entry] of Object.entries(this.routes)) {
      const patternParts = pattern.split('/');
      if (patternParts.length === parts.length) {
        const params = {};
        let match = true;
        for (let i = 0; i < patternParts.length; i++) {
          if (patternParts[i].startsWith(':')) {
            params[patternParts[i].slice(1)] = parts[i];
          } else if (patternParts[i] !== parts[i]) {
            match = false;
            break;
          }
        }
        if (match) {
          let guardResult = { ok: true };
          if (entry.guard) {
            const r = await entry.guard();
            guardResult = r || { ok: false };
          }
          if (!guardResult.ok && !guardResult.needTier) return; // auth redirect — don't render
          const paywallNeeded = guardResult && guardResult.ok === false && guardResult.needTier;
          try {
            Promise.resolve(entry.handler(app, params)).then(function () {
              if (paywallNeeded) {
                Paywall.lock(app, guardResult.needTier, guardResult.me);
              }
              requestAnimationFrame(function () {
                app.classList.add('page-enter');
              });
            }).catch(function (e) {
              app.innerHTML = '<div class="error-card">Error loading page: ' + Utils.esc(e.message) + '</div>';
              requestAnimationFrame(function () {
                app.classList.add('page-enter');
              });
            });
          } catch(e) {
            app.innerHTML = '<div class="error-card">Error loading page: ' + Utils.esc(e.message) + '</div>';
            requestAnimationFrame(function () {
              app.classList.add('page-enter');
            });
          }
          return;
        }
      }
    }

    // 404 fallback
    app.innerHTML = '<div class="empty-state">Page not found</div>';
    requestAnimationFrame(function () {
      app.classList.add('page-enter');
    });
  },

  navigate(path) {
    window.location.hash = `#${path}`;
  }
};
