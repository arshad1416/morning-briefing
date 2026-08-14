# AGENTS.md — agent guide for morning-briefing (MapleGamma)

**maplegamma.com** is three systems in one repo: a Next.js 15 static export (`src/`) served by
Cloudflare Pages, a Cloudflare Worker (`cloudflare-worker/`) serving all dynamic `/api/*`
(auth/passkeys, chat, Helcim billing, entitlement-gated premium data), and a Raspberry Pi cron
pipeline (`pi-scripts/`) that generates every market JSON and commits it to `main`.
Read this file first; it routes to everything else.

## Golden rules

1. **`main` moves on its own.** The Pi commits machine-generated JSON (`Live portfolio
   YYYY-MM-DD HH:MM`, `Analysis YYYY-MM-DD HH:MM`) every ~30 minutes during market hours
   (`push_dashboard` at :07 and :37 of 09–15, plus 17:15 weekdays and 07:22 weekends), touching
   `data/` and `public/data/`.
   Never hand-edit those JSON files; long-lived branches race these commits. Each *push* consumes
   a Cloudflare Pages build, and the quota is 500/month **per account** — shared with the
   `job-hunt-board` Pages project, so count both.
   **Measure builds as deployments, never as commits.** Several commits can ride one push
   (2026-08-14: 22 commits but 17 builds), and extrapolating commits linearly over-counts badly.
   The real figure is the Pages deployments API (`per_page` caps at 25, so paginate with `page`);
   `wrangler pages deployment list` truncates at 25 and cannot answer this.
   Measured 2026-08-14: **256 builds Aug 1–14 across both projects**, projecting ~427 for the
   month — under the cap, with Aug 4–7 inflated by audit activity. Don't add push frequency
   without re-measuring this way.
2. **README.md's Architecture section is the source of truth.** `ARCHITECTURE.md`,
   `SCREENER-ARCHITECTURE.md` (its frontend half), `GEX-DASHBOARD-ARCHITECTURE.md`, and
   `MAPLEGAMMA-DESIGN.md` are June-2026 design history: their file paths, schemas, wrangler
   samples, and code snippets predate the Next.js migration. Use them for rationale and intent
   only — never implement from them.
3. **The root `index.html` + `assets/` tree is the dead legacy SPA** (pending removal). Only
   `src/` builds the site, and only `public/` is copied into the export. Editing legacy files
   changes nothing on the live site.
4. **`pi-scripts/` are version-controlled copies, not the live pipeline.** Most scripts execute
   from `~/.hermes/scripts/` on the Pi (its own repo: `arshad1416/hermes-scripts`, auto-pulled
   by the Pi), so editing a copy here deploys nothing by itself — see
   `pi-scripts/deploy-hermes-fixes.sh` for the porting pattern. A few (e.g.
   `generate-screener-data.py`) run from the Pi's repo checkout and ARE deployed by merging.
   `pi-scripts/crontab.txt` is the schedule snapshot; `crontab -l` on the Pi is authoritative.
5. **Premium data is fail-closed and lives in four places.** Adding or reclassifying a gated
   file requires `pi-scripts/r2_sync.py` (`PRIVATE_FILES`), `.gitignore` (both the `data/` and
   `public/data/` entries), and `cloudflare-worker/src/data_gate.js` — miss one and the publish
   hard-fails or the file leaks onto Pages. Caveat: the live `r2_sync.py` is the
   `~/.hermes/scripts/` copy (`push_dashboard.py` imports it from there) — port the edit per
   rule 4, or the new file is gated in the Worker but never uploaded to R2.
6. **Labels have lied before.** Displayed labels have described the wrong value (max-pain
   labeled "Max GEX Strike"; "Options Flow" containing no flow data). Before rewording any
   label or tooltip, trace it through `src/lib/schemas/` and the generator in `pi-scripts/`;
   hedge words ("simulated", "estimate", "delayed") must survive rewrites. All jargon wording
   lives in `src/lib/glossary/index.ts` (typed keys — an undefined term fails typecheck),
   consumed via `InfoTip`/`PlainLabel`. Never inline explanation text in a component.
7. **One pitch per gated tile.** A tile wrapped in `FeatureGate` must never also render its own
   `GateCard` on a server 401/403 — render a quiet frame under the overlay instead. Regression
   specs: `e2e/tests/gating.spec.js`.

## Setup and commands

Fresh checkouts and worktrees need three installs: `npm install` at the root, in `e2e/`, and in
`cloudflare-worker/` (plus `npx playwright install` inside `e2e/` once).

