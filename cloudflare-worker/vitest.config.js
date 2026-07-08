import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
export default defineWorkersConfig({
  // Inline (empty) PostCSS config so Vite does NOT walk up to the parent
  // static-site's postcss.config.mjs (Tailwind), which isn't installed here.
  css: { postcss: { plugins: [] } },
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: { compatibilityFlags: ['nodejs_compat'] },
      },
    },
  },
});
