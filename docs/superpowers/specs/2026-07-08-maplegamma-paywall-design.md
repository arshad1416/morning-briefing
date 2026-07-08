# MapleGamma Paywall — Design Spec

**Date:** 2026-07-08
**Repo:** arshad1416/morning-briefing (static SPA on Cloudflare Pages) + its chat Worker
**Status:** design approved (all 6 sections + 3 build phases); implementation pending
classifier recovery + owner Helcim account.

## Problem

The site (briefing.arshadkazi.ca) is a static Cloudflare Pages SPA; every
`/data/*.json` is publicly fetchable. We want a real, enforced paywall — not a
client-side flag — with self-serve accounts, a 14-day trial, two paid tiers,
Helcim billing, and a legal/consent gate. CompCeiling did this with a Next.js
backend; this site has none, so we add one via the existing Cloudflare Worker.

## Decisions (locked with user 2026-07-08)

- **Enforcement:** Worker-gated real accounts (not Cloudflare Access, not soft
  client-side).
- **Free vs paid:** Dashboard stays free (regime badge, indices, headlines,
  Reddit pulse, GEX snapshot, action-queue teaser). Paid: Positions, Research,
  Charts, Screener, Models.
- **Tiers:** Basic = Research + Screener. Pro = Basic + Charts + Models
  (+ future alerts). Prices are placeholders set in Helcim at launch.
- **Billing:** Helcim (Canadian), built behind a mockable interface;
  `MOCK_BILLING` mode until owner supplies a Helcim account + API token.
- **Legal scope:** exclude Quebec only (matches existing site notice). Everyone
  accepts Terms + Privacy + not-investment-advice acknowledgment at signup.
- **Build:** full 3 phases.

## Architecture

### 1. Auth & session
- New Worker routes under `/api/auth/*`: `signup`, `login`, `logout`, `me`.
- On login: Worker issues a signed JWT (HMAC via `SESSION_SECRET`) in an
  httpOnly, Secure, SameSite=Lax cookie (`mg_session`), ~30-day expiry.
- **Every gated request** verifies the JWT signature AND does a point-read of
  the user row (`SELECT 1 FROM users WHERE id=?`). A deleted/expired account is
  logged out everywhere immediately. (Designs out CompCeiling's ghost-session
  bug from day one.)
- Passwords: bcrypt (or PBKDF2 via WebCrypto if bcrypt unavailable in Worker
  runtime — decide at build). Per-email login rate limit + dummy-hash timing
  equalization.

### 2. Data store — Cloudflare D1 (SQLite)
Bound to the Worker. Tables:
- `users` (id, email, pw_hash, created_at, signup_ip)
- `subscriptions` (user_id, tier ['trial'|'basic'|'pro'], status, trial_ends_at,
  current_period_end, helcim_customer_id, helcim_plan_id)
- `trial_claims` (device_id, ip, user_id, created_at) — anti-farming
- `consents` (user_id, terms_version, ack_version, quebec_attested, ts)
- `auth_events` (email/ip, type, ts) — rate-limit + audit
- (feedback already routed to Telegram; optional `feedback` table later)

### 3. Gating — two layers
**UX gate (frontend):** SPA checks entitlement (`GET /api/auth/me`) before
rendering a paid route; non-entitled → upgrade/paywall page. Route→tier map:
Research/Screener need Basic+; Charts/Models need Pro.

**Hard gate (data):** premium JSON moves to a **private R2 bucket**, served only
via Worker route `/api/data/:file` (session + tier check → stream from R2).
- **Private (paid-only):** charts/*, tickers/*, walk_forward_v2,
  strategy_improvement, trade_outcomes, morning_analysis, web-news,
  polymarket_sentiment, earnings, sec_filings, journal, maplegamma_analysis,
  and the **full** screener-data.json.
- **Public (free Dashboard needs them):** latest, verdict, reddit-sentiment,
  maplegamma-data (GEX), analysis (headlines), paper_trades (summary), and a new
  trimmed **screener-lite.json** (top ~8 for the action queue).
- Pi's `push_dashboard.py` gains an R2-upload step (S3-compatible API or
  `wrangler r2 object put`) for the private set; public set still goes to Pages.
- Frontend `State.get`/`fetchJSON` learns to hit `/api/data/:file` (credentialed)
  for private files vs `/data/:file` for public.

### 4. Trial + anti-farming
14-day trial per account, pinned to httpOnly device cookie (`mg_device`, 400d)
+ IP in `trial_claims`; one trial/device, N/IP/30d. Cookie-clearing alone can't
mint a new trial. `subscriptionIsLive` enforces `trial_ends_at`.

### 5. Helcim billing (pluggable)
- `billing` module interface: `createCheckout(userId, tier)`,
  `verifyWebhook(req)`, `activateSubscription(userId, tier, helcimIds)`.
- `MOCK_BILLING=1`: checkout activates the sub directly (admin/test only in
  prod) — full flow works with no real money.
- Real Helcim: HelcimPay.js session for the card modal + Helcim recurring/
  payment-plan for the subscription. **Concrete Helcim API calls implemented
  against current Helcim docs at build time — not asserted from memory.**
- **Owner prerequisites:** Helcim account + API token (agent cannot create
  accounts or handle payment credentials). Provided when ready.

### 6. Legal gate
- Signup form requires: accept Terms + Privacy (checkbox), acknowledge
  "general info, not investment advice, paper-only, past performance…", attest
  "I am not a resident of Quebec." Quebec attestation → bilingual not-available
  notice, signup blocked.
- Consent row stored (versions + ts). New `/terms` + `/privacy` pages (adapt
  CompCeiling drafts).
- **Not a substitute for legal review** — the Gilbertson Davis consult still
  gates actually charging. Real Helcim stays off until counsel clears.

### SEO/AI impact
Free Dashboard + a new public pricing page stay indexable. Gated pages become
auth-only. Update `llms.txt`/`robots.txt` so now-private endpoints aren't
advertised as open. Sitemap keeps only public routes.

## Build phases
1. **Account system:** D1 schema, `/api/auth/*`, session cookie + point-read,
   signup with legal gate, 14-day trial + anti-farming, `/api/auth/me`,
   frontend route-gating + upgrade/paywall page + pricing page. `MOCK_BILLING`.
2. **Data hardening:** private R2 bucket, `/api/data/:file` gate, screener-lite
   split, Pi push_dashboard R2 upload, frontend private-fetch path, llms/robots
   update.
3. **Helcim billing:** billing interface concrete impl vs live Helcim API,
   HelcimPay.js modal, recurring plan, webhook lifecycle, trial→paid upgrade.

## Non-goals (YAGNI for v1)
- No team/multi-seat accounts. No email verification loop (note: signup has no
  email verify — same as CompCeiling; admin is allow-listed). No password reset
  emails in phase 1 (add later). No US geo-block (Quebec only, per decision).

## Open risks
- **Legal:** selling trading signals = investment-advice exposure (OSC/Ontario).
  Gate real billing on counsel review. Same open risk as CompCeiling.
- **Helcim API drift:** verify against live docs; billing interface isolates it.
- **Repo-clobber history:** morning-briefing/hermes-scripts had a Mac rsync
  clobbering the Pi (now fixed); confirm before pipeline changes land.
