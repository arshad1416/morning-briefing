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

  register(path, handler) {
    this.routes[path] = handler;
  },

  handleRoute() {
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
      try {
        Promise.resolve(this.routes[hash](app)).then(function () {
          // Fade-in the page content after route renders
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
    for (const [pattern, handler] of Object.entries(this.routes)) {
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
          try {
            Promise.resolve(handler(app, params)).then(function () {
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
