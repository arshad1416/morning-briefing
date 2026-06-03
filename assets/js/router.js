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
    const hash = window.location.hash.slice(1) || '/';
    this.currentHash = hash;

    // Update active nav link
    this.navLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${hash}`);
    });

    // Find matching route
    const app = document.getElementById('app');

    // Try exact match first
    if (this.routes[hash]) {
      this.routes[hash](app);
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
          handler(app, params);
          return;
        }
      }
    }

    // 404 fallback
    app.innerHTML = '<div class="empty-state">Page not found</div>';
  },

  navigate(path) {
    window.location.hash = `#${path}`;
  }
};
