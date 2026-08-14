# MapleGamma pipeline + site gauntlet audit — 2026-08-14

> **STATUS — read this first.** This is the point-in-time audit. Everything confirmed here was
> fixed the same day; see `FIXES-2026-08-14.md` for what shipped and how it was verified.
>
> **One finding below is WRONG and is retained only so the error is legible: finding #3, the
> Cloudflare build quota.** It claims builds are over the 500/month cap, from a 30-day commit count
> extrapolated linearly. That method is wrong twice over — it counts *commits* rather than
> *deployments* (several commits ride one push), and it scales a window inflated by this audit's own
> activity across a calendar that is not all weekdays. Measured directly against the Pages
> deployments API: **256 builds Aug 1–14 across both projects, projecting ~427.** The cap was never
> at risk. Count deployments, not commits, and remember the quota is per *account*.
>
> Two other items have moved on: finding #7 (verdict staleness) is an intermittent race, not a daily
> defect — see the correction at the end of this file; and responsive/mobile, listed here as
> unverified, has since been run in full (59 passed, 37 skipped, 0 failed).

Read-only. No source file was edited, nothing was committed, pushed, or deployed; no Pi state was
changed. **Verified, not asserted:** `git status --porcelain` is empty and HEAD is still
`6a7ad30ed` (unmoved). One deviation to disclose: my `npm install` in `e2e/` caused npm to drop a
`"license": "ISC"` line from `e2e/package-lock.json`. I restored it with `git checkout --`; the
tree now matches how I found it. (`origin/main` has advanced to `08ca793` on its own — that's the
Pi pushing during the audit, not me.)

**Method.** 6 investigators fanned out over exclusive subsystem scopes; 2 fresh adversarial
critics per finding, each with a distinct lens, prompted to refute and defaulting to refuted
when uncertain. Bar set up front: a finding ships CONFIRMED only if it carries a command that
was actually run and whose output proves it — everything else ships PLAUSIBLE.

**55 findings raised. Of the 42 that were actually judged, 25 were refuted (60%) and 17 survived.
The remaining 13 were never judged at all** — the session hit its rate limit and their critics
died mid-run. Those 13 (the entire efficiency scope, plus 2 label items) are reported separately
below and must not be read as having passed the bar. 119 agents, 7.7M tokens, 29 agent failures.

---

## Bottom line

The pipeline is **alive and running correctly end-to-end**. Data is generating, publishing,
gating, and rendering. Nothing is broken in the "site is down" sense.

But three things are wrong in a way a visitor can see, and one is an operational cliff:

1. **The Max Pain tile on `/options/` states the wrong direction.** Live, right now.
2. **`/ticker/SPY|QQQ|IWM|DIA` have been frozen at 2026-07-13 prices for 32 days** — a 3.8% error.
3. ~~**Pages builds are over the free-tier cap** (588 commits/30d vs a 500/month quota).~~
   **RETRACTED — see the status note at the top.** Measured 256 builds Aug 1–14, ~427 projected.
   The real finding underneath was smaller but genuine: one generator pushed to `main` on its own,
   ~118 builds/30d that deployed nothing. That was removed and kept.

---

## Verified working (negative evidence — I checked, it's correct)

| Check | Result |
|---|---|
| Gating consistency across all 4 required places (rule 5) | **Clean.** 25 files in `r2_sync.py` PRIVATE_FILES, 25 in `data_gate.js` (12 pro + 13 basic), all gitignored in *both* `data/` and `public/data/` forms, none tracked. Set-difference empty both directions. |
| Premium leak on the live surface | **None.** All 25 probed anonymously: `/data/<f>` → 404 (25/25), `/api/data/<f>` → 401 (25/25). Traversal guard works (`..%2F` → 400). |
| `r2_sync.py` repo copy vs live `~/.hermes/scripts/` (rule 5 caveat) | **Byte-identical.** |
| Crontab snapshot vs live `crontab -l` | Only drift is one unrelated line (`biman_seatwatch_pi.py`). |
| Rendered output across all 12 routes | Zero `NaN` / `undefined` / `Infinity` / "Failed to load"; all images have alt; no horizontal overflow. **Signed-out only** — gated tiles showed overlays, not data, so this covers the public surface, not the subscriber view. |
| `fetchGated` request path | Correct — `/api/data/${file}` only, no doomed Pages request. |
| Legal pages | `/privacy`, `/terms` → 200; `.html` and trailing-slash forms 308-redirect properly. |
| Next.js static assets | Correctly `max-age=31536000, immutable`, `cf-cache-status: HIT`. |
| deadman + CI workflows | Both currently green. |
| `npm run typecheck` | **Clean** (`tsc --noEmit`, no output). Glossary keys and schema types all resolve. |
| `npm run lint` | **0 errors, 1 warning** — unused `isNegative` in `DeltaBadge.tsx:14`. Inspected: not a bug, the negative case is the else branch. Cosmetic. |

