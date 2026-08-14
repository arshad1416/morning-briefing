# Fix report — 2026-08-14

Commit `5f3fc33` on `claude/morning-briefing-pipeline-audit-4dd5b5`. **Not pushed, not deployed.**

**Method.** 8 builders under exclusive file ownership, 11 fresh critics (2 lenses on the risky
scopes, 1 elsewhere). 19 agents, 0 errors. **10 fixes accepted, 1 rejected and reverted.**
Zero `overbuilt` flags.

---

## Verification gate — all green

| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | **0 problems** (was 1 warning) |
| `cloudflare-worker && npm test` | **78/78** across 14 files, incl. a new billing regression test |
| pi-scripts unittest (AGENTS.md set) | **51 OK** |
| `test_r2_sync_failure_split` | **7 OK** |
| `npm run build` | succeeds, 3,040 ticker pages, 22.5s |
| `out/` after 1,598 deletions | `_headers`, `privacy.html`, `terms.html`, `llms.txt`, `robots.txt`, `sitemap.xml`, `index.html` all present |
| `py_compile` / `bash -n` | clean |
| Max Pain on localhost | see below |

**Max Pain, proven in a real browser** (the headline defect):
```
live data: max_pain $746   spot $777.88   -> below spot by 4.098%
rendered : "↓ 4.1% below spot"                     (was "↑ … above spot")
marker   : left 29.5084%, bear-coloured, LEFT of the 50% spot marker
           50 + clamp(-4.098 × 5) = 29.51  ✓ exact
h1       : "Options Intelligence", h1count 1, now first in the outline
```

---

## Fixed in-repo

**User-visible**
- **Max Pain sign inversion** — `MaxPainCard.tsx:63`. Four token swaps. Live-wrong since 2026-07-22.
- **Max Pain marker** — was on the wrong side *and* contradicted its own line-99 comment. Now
  proportional to the gap and clamped, so it no longer looks like a scale while encoding a sign.
- **`/options/` had no `h1`** — the only route without one. Added, matching the sibling pattern byte
  for byte.
- **VerdictBar printed a default as a measurement** — guard moved from `recent_trades > 0` to `>= 5`,
  which is what the generator actually measures.
- **positions "% invested"** summed market value, not cost basis → relabelled "% in positions".
- **`glossary.gamma_regime`** attributed the regime to gross GEX, which the site says cannot produce
  it → now names signed dealer gamma.

**Security**
- **`frame-ancestors 'none'`** — there was no clickjacking protection at all. Critic verified the
  Helcim embed is unaffected: we are always the parent frame, so `frame-src` governs it.
- **HSTS** `max-age=15552000`, deliberately no `preload` (irreversible, your call) and no
  `includeSubDomains`.
- **Billing webhook** no longer defaults an unenumerated event type to `active`.

**Pipeline**
- `generate_prediction_accuracy.py` — both writes now atomic.
- `nope_calculator.save_snapshot` — dead code and the last non-atomic write, removed.
- `r2_sync.py` — skip-if-unchanged, plus a staleness guard so 28-day-old files stop being uploaded
  and served at 200 as if current. New test covers it.
- `deadman.yml` — widened from 2 files to the public payloads that had no watcher, per-file
  thresholds, weekend cadence accounted for.

**Cleanup — 1,598 files**
Dead legacy SPA tree (rule 3), 5 orphaned files, `volatility-history/raw_json`, `.gitignore data/audio`.
Root `_headers`/`privacy.html`/`terms.html` were stale duplicates of the live `public/` copies
differing by 71 lines. Root `_redirects` was the SPA fallback `/* → /index.html 200` — harmful if it
had ever shipped. Build proves nothing broke.

---

## Done in production

- **D1 migration 0005 applied.** Verified `chat_rate` was genuinely absent first, then applied, then
  proved the fix is live end-to-end: one real request → `chat_rate` has 1 row. **The rate limiter on
  the public LLM-billed endpoint now enforces**, and needed no Worker deploy — the code was already
  shipped, only the table was missing, so every INSERT threw into the fail-open catch.
- **`d1_migrations` ledger backfilled.** `db:migrate:remote` will no longer abort. The stale
  `0002_billing_sessions.sql` row was left in place deliberately — deleting ledger rows is riskier
  than one harmless extra.

---

## Pi deploy — APPLIED and verified (2026-08-14 ~11:00–11:27)

Ran from a staging dir (`MB=~/audit-fixes-2026-08-14`), so nothing was merged to main.