| Where | Command | What |
|---|---|---|
| root | `npm run dev` | Next dev server |
| root | `npm run build` | static export → `out/` (what Pages and e2e both serve) |
| root | `npm run lint` / `npm run typecheck` | eslint / `tsc --noEmit` — glossary typos and schema drift fail typecheck by design |
| root | `npm run test:e2e` | Playwright (chromium + webkit, desktop/tablet/320px); builds and serves `out/` itself; set `BASE_URL` to test a deployed origin instead |
| `cloudflare-worker/` | `npm test` | vitest via `@cloudflare/vitest-pool-workers` — runs fully local (miniflare), fast |
| `cloudflare-worker/` | `npm run dev` / `npm run deploy` | wrangler dev / deploy |
| `cloudflare-worker/` | `npm run db:migrate:local` / `npm run db:migrate:remote` | D1 migrations |
| `pi-scripts/` | `python3 -m unittest test_fetch_universe_constituents test_universe_membership test_volume_nan test_push_autostash_conflict` | runs locally without the Pi venv (stubs yfinance/pandas; the autostash suite drives real `git` in a tmpdir); CI runs exactly this set. Other `test_*.py` here need the Pi venv — don't use `unittest discover` |

**Deploys:** frontend ships by merging to `main` (Pages auto-builds). The Worker is manual —
run `npm run deploy` in `cloudflare-worker/` after merging Worker changes. Worker secrets go
through `wrangler secret put` only; `wrangler.toml [vars]` is for non-secret config.

**CI:** `.github/workflows/ci.yml` runs lint, typecheck, build, Worker vitest, and e2e on PRs
and code pushes to `main`; the Pi's data commits are path-ignored so they trigger nothing.
`deadman.yml` separately emails the owner when the live site's public data goes stale (>26h).

## Task routing

| Task | Read first |
|---|---|
| Any page UI | `src/app/<route>/page.tsx` (thin server wrapper, metadata) + its sibling `*-client.tsx` (all interactivity lives there) |
| Design tokens / theme | `src/app/globals.css` — Tailwind 4 `@theme` CSS variables; there is no `tailwind.config`; light theme via `:root[data-theme='light']` |
| Shared atoms | `src/components/primitives/` (Surface, Stat, InfoTip, PlainLabel, Sparkline, …) |
| Nav, grid, drag-reorder | `src/components/layout/` (AppShell, BentoGrid, DraggableBentoGrid — dnd-kit) |
| Data fetching | `src/lib/api/` (`gated.ts` for premium), query factories in `src/lib/query/`, zod schemas in `src/lib/schemas/` |
| Auth / session | `src/lib/auth/` (client) + `cloudflare-worker/src/session.js`, `auth_*.js` (server) |
| Gating / monetization | `src/components/feature/gating/`, `src/stores/entitlements.ts`; the Worker's `data_gate.js` maps files to tiers, and tier ranking lives in `session.js` `meetsTier` (trial ranks as pro) |
| GEX / options page | `src/app/options/`, `src/components/feature/options/`; payload shape in `src/lib/schemas/market.ts` — not the GEX doc |
| Screener | `src/app/screener/`, `src/lib/schemas/screener.ts`; generator `pi-scripts/generate-screener-data.py`; real invocation in `pi-scripts/crontab.txt` |
| Worker API routes | `cloudflare-worker/src/index.js` (mounting, CORS, canonical-host redirects); bindings and domains in `wrangler.toml` |
| D1 schema | `cloudflare-worker/migrations/*.sql` + `src/db.js`; **also append the new migration to `test/helpers.js` `migrate()` or tests silently run a stale schema** |
| Billing | `cloudflare-worker/src/billing.js` — Helcim API quirks are documented in its comments |
| Pipeline scripts | `pi-scripts/pipeline_runtime.py` (atomic writes, retries), `pipeline_schemas.py` (fail-closed validation), `push_dashboard.py` (publish flow) |
| E2E contracts | `e2e/tests/` — `gating.spec.js` (per-tier CTAs), `responsive-layout.spec.js` (overflow/a11y across 14 routes), `research-details.spec.js` |
| History / rationale / plans | README.md first; `ARCHITECTURE.md` §6–8 for the "why"; `ROADMAP.md` for shipped vs. planned (stale since ~June 30) |

## Frontend conventions

- Static-export constraints are load-bearing: `output:'export'`, `trailingSlash:true`; dynamic
  routes need `generateStaticParams` with `dynamicParams=false`. A new archive date or ticker
  page only exists after the next Pages rebuild.
- State is zustand + persist, one store per concern (`mg-ui`, `mg-layout`, `mg-watchlist`
  localStorage keys).
- Every fetched payload is zod-validated — except two deliberate holes (positions-client's
  any-passthrough and the archive pages' eslint-disabled `any`s); don't "fix" those blindly.
- Framer Motion is always paired with `useReducedMotion` guards.
- Page metadata goes through `buildMetadata` (`src/lib/seo.ts`) — Next merges metadata
  shallowly, so pages that skip it get the homepage's social cards.