83 further "checked and correct" items were logged by investigators.

---

## Confirmed defects, ranked by what a user actually sees

### 1. HIGH — Max Pain tile prints the inverted direction (live now)
`src/components/feature/options/MaxPainCard.tsx:63`

`maxPainAbove = distancePct > 0` is correct, but both display ternaries are swapped:

```
{maxPainAbove ? '↓' : maxPainBelow ? '↑' : '·'} … {maxPainAbove ? 'below' : maxPainBelow ? 'above' : 'at'} spot
```

Live payload this minute: `max_pain=750.0`, `spot=777.88` → max pain is **below** spot by 3.6%.
The tile renders **"↑ 3.6% above spot"**.

The marker bar is inverted the same way, and contradicts its own comment:
- line 99 comment: *"left of center if maxPain < spot, right if >"*
- line 109 code: `left: maxPain > spot ? '45%' : maxPain < spot ? '55%' : '50%'` — the opposite.

Shipped since 2026-07-22 (23 days) and present in the deployed bundle
`_next/static/chunks/app/options/page-*.js`. Visible to signed-out visitors too — the tile reads
public `maplegamma-data.json` and its gate is a cosmetic blur.

This is precisely the AGENTS.md rule-6 defect class ("max-pain labeled Max GEX Strike").

**Fix:** four token swaps on lines 63 and 109. Don't rename the variables — they're correct.
Leave the colour ternary alone; it's right.

### 2. HIGH — `/ticker/SPY|QQQ|IWM|DIA` frozen at 2026-07-13 for 32 days
```
SPY  as_of 2026-07-13T22:26:30  price 749.17     AAPL as_of 2026-08-13T14:45:01  price 302.39
QQQ  as_of 2026-07-13T22:26:30  price 711.74     NVDA as_of 2026-08-13T14:45:01  price 224.29
```
Real SPY per the site's own `maplegamma-data.json` in the same minute: **777.88**. A 3.8% error,
with no date shown on the page. RSI/SMA20/SMA50 there are equally 32 days old.

Cause: `~/.hermes/scripts/publish_ticker_details.py:114-117` synthesizes the core ETFs only when
absent from the tickers directory — but `have` is the *whole directory*, which already contains
the file a previous run wrote. Intent was "already covered **this run**".

**Fix:** accumulate `written_now` in the screener loop, test against that. One line.
Rule 4: this script exists **only** on the Pi — there is no repo copy, so it must be ported.

### 3. HIGH (risk, not a confirmed breach) — Pages build run-rate is at or past the free-tier cap
```
588 commits to origin/main, trailing 30d;  recent weekdays 23-24/day
wrangler pages deployment list  ->  25 deployments in the last ~24h, each mapped to a
                                    distinct commit  =>  ~1 build per commit CONFIRMED
run rate  ~24/weekday x 22 + weekends  ~=  540/month   vs the 500/month free-tier cap
```
**Important correction to the obvious reading:** builds are **succeeding right now** (most recent
26 minutes ago), so nothing is currently blocked. Either the account is not on the free tier, or
the cap is about to bite. I could not determine the plan from the CLI — **confirm it in the
Cloudflare dashboard.** I am reporting a run-rate risk, not a proven quota breach.

The waste underneath it is real at any quota, and is the cheapest lever:
`~/.hermes/scripts/generate_analysis.py` (~line 437) runs its **own** `git push origin main` one
minute before `push_dashboard` pushes anyway — **118 builds/30d that deploy nothing new**. Its own
comment already says push_dashboard's `git add -A` will pick the file up.
**Deleting that 3-line push block cuts ~24% of builds for zero freshness loss.**

### 4. MEDIUM — Chat rate limiter is fail-open in production
`chat_rate` does not exist in remote D1 (migration 0005 never applied), so every rate-limit INSERT
in `cloudflare-worker/src/chat.js:106` throws into a `catch { return false }` and
`RATE_LIMIT_PER_MIN=10` is never enforced. Local vitest passes because `test/helpers.js` creates
the table — the exact trap AGENTS.md warns about in the D1 row.

`POST …workers.dev/chat` is public, unauthenticated, and billed to `OPENROUTER_API_KEY`; the
hostname is discoverable from the CSP in `public/_headers`. Cost/abuse exposure, not a data leak.

**Fix:** apply that one file (`CREATE TABLE IF NOT EXISTS`, safe alone). Do **not** run
`npm run db:migrate:remote` — see #5.

