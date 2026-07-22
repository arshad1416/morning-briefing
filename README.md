# Morning Briefing Dashboard

Static market briefing site on Cloudflare Pages, data piped from Raspberry Pi.

## Architecture

- **Site:** Next.js 15 static export (`output: 'export'`) on Cloudflare Pages
  - Build command: `npm run build` → output dir `out/` (configured in the Pages dashboard)
  - `_headers`, `robots.txt`, `sitemap.xml`, `llms.txt`, and the legal pages live in
    `public/` and are copied verbatim into `out/` at build time
- **Data:** Pi cron generates JSON → commits `data/**` + `public/data/**` → each push
  triggers a Pages rebuild so `out/data/` stays fresh (~20–25 builds/weekday; the free
  tier allows 500 builds/month — watch the quota)
- **Chat:** Cloudflare Worker proxies to OpenRouter (API key stays server-side)
- **Design:** Dark theme, professional financial dashboard, mobile-responsive
- **Engine code:** The MapleGamma council learn loop (5-expert council, trade
  executor, outcome scoring, strategy improvement, context A/B harness) lives in
  [arshad1416/hermes-scripts](https://github.com/arshad1416/hermes-scripts) — it
  runs from `~/.hermes/scripts/` on the Pi and only its *outputs* are committed
  here (`data/maplegamma_analysis*.json`, `data/trade_outcomes*.json`,
  `data/strategy_improvement*.json`, `data/council_history.json`)

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full design.

## Quick Start

```bash
# Site deploys automatically via git-connected Cloudflare Pages
# (build: npm run build, output: out/). Manual deploy if ever needed:
npm run build && npx wrangler pages deploy out --project-name morningbriefing

# Deploy chat worker
cd cloudflare-worker && npx wrangler deploy

# Set up Pi cron (run on Pi)
hermes cron create '15 7 * * 1-5' \
  --name 'Morning Briefing Site Data' \
  --script generate-site-data.sh \
  --no-agent
```

## Directory Structure

```
├── src/app/                     # Next.js 15 app router pages (the live site)
├── src/components|lib|stores/   # UI components, schemas/queries, state
├── public/                      # Static assets + public data (copied into out/)
├── data/                        # JSON files (committed by Pi)
├── cloudflare-worker/           # /api/* Worker (auth, billing, gated data, chat)
├── pi-scripts/                  # Data generation scripts (synced copies of Pi's ~/.hermes/scripts)
├── index.html, assets/          # LEGACY vanilla-JS SPA — unused, pending removal
└── e2e/                         # Playwright tests
```