| Phase | Result |
|---|---|
| A — three repo-copy scripts | deployed, `diff` clean on all three; `import r2_sync` OK |
| B1 — ticker write-once guard | `written_now` in place |
| B2 — `generate_analysis` self-push | 0 remaining push calls (~118 builds/30d recovered) |
| B3 — IBKR exit codes | 0 `pipeline continues` left, 7 `return 2`; post-condition assert passed |
| C — crontab | **applied**, 197 lines before and after, 6 changed, backup `~/crontab.bak-2026-08-14` |

Six `.bak-2026-08-14` backups exist in `~/.hermes/scripts/`.

**Ticker freeze is FIXED AND LIVE.** Ran `publish_ticker_details.py` after today's screener
finished; it printed `synthesized SPY/QQQ/IWM/DIA from charts data` — the line that printed nothing
every run since 2026-07-13 — and published 3,015 files.
```
live: SPY 777.02  QQQ 730.92  IWM 304.61  DIA 537.12   (SPY was 749.17, frozen 32 days)
cross-check: the site's own GEX payload spot = 776.96  -> agrees to $0.06
```

**Crontab, applied.** Phase C did more than just the verdict move, correctly:
- `generate_verdict` 07:23 → **07:30** (10 min of slack after run_morning_analysis at 07:20; it had 3)
- `send_comprehensive_briefing` 07:28 → **07:37** — the email *reads* verdict.json, so moving verdict
  without moving the email would have made the email stale instead. Verified the email reads only
  latest/verdict/reddit-sentiment and carries no `--personal` flag, so being pushed past
  `council_trade_executor` (07:35) changes nothing in its content.
- IBKR cron line gained a `|| tg_notify.send_telegram(...)` guard — this crontab has no MAILTO, so
  a non-zero exit would otherwise mail nobody. B3 was necessary but not sufficient.
  Verified before applying: `tg_notify.send_telegram` imports cleanly and two existing cron lines
  already use the same pattern. `/bin/sh -n` and `ast.parse` both pass on the new line.

New morning chain: `07:20 analysis → 07:30 verdict → 07:37 email`.

## Resolved later the same day

Everything in this section was open when the report was first written and was closed before the day
ended. Kept, rather than deleted, because the sequence is the useful part.

**1. IBKR gateway — RESOLVED.** The original finding was that there was nothing to restart: nothing
on :5002, no systemd unit, no install directory, `ibkr_gateway.log` last written 2026-07-13. The
Client Portal Gateway is a Java app requiring an interactive browser login with 2FA, so it cannot be
started non-interactively. It was installed from IBKR's official artifact, configured to listen on
5002 (matching what the agent calls), **narrowed from the default `192.*` LAN allow-list to
loopback only**, and authenticated by the owner through an SSH tunnel. A systemd user unit now
supervises the process across reboots — it cannot renew an expired session, which is inherent.

Worth recording for anyone who wonders whether IBKR's newer Web API removes the interactive login:
per IBKR's own documentation, OAuth 1.0a / 2.0 sit under *Web API Access for Organizations*;
*Access for Individuals* is username-and-password, and third-party OAuth is a compliance process
IBKR estimates at 8–14 weeks requiring an established business entity. It does not help here.

**2. `_safe_float` — RESOLVED, and it was three bugs, not one.** With a live gateway the real cause
was visible: `/portfolio/{acct}/summary` returns all 70 keys **lower-cased**, each value wrapped in
`{amount, currency, …}`, while the agent asked in CamelCase — so every figure took the 0.0 default.
Two further fields (`MaintenanceMargin`, `CashBalance`) differ by *name*, not case. Account P&L is
absent from that endpoint entirely and now comes from the ledger, returning **null rather than 0.0**
so the UI renders an em-dash instead of a fabricated flat day.
Shipped as `pi-scripts/deploy-ibkr-safefloat-2026-08-14.sh`. Result: `Net Liq $0.00 → $40.38 CAD`,
`Buying Power $29.01`, `Unrealized −$222.05`, zero warnings, exit 0.

**3. Pi deploy script — RUN.** All phases verified afterwards: three repo-copy scripts deployed
byte-identical, ticker guard in place, zero remaining self-push calls, zero silent-exit branches
(7 now `return 2`), six `.bak-2026-08-14` backups. The crontab phase was applied with
`APPLY_CRONTAB=1`: verdict `07:23 → 07:30`, briefing `07:28 → 07:37` (it *reads* verdict, so moving
one without the other would have made the email stale instead), and a Telegram guard on the IBKR
line because this crontab has no `MAILTO` — the exit-code fix alone would still have reached nobody.

