# Morning Briefing Dashboard

Static market briefing site on Cloudflare Pages, data piped from Raspberry Pi.

## Architecture

- **Site:** Plain HTML/CSS/JS on Cloudflare Pages (zero build step)
- **Data:** Pi cron generates JSON → commits to GitHub → auto-deploys
- **Chat:** Cloudflare Worker proxies to OpenRouter (API key stays server-side)
- **Design:** Dark theme, professional financial dashboard, mobile-responsive

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full design.

## Quick Start

```bash
# Deploy site to Cloudflare Pages
npx wrangler pages deploy .

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
├── index.html                   # SPA entry point
├── assets/
│   ├── css/style.css            # Dark theme
│   └── js/                      # Route-based vanilla JS
├── data/                        # JSON files (committed by Pi)
├── cloudflare-worker/           # Chat API proxy
└── pi-scripts/                  # Data generation scripts
```