### 5. MEDIUM — Prod `d1_migrations` ledger is out of sync; the documented migrate command aborts
Production records only `0001_init.sql` and `0002_billing_sessions.sql` — a filename that doesn't
exist in the repo (repo has `0002_billing.sql`). So `wrangler d1 migrations apply` treats 0002–0005
as unapplied and re-runs an `ADD COLUMN billing_interval` that already exists → abort before 0005.
This is the *mechanism* by which #4 stayed broken.

### 6. MEDIUM — IBKR data frozen 28 days, still served at HTTP 200
`ibkr_{account,positions,trades}.json` last written 2026-07-17. `ibkr_portfolio_agent.py`
(cron `12 7 * * 1-5`) has failed every weekday run since 2026-07-20 — the Client Portal gateway on
`localhost:5002` isn't running — and it **logs the error then exits 0**. `r2_sync` re-uploads the
stale files every publish, so subscribers get 28-day-old holdings at 200 with no staleness banner.
The last successful write also recorded `Net Liq: $0.00`.

**Fix:** (a) restart the gateway; (b) make the no-gateway branch exit non-zero so it can't recur silently.

### 7. MEDIUM — `verdict.json` publishes a previous day's narrative
`generate_verdict.py` (07:23) copies `morning_analysis.json`'s one-liner, but
`run_morning_analysis.py` (07:20) doesn't finish writing until ~07:25 — the LLM fallback chain
routinely exceeds the 3-minute gap assumed by the 2026-07-25 fix. On 2026-08-12 and 08-13 the live
site published a byte-identical narrative two days running, stamped with a fresh `generated_at`.

**Fix:** move the cron `23 7` → `35 7`. One number, still ahead of the 07:37 send.

### 8. MEDIUM — Dashboard shows a hardcoded default as a measured hit rate
`generate_verdict.py` only measures hit rate at `len(closed) >= 5`; below that it writes the
constant `0.5` while still writing the real `recent_trades`. `VerdictBar.tsx:96` guards on
`recent_trades > 0`, so 1–4 trades fall through and render **"Hit rate, last 1 paper trade: 50%"**.
One trade cannot be 50%. The component's own comment two lines above says it exists to stop exactly
this. **Fix:** change `> 0` to `>= 5` in the component (the 0.5 is a legitimate modelling default —
it just must never be displayed).

### 9. MEDIUM — Monitoring covers 2 of ~34 data files, and the alert channel is dead
`deadman.yml` watches only `maplegamma-data.json` and `crypto-cohorts.json` (public, 26h). **No
monitor watches any R2/premium file** — which is exactly why #6 sat unnoticed for 28 days.
`gh secret list` is **empty**, so the Telegram step (`if: failure() && env.TG_TOKEN != ''`) never
fires; failures produce only GitHub's implicit email. The file's own comment documents this from the
2026-07-30 outage: *"correctly reported … every 30 minutes for 4.5 days. Nobody saw it."*

Also measured: deadman's `*/30` schedule actually runs at a ~61-minute median on GitHub's scheduler,
and `check:contracts` validates 4 of the 11 payloads the frontend zod-parses.

**Fix, in keeping:** add the premium URLs to deadman's existing list and set the two repo secrets.
Extending the existing monitor beats building a new one.

### Lower severity (confirmed)
- `glossary.gamma_regime` names the one quantity the site says cannot produce it.
- Portfolio tile's "Invested" caption says cost basis; the code uses market value.
- Max Pain key-levels bar looks like a scale but encodes only a sign (constant ±5% offset).
- Premarket Scanner tile has had no producer since 2026-05-29 — empty for 25+ publishes.
- 48 live archive pages present May-29 prices as that morning's premarket scan.
- 24 orphaned ticker pages serve prices up to 34 days old (no prune step).
- `journal.json`, `walk_forward.json`, `council_history.json` are gate-registered but have no
  producer anywhere — dead registrations (no frontend consumer, so no broken tile).
- Logout/password change cannot revoke a leaked session JWT for 30 days.
- `ROUTE_TIER` is a dead export.
- Billing webhook defaults unrecognised event types to `status='active'` *(PLAUSIBLE)*.

---

## Efficiency & enhancements

> **Honesty flag:** the session hit its rate limit mid-run, so all 11 efficiency findings lost
> their critics and were dropped **unjudged — not refuted**. I personally re-ran the evidence for
> the ones marked ✅ below; those now meet the bar. The ones marked ⚠️ are the investigator's raw
> output, uncorroborated — treat as leads, not conclusions.

### ✅ Verified by me — these meet the bar

