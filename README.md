# Morning Briefing Dashboard

Static market briefing site on Cloudflare Pages, data piped from Raspberry Pi.

## Architecture

- **Site:** Next.js 15 static export (`output: 'export'`) on Cloudflare Pages
  - Build command: `npm run build` → output dir `out/` (configured in the Pages dashboard)
  - `_headers`, `llms.txt`, and legal pages live in `public/`; `robots.txt` and
    `sitemap.xml` are generated at build time from route/archive/ticker coverage
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

## Pipeline hardening

Install the validation dependency on the Pi before running the publisher:

```bash
python3 -m pip install -r pi-scripts/requirements-pipeline.txt
```

The SEC, earnings, and Tiingo collectors share a bounded asyncio worker pool,
transient HTTP retry/backoff, rate-limit spacing, and atomic JSON writes. Tiingo
falls back to yfinance when its key or response is unavailable. Before any
premium JSON is uploaded to R2, `pipeline_schemas.py` rejects malformed council
envelopes and every NaN/Infinity value. Validation failure is fail-closed: the
publisher refuses to continue rather than exposing a corrupt artifact.

`council_weighting.py` contains the provider-neutral five-mandate weighting
engine. The live council executor remains in `arshad1416/hermes-scripts`; map
its provider IDs to the five stable mandates and call `dynamic_model_weights`
there before aggregation.

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