**4. Deadman secrets — SET** by the owner, verified registered under the exact names the workflow
reads. The monitor was also widened from 2 files to 9 with per-file thresholds, and a manual run
confirmed it passes against live URLs (`All fresh — pipeline alive`).

**5. Stale R2 objects — DELETED.** The new staleness guard stops *re-uploading* stale artifacts but
does not unpublish what is already in R2, so subscribers kept receiving 2026-07-17 content at
HTTP 200. The three `ibkr_*` objects were backed up (`~/r2-backup-2026-08-14/`, byte-identical to
the Pi's local copies) and removed: 85 → 82 objects, exactly the three intended, zero collateral.

**6. `/data/*` edge caching** still needs a Cloudflare **Cache Rule** — not `_headers`. See below.

---

## Rejected by a critic and reverted

I tried giving `/data/*` a 120s edge TTL. A critic refuted it using evidence from my own audit:
Cloudflare Pages **appends** matching rules rather than replacing them — proved by the live response
`cache-control: public, max-age=0, must-revalidate, public, max-age=0, must-revalidate`, which only
concatenation can produce. So the "fix" would have shipped `max-age=0` *and* `max-age=120` in one
header, with `stale-while-revalidate` inert under the inherited `must-revalidate`. Reverted; the
mechanism is now documented in `public/_headers` so the next person doesn't retry it.

## Deliberately deferred (not defects — design changes)

- **Session-JWT revocation** on logout/password change: new schema + a per-request denylist lookup +
  a migration. A feature, and it was scoped out before the fan-out rather than discovered mid-task.
- **`check:contracts` coverage** (4 of 11 payloads): authoring 7 new contract checks.

## Correction to the audit

Finding #7 (verdict staleness) said "every weekday". The morning cycle ran while this session was
open and **today's narrative is correct** (morning_analysis 07:21, verdict 07:23). Across four days:
08-11 distinct, 08-12 distinct, **08-13 identical to 08-12** (race fired), 08-14 correct.
It is an **intermittent race**, not a daily defect. The cron fix still closes it. MEDIUM → LOW-MEDIUM.

## Correction to this report: the Cloudflare build quota

**I was wrong, three times, and it drove a real decision.** I projected ~544–575 builds/month by
scaling 14 days linearly to 31 — which treats every remaining day as a weekday, over a window
(Aug 4–7: 37/32/28/22 vs a normal 23–24) inflated by this audit's own activity. On that basis the
market-hours publish cadence was halved from `7,37` to `7`, trading away half the data freshness.

Querying the Pages deployments API directly settled it: **256 builds Aug 1–14 across both projects,
projecting ~427** — the 500 cap was never at risk. The cadence change was reverted in full: crontab
restored byte-identical to its backup, and the five source files that depended on it, including two
staleness thresholds that would otherwise have flagged healthy data as stale most of every hour.

Three things are worth carrying forward, and are now in AGENTS.md rule 1:
- **Count builds as Pages deployments, never as commits.** 2026-08-14 was 22 commits but 17 builds.
- **The quota is per ACCOUNT**, shared with the `job-hunt-board` Pages project.
- `wrangler pages deployment list` truncates at 25 and cannot answer this; the API paginates with
  `page` (`per_page` caps at 25).

The `generate_analysis.py` self-push removal was deliberately **not** reverted — 118 pushes per 30
days that deploy nothing is waste at any quota, and it is independent of cadence.

## Verified after the fact

Responsive/mobile was listed here as untested, because Playwright's browsers were never installed
locally. They were installed and the suite run against post-revert `main` with a freshly built
`out/`: **59 passed, 37 skipped, 0 failed**, matching CI on PR #52 exactly. The 37 skips are
project-scoped by design. All eight 320px regression contracts pass on both Chromium and WebKit.

Nothing from this audit remains unverified.

## Where the work landed

- Frontend: PR #52, merged, live on maplegamma.com.
- Worker: deployed manually, version `217c407c-cf9b-423d-aefd-ca690589aa19`
  (previous `7f5f60ad-e448-44b1-91b0-6a2dbc32147b`, for rollback).
- Production D1, Pi scripts, crontab, gateway, R2: applied directly and verified.
- Narrative summary: `MapleGamma Remediation Log` artifact.