- **Build waste (#3 above).** ~1 build per commit confirmed via `wrangler pages deployment list`.
  The 3-line delete in `generate_analysis.py` removes 118 no-op builds/30d.
- **`data/` ↔ `public/data/` duplication: 3,151 byte-identical pairs, 11.5 MB.** Every single file
  is duplicated; zero differ.
- **Root config/content files are dead but look live.** Only `public/` is copied into the export.
  The live CSP matches `public/_headers` (it has `font-src 'self'`); root `_headers` omits it and
  still carries `/assets/*` rules for the dead SPA. Root `privacy.html`/`terms.html` differ from the
  live `public/` copies by **71 lines each**. **Editing the root copy — the obvious place to look —
  changes nothing on the live site.** For legal pages that is a genuine trap. Root legacy tree: 1.2 MB.
- **`getTickerCoverage()` has no memoization** — `src/lib/seo/ticker-coverage.ts:18` `readdirSync`s
  and parses all 3,040 ticker files on every call, 5 call sites, 215 ms/call measured.
  **One line:** `return (cached ??= build())`.
- **`data/audio/` is committed twice** — 11 tracked MP3s / 8.1 MB in each of `data/audio` and
  `public/data/audio`. Only `public/data/audio` is served (`research-client.tsx:423`). MP3s don't
  delta-compress, so this grows forever. **One line** in `.gitignore`.
- **`volatility-history/raw_json`: 1,542 tracked files, 12 MB**, regenerable output, committed once
  in July 2026, referenced by nothing that runs.
- **`/data/*.json` has zero edge caching** — served `cache-control: public, max-age=0,
  must-revalidate, public, max-age=0, must-revalidate` (the value is literally duplicated) with
  `cf-cache-status: DYNAMIC`, on files that change every 30 minutes. A
  `max-age=120, stale-while-revalidate=600` sits safely under the publish cadence.
- **Five orphaned files, zero references** — `fable5-redesign.html` (32K),
  `fable5-redesign-v2.html` (36K), `prebatch-snapshot-fix.patch`, `test_entry_recheck.py`,
  `pi-scripts/generate-screener-data.py.bak-2026-07-07`.
- **Six premium files** are generated, R2-uploaded and gate-registered every cycle but fetched by
  nothing. *Leave them* unless a UI is planned — CI enforces all four registration places together.
- **No `Strict-Transport-Security`.** HTTP→HTTPS 301 works, but a first-visit downgrade is open.
- **No clickjacking protection.** CSP has `frame-src` (what the page may embed) but no
  `frame-ancestors`, and there is no `X-Frame-Options` — on a site with login and Helcim billing.
  One line in `public/_headers`.

### ⚠️ Unverified leads (critics died — corroborate before acting)

- `publish_ticker_details` runs 25–50 min *before* the 10:30 screener it reads finishes, rewriting
  6,028 files of which 6,028 differ by exactly one line (`generated_at`). A skip-if-unchanged guard
  would remove the churn. *(This is also the script behind confirmed finding #2.)*
- `r2_sync` re-uploads all 82 artifacts unconditionally every run — 10.7 MB × 24 runs/weekday, of
  which 7.7 MB (the charts) changes once daily. An mtime sidecar cuts ~95% of bytes.
- Build time doubled 57s → 109s as the ticker universe grew (3,040 static pages per build).
- 9 Pi scripts that write published data have **no repo copy** — unreviewable, untested, outside CI.
  This is the rule-4 systemic issue `PIPELINE-AUDIT-2026-08-04.md` already named.
- The `.git` size figure (82 MB) could not be checked from this worktree (`.git` here is a 4 KB
  gitdir pointer); verify in the main clone.

---

## Limitations — what this audit did *not* establish

- **No live morning cycle was observed.** It ran 00:25–01:10 Friday; the 06:30–07:28 jobs had not
  fired. All morning-cycle evidence is Thursday 2026-08-13 plus logs.
- **The efficiency scope and the whole round-2 completeness sweep went unjudged** (session limit).
  Three sweep angles never ran at all: end-to-end value tracing, weekend/holiday and DST behaviour,
  and the severity/honesty self-audit.
- **Responsive / mobile is genuinely unchecked.** Playwright never ran (browser binaries absent
  locally), and my own 320px probe gave unreliable signal and was discarded. AGENTS.md's 14-route
  responsive contract (`e2e/tests/responsive-layout.spec.js`) went unverified in this audit.
- **The subscriber-side view was never rendered** — everything browser-based was signed out.
- Pre-existing stash `stash@{0}` on branch `codex/research-analysis-detail-modals` is labelled
  `max-pain-work-WIP` — there may already be in-flight work touching confirmed finding #1. Check
  before starting a fix.
- Production D1 findings (#4, #5) rest on the investigator's remote queries; I did not re-run them.
- `npm run lint` / `typecheck` were assigned to a sweep agent that died — **I ran them myself
  afterwards; both clean** (see the verified-working table).
