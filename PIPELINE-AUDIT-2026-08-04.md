# Morning-briefing pipeline audit — 2026-08-04

> **STATUS: RESOLVED — verified end to end.** Data flowing, tiles rendering, gate closed,
> and four new guards in place. Full verification and the guard inventory are in
> "Closing the loop" at the end of this document.
>
> *(Historical status during the work, kept for the record:)*
> **STATUS: half shipped.**
> **Data is flowing again (deployed).** The publish pipeline was restored at 12:49 ET on
> 2026-08-04 (commit `bd212af9`, the first `Live portfolio` commit since 2026-07-30 15:37);
> all public JSON now carries today's date. Fixes 1 and 2 are live on the Pi, verified by real runs.
> **The blank tiles are NOT yet fixed on the live site.** Fixes 3 and 4 are frontend changes on
> this branch — `INDICES`, `VIX / REGIME` and the ticker tape stay blank on maplegamma.com until
> it is merged to `main`. That is the thing originally reported as "not loading".

**Verdict: the site was not down. It was frozen.** Every route returns HTTP 200 and every public
JSON file is served correctly — they just all contain data from **2026-07-30 15:37**, five days
stale. The Pi is healthy (up 7 days), cron is intact, and the pipeline runs to completion every
30 minutes. It then throws the entire publish away on the last step.

---

## Root cause

A one-line fix that was written, reviewed, tested and committed on **2026-07-22** was never
deployed to the machine that actually runs the code.

### The chain

1. **2026-07-22** — commit [`79686e62`](https://github.com/arshad1416/morning-briefing/commit/79686e62)
   *"fix(models): emit valid accuracy JSON (#20)"* fixed `compute_expectancy()` so that
   `profit_factor` is JSON `null` rather than `float('inf')` when a strategy has zero losing
   trades. It shipped four files: the generator, a regression test, the zod schema, and the
   React component.

2. **The frontend half shipped. The Pi half did not.** `src/` deploys by merging to `main`
   (Pages auto-builds), so the schema and component changes went live. But `pi-scripts/` is a
   version-controlled *copy* — the live script runs from `~/.hermes/scripts/` on the Pi, which
   is a different repo (`arshad1416/hermes-scripts`). This is exactly the trap AGENTS.md rule 4
   warns about. Nobody ported it:

   ```
   14e34a4d3ff4b1c1c6afa264fb1b6233  ~/.hermes/scripts/generate_prediction_accuracy.py   ← runs
   f7c5f66442c11a8ad14ef2f9ce3c75f2  ~/morning-briefing/pi-scripts/generate_...py        ← fixed
   ```

   Live copy, line 112 — still the pre-fix code:
   ```python
   "profit_factor": round(abs(sum(wins) / sum(losses)), 2) if losses and sum(losses) != 0 else float('inf'),
   ```

3. **It stayed harmless for 8 days.** The bad branch only fires when there are *zero* losing
   trades, and there was always at least one loser.

4. **2026-07-30 ~15:37** — the paper book reached `1 closed trade, a winner, zero losses`
   (`win_rate: 100.0`, `loss_rate: 0.0`, `avg_loss_pct: 0`). The `else` branch fired.
   `json.dump()` at line 285 uses the default `allow_nan=True`, so it wrote the bare token
   `Infinity` — valid Python, **invalid strict JSON**, unparseable by `JSON.parse`.

5. **The fail-closed gate caught it, and took the whole site with it.**
   `r2_sync.py:109` validates every private artifact before upload:
   ```
   R2 validation failed accuracy.json: accuracy.json contains invalid JSON constant Infinity
   R2 sync: 81 uploaded, 1 skipped
   ```
   `push_dashboard.py:712` then refuses to continue:
   ```
   RuntimeError: R2 sync skipped 1 private artifact(s)
   RuntimeError: Private R2 sync failed; refusing to publish Pages data
   ```
   The process dies here — **before** the `data/` → `public/data/` rsync and before
   `git commit -m "Live portfolio {ts}"` at line 771. So nothing publishes.

### Why it looks like "things aren't loading"

The pipeline is doing all its work and discarding it. Every 30 minutes the log shows the run
succeeding right up to the gate — `GEX published`, `latest.json generated`, `briefing_archive:
upserted 2026-08-04`, `81 uploaded` — then the RuntimeError. Meanwhile:

- **Public data** (`public/data/*`, served by Pages) is frozen at 2026-07-30.
- **Premium data** in R2 *is* current — 81 files upload before the raise — so paying
  subscribers see fresher data than the free dashboard. An odd inversion worth knowing.
- **`data/analysis.json` alone keeps moving.** A separate job, `generate_analysis.py`, commits
  it directly ("Analysis 2026-08-04 10:26" commits). But it only writes `data/`, never
  `public/data/` — and only `public/` is copied into the static export. So the one file still
  updating is the one file that goes nowhere. `data/analysis.json` and
  `public/data/analysis.json` have silently diverged (12,428 B vs 13,869 B).
- **No new archive dates.** `archive-index.json` stops at 2026-07-30, and because the export
  uses `generateStaticParams` with `dynamicParams=false`, `/archive/2026-07-31/` … `/08-04/`
  were never built as pages.

### Alerting did fire — nobody was listening

`deadman.yml` has failed on **every scheduled run since at least 2026-08-03** (15+ consecutive
failures). Detection works; the signal went unread for five days. Separately, CI has not run
since 2026-07-27 — the Pi's data commits are path-ignored by design, so a frozen pipeline
produces no CI signal either.

---

## The fix

Port the already-reviewed one-liner to the Pi. Verified against the real file and the real
validator on the Pi before proposing:

```
CURRENT live file            -> BLOCKED: accuracy.json contains invalid JSON constant Infinity
SAME file, Infinity->null    -> PASSES  (publish would proceed)
```

`pi-scripts/deploy-accuracy-infinity-fix.sh` applies it — idempotent, backs up, `py_compile`
-verifies, reverts on failure, then regenerates and re-validates `accuracy.json`:

```bash
bash ~/morning-briefing/pi-scripts/deploy-accuracy-infinity-fix.sh
```

It makes two changes:

1. **`float('inf')` → `None`** — the actual fix, identical to what `pi-scripts/` has had since
   2026-07-22. No frontend change needed: `market.ts:344` is already
   `z.number().nullable().default(null)` and `AccuracyStats.tsx:53` already renders `—` for null.

2. **`json.dump(..., allow_nan=False)`** — hardening. The shared helper
   `pipeline_runtime.atomic_write_json()` already passes `allow_nan=False`; this generator
   bypasses it and so lost that protection. With this, any future non-finite value fails
   loudly at 09:35 in the accuracy job's own log, instead of silently poisoning the publish
   30 minutes later. Applied to the repo copy in this branch too, so the two stay in sync.

The next scheduled `push_dashboard.py` run will unfreeze the site; `cd ~/.hermes/scripts &&
python3 push_dashboard.py` forces it immediately.

---

## Fix 2 — the inverted blast radius (deployed)

**A defect in one *premium* artifact blocked all *public* publishing.** `accuracy.json` is a
Pro-tier file the free dashboard never touches, yet a bad value in it froze the homepage, the
screener, the research page and the archive for five days.

AGENTS.md rule 5 makes premium data deliberately fail-closed, and that is right — a premium
file must never leak onto Pages. But "don't leak this file" and "don't publish anything at all"
are different guarantees, and the code conflated them. Crucially, **the no-leak guarantee never
depended on the R2 sync succeeding**: it is the `rsync --exclude` list built from
`PRIVATE_FILES` at `push_dashboard.py:745-752`, which is unaffected.

`r2_sync.py` lumped two unrelated outcomes into one `skipped` counter. Now split:

| outcome | meaning | publish behaviour |
|---|---|---|
| `invalid` | artifact rejected for **bad data** | skip that one file (its previous R2 copy keeps serving), publish everything else, alert on Telegram |
| `failed` | **transport / credentials** — R2 itself unhealthy | still abort, as before |

Deployed via `pi-scripts/deploy-r2-failure-split.sh` and verified with a live run:

```
R2 sync: 82 uploaded, 0 invalid, 0 failed
```

Alerting reuses `tg_notify.send_telegram`, already used by 8 other Pi cron jobs including
`cron_watchdog.py`. It fires on every run while a file stays invalid (~13/day in market hours) —
deliberately noisy, since silence is what cost five days. A `ponytail:` comment marks the
dedupe upgrade path if that noise ever becomes the reason someone mutes the channel.

**A latent bug found while making this change:** the no-credentials early return was
`return (0, 0)` — zero skipped — so if the R2 credentials ever went missing, `push_dashboard.py`
would have published public data happily while *silently never uploading any premium file at
all*. That path now reports a hard failure and aborts. Covered by
`test_r2_sync_failure_split.py::test_missing_credentials_is_a_hard_failure`.

### Regression test

`pi-scripts/test_r2_sync_failure_split.py` — 4 tests, runs anywhere (boto3/botocore/pydantic
stubbed, no Pi venv needed):

```bash
cd pi-scripts && python3 -m unittest test_r2_sync_failure_split -v
```

It reproduces the outage directly: one artifact containing `Infinity` alongside two good ones
yields `2 uploaded, 1 invalid, 0 failed` — the bad file skipped, the rest published.

---

## Fix 3 — the tiles that genuinely were not loading (separate bug)

Once the data was fresh I opened the dashboard, and **`INDICES`, `VIX / REGIME` and the ticker
tape were still stuck on skeleton loaders**. That is a second, independent bug — and it is the
literal match for "a lot of things are not loading". It was never about staleness.

`latest.json` is fetched through `fetchJson`, which calls `schema.parse()` — zod's *throwing*
parser, with no `safeParse` and no catch (`src/lib/api/index.ts:6-11`). `LatestDataSchema`
required `premarket_top_setups`. The live file does not have it:

```
BEFORE (required):    FAIL -> premarket_top_setups: Required
AFTER  (.default([])): PASS   indices: 6 | vix: 16.18 | setups: []
```

`generate_latest.py:150-152` only sets that key when `premarket_scan.json` is fresher than
`UPSTREAM_MAX_AGE_H` — so it is legitimately absent for most of the day. **It has never been
present in any of the last 25 published versions of `latest.json`.** One rejected field killed
the entire `latestQuery`, and with it every component bound to it:

`TickerTape` · `IndicesCard` · `VixRegimeCard` · `NewsFeed` · `ActionQueue`

Every one of those consumers already treats the field as optional (`?? []`) — the schema was the
only thing that disagreed. Fixed in `src/lib/schemas/market.ts` with `.default([])`.

Verified three ways, not just by parsing:
- **The schema sweep is clean.** Every live public payload was checked against its own schema
  (`latest.json`/`LatestDataSchema`, `verdict.json`/`VerdictSchema`,
  `maplegamma-data.json`/`GexDataSchema`, `screener-lite.json`/`ScreenerDataSchema`) — all pass.
  `latest.json` was the only one broken; this class of bug is not lurking elsewhere.
- **The tiles actually render.** Against this worktree's 2026-07-30 `latest.json`, which also
  lacks the field, `npm run dev` now paints real numbers where there were skeletons: ticker tape
  (DOW 52,213 / NASDAQ 25,122 / VIX 17.56), `INDICES` (S&P 500 7,439 +1.68%) and `VIX / REGIME`
  (17.56 ▼ −15.00%, NEUTRAL). No console errors.
- `typecheck`, `lint`, `build` (1767 pages) and the e2e chromium suite (14 passed, incl. all of
  `gating.spec.js`) pass.

**This one is not deployed** — it is a frontend change, so it ships by merging to `main`.
The archive pages are unaffected either way: `archive/[date]/page.tsx:178` reads the field
through the `Any` passthrough and never touches `LatestDataSchema`.

---

## Fix 4 — "∞" for a profit factor that is actually undefined

Deploying Fix 1 changed `profit_factor` from `Infinity` to `null`, and
`predictions-client.tsx:186` and `:202` rendered any non-number as **`∞`** — claiming infinite
profitability off a single winning trade, and painting it `--color-caution` at the same time
(`null >= 1.5` is false). It also fires with *zero* closed trades, where `∞` is simply false.

Changed both to `—`, matching `AccuracyStats.tsx:53` and `positions-client.tsx:420`, which
already handle exactly this null. This is the AGENTS.md rule 6 failure mode — a label describing
something the value does not mean — and it would have shipped *with* the outage fix.

---

## The systemic problem: `pi-scripts/` fixes are not reaching the Pi

This outage was not a coding mistake. The fix existed, tested and reviewed, for eight days. It
never got deployed. **And it is not the only one.** Diffing the live Pi scripts against this
repo turned up more work that was merged but never ported:

| file | in repo, NOT on the Pi | from |
|---|---|---|
| `push_dashboard.py` | `flock` concurrency guard — without it a slow run still overlaps the next cron fire, and concurrent git operations abort both | `2b6a5576` (2026-07-26) |
| `push_dashboard.py` | `atomic_write_json` import (partial-file protection) | `2b6a5576` (2026-07-26) |
| `r2_sync.py` | `universes_scanned` / `universe_sources` in the screener teaser — without them the public preview cannot describe its own scan coverage honestly (an AGENTS.md rule 6 problem) | 2026-07-26 screener work |
| `generate_prediction_accuracy.py` | the `Infinity` fix — **this outage** | `79686e62` (2026-07-22) |
| `push_dashboard.py` | the `_run_step` timeout guard — **added by this audit**, repo-only | this branch |

I deployed only the two fixes that were approved. Every row above is still undeployed and is
your call — flagging them because the same gap that caused this outage is still open, and the
last row means this audit has now added to it rather than closed it.

**The gap is mechanical and cheap to close.** `cron_watchdog.py` already runs every 30 minutes
and already uses `tg_notify`. A checksum comparison of `pi-scripts/*.py` against
`~/.hermes/scripts/*.py` inside it would have caught all four of these the day they were merged.

---

## Remaining confirmed findings (not fixed)

A 35-agent adversarial sweep raised 30 candidate defects; 21 were refuted on inspection, 9
survived. Four of those are the ones fixed above. The rest, in priority order:

**1. `push_dashboard.py` — five unguarded sub-script timeouts (high).** Lines 678/689/699/709/718
ran `subprocess.run(..., timeout=N)` with no `except subprocess.TimeoutExpired`, and nothing
between them and the git commit catches it. **This has already fired twice in production** —
`push_gex.py` timed out after 120s and killed the publish, the exact silent-freeze shape as the
main outage. Each block already tolerated a non-zero exit code, so "warn and carry on" was
always the intent; a timeout just was not covered.
*Fixed in the repo copy* — five duplicated blocks collapsed into one `_run_step()` helper
(−35/+52 lines), with `test_run_step_timeout.py` covering the timeout, non-zero-exit, missing-script
and success paths. **Not deployed to the Pi** — it is the highest-value thing left.

**2. `trade_outcome_logger.py:91` on the Pi — `save_json` omits `allow_nan=False` (medium).**
It re-implements `atomic_write_json`'s tmp+`os.replace` dance but drops the one keyword that
matters, and `load_json` at :80 omits `parse_constant`. It copies unconstrained LLM numbers out
of `maplegamma_analysis.json` verbatim. The reason this is worse than the outage: `trade_outcomes.json`
is **append-only**, and lines 275-307 round-trip every prior entry — so one transient bad council
value would freeze publishing *permanently*, on every subsequent day, long after the source is
clean. `maplegamma_council.py` `_write_output` has the identical gap one hop upstream. Pi-only,
no repo copy.

**3. `research-client.tsx:410` — audio briefing card captions today's date without checking the
file exists (high).** `preload="none"` means no request is made on mount, so the `onError`
fallback never fires; the card advertises an audio briefing for a date that may have none.
Another rule 6 label problem.

**4. `publish_policy.py:24-29` — premium exclusion is prefix-blind (low).** `pages_excludes()`
matches only the flat filenames in `PRIVATE_FILES`; `data_gate.js:14` gates a `charts/` *prefix*
that has no `PRIVATE_FILES` counterpart. Not a live leak — `charts/` is not currently written
into `data/` — but the guard would not stop one.

## Why it keeps breaking

The honest headline first: **publishing itself is not flaky.** Over the 36 weekdays from
2026-06-16 to 2026-08-04 the pipeline published its normal ~15 times/day on 33 of them. The only
zero-publish days are 07-31, 08-03 and 08-04 — this one outage. Earlier gaps in the git history
are pre-repo, not downtime.

So the question isn't "why does it break so often". It's **why does breakage go unseen for days,
and why does each fix not prevent the next one.** Three structural causes, each provable.

### 1. Nothing checks the user-visible outcome

Three independent monitors exist. Not one of them asks "is the published site correct?"

**`cron_watchdog.py`** — runs every 30 min, alerts to Telegram, is where the operator actually
looks. It contains **zero** references to `public/data`, `git`, or `maplegamma.com`:

```
public/data : 0     git log : 0     maplegamma.com : 0     urlopen : 0
```

Every path it reads under the repo is `morning-briefing/data/…` — the *pre-publish staging
directory*. During the outage those files were rewritten every 30 minutes (push_dashboard does
all its work before dying at the R2 gate), so its checks kept passing. Confirmed: on the Pi,
`data/prediction-engine.json` and `data/simulation.json` — the two files check #3 monitors — are
current, while the site served 5-day-old data. **The watchdog cannot detect this failure class.
Not "didn't" — structurally cannot.**

This is the *same* `data/` vs `public/data/` confusion that let `analysis.json` diverge, and that
makes `generate_analysis.py`'s output never reach the site. One conceptual error, three symptoms.

**`deadman.yml`** — the only check that measures reality, and it worked flawlessly:

```
PRIMARY: …/maplegamma-data.json age=114.2h (limit 26.0h)
PRIMARY data is 114.2h old (limit 26.0h) — Pi pipeline may be DOWN
```

It had been failing every 30 minutes for 4.5 days. But it has **no notification step** — no
Telegram, no email action. It relies entirely on GitHub's implicit "scheduled workflow failed"
mail, which goes to the workflow file's last committer subject to their Actions notification
settings. Meanwhile 8+ scripts in this fleet alert through `tg_notify.send_telegram`. *The
monitor that reaches a human watches the wrong thing; the monitor that watches the right thing
reaches nobody.*

**Nothing validates that the frontend can parse what was published.** This is the strongest
evidence and it reframes the whole question: `premarket_top_setups` was missing from **all 25**
published versions of `latest.json`, silently killing five components, with zero alerts from any
system. That wasn't intermittent breakage — it was *continuously broken and invisible*.

### 2. The monitoring is retrospective, so it never generalises

`check_pipeline_freshness()` opens with: *"Tripwires added after the 2026-07-13 audit. Each guards
a failure class that broke silently."* All nine checks are bespoke guards against one specific
past incident each, with dated comments (`added 2026-07-25`, ×2). They check cron *ordering*,
input mtimes, and log strings.

The pattern is: something breaks → a tripwire is added for exactly that → the next failure is a
different shape and passes straight through. Nine incidents produced nine narrow checks and no
general one. During this outage the watchdog did eventually fire — but it said
`prediction-chain: accuracy.json not regenerated today`, an *ordering* complaint about the very
file that was broken. The operator was told about cron sequencing, not that the site was frozen.

### 3. Fixes are written but not deployed

`pi-scripts/` is version-controlled; cron runs `~/.hermes/scripts/`. Porting is manual. At the
start of this session, **7 of the 13 shared scripts differed from the repo** — 54%:

```
fetch_alternative_data.py   fetch_earnings.py      fetch_sec_filings.py
generate_prediction_accuracy.py   generate-screener-data.py
push_dashboard.py           r2_sync.py
```

(Verified against the Pi's pre-session backups, so this is not an artefact of my own edits.)
The fix for this outage sat correct, tested and merged in git for **eight days** while the
broken copy ran. There is no deploy step, no verification, and no alert on drift.

Compounding it: five audits in three weeks (2026-07-13, 07-22 ×2, 07-27, and this one), and
`DATA-BUGS-2026-07-22.md` logged 58 bugs in a single pass. **The system produces findings faster
than it produces deployed fixes** — which is why a sixth audit is not the answer.

### The three checks that close all three causes — IMPLEMENTED

Three questions about whether the thing actually worked, replacing nine retrospective tripwires
about how it failed last time. They landed in two places, because one of them cannot be answered
honestly on the Pi.

**1 + 3 → `~/.hermes/scripts/cron_watchdog.py`** (deployed, backup
`cron_watchdog.py.bak-2026-08-04-132541`)

- `check_publish_freshness()` — time since the last `Live portfolio` commit, which is the only
  signal that the *whole* chain (R2 sync → rsync → commit → push) completed. 90 minutes during
  market hours (cron publishes at :07/:37, so that is three consecutive misses), falling back to
  a 26h floor overnight and at weekends. It uses the existing `market_calendar.session_bounds`,
  so market holidays and the 09:30 open boundary cannot produce false alarms.
- `check_script_drift()` — md5 of `pi-scripts/*.py` against the `~/.hermes/scripts/` copies cron
  actually runs. Files absent from the live dir are skipped as repo-only by design.

**2 → `.github/workflows/deadman.yml` + `scripts/check-published-contracts.mts`** (on this
branch, ships by merging)

The Pi cannot answer "can the frontend parse this?" faithfully — the contracts are zod in
TypeScript, and re-stating them in Python would drift and give false confidence, which is the
same mistake as the nine bespoke tripwires. So it runs where the real schemas already live:
deadman imports `LatestDataSchema`, `VerdictSchema`, `GexDataSchema` and `ScreenerDataSchema`
directly and runs them against the **live origin** — which also covers anything Cloudflare serves
differently from the Pi's local copy. Freshness and contract now fail independently
(`if: always()`), because a stale site must not mask an unparseable one.

`deadman.yml` also gained the Telegram step it never had. Its detection was always perfect — it
reported `114.2h old — Pi pipeline may be DOWN` every 30 minutes for 4.5 days. The step is inert
until `TELEGRAM_BOT_TOKEN` and `TELEGRAM_HOME_CHANNEL` are added as repo secrets (the repo
currently has none); the checks fail the run either way.

**Verification**

- 9 unit tests on the Pi against a real trading session, including
  `test_the_actual_outage_would_have_fired` (114h gap) and the two false-alarm guards that matter
  (09:45 just-after-open, and weekends where `session_bounds` returns `None`). All pass.
- `cron_watchdog.py --dry-run` on the Pi: publish check silent (correct — published 40 min
  earlier), drift check correctly reports the 7 stale scripts by name.
- The contract checker was tested in both directions: it passes against all four live payloads,
  and with `market_summary.indices` removed it fails with `market_summary.indices: Required` and
  **exit 1** (a check that cannot fail is not a check).
- `tsconfig.json` now includes `**/*.mts`, so the new script is type-checked rather than silently
  skipped. `typecheck`, `lint` and `build` pass.

**Two caveats, both mine to flag:**

- The drift check will report 7 stale scripts on its first run and stay quiet after — the
  watchdog only sends when the problem *set* changes, so this is one message, not a stream.
- `--dry-run` also surfaced `prediction-chain: accuracy.json written 12:48:14, at/after the 09:40
  engine run`. That is a false positive I caused by regenerating `accuracy.json` by hand during
  the fix, outside its 09:35 slot. It clears itself at tomorrow's scheduled run.

## What is left for you

1. ~~Unfreeze the site~~ — **done**, verified live.
2. ~~Stop one premium file freezing everything~~ — **done**, verified live.
3. ~~Give the watchdog checks that see the output~~ — **done**, deployed and tested.
4. ~~Commit the Pi's live changes~~ — **done**: `4932c43` in `arshad1416/hermes-scripts`, the
   four files only. (`sync_to_dashboard.py` and `carfii_auto_fill/` are also dirty there —
   pre-existing, unrelated job-hunt work, deliberately left alone.)

   **Pushed** — `f152d74..4932c43`, `origin/main` on `arshad1416/hermes-scripts`. The Pi is now
   0 ahead / 0 behind, so `sync-skills.sh`'s 20-minute `git pull --ff-only origin main` cannot
   diverge (re-tested after the push: exit 0). Had the commit been left local, that sync would
   have started failing silently the moment anything was pushed from another machine.
5. **Add `TELEGRAM_BOT_TOKEN` + `TELEGRAM_HOME_CHANNEL` as repo secrets** so deadman can actually
   reach you. The repo has no secrets today, so the notify step is inert.
6. **Decide on the four undeployed changes** in the table above (flock guard, atomic writes,
   screener universe fields, and the `_run_step` timeout guard from this audit). The new drift
   check will now nag about exactly these.
5. **`data/analysis.json` vs `public/data/analysis.json` — checked, benign.** The two have
   diverged (12,428 B vs 13,869 B) but the shape has *not* drifted: identical top-level keys
   (`analysis_ideas`, `date`, `generated_at`, `market_overview`, `options_flow`), identical
   types, size difference is just content volume. It is also consumed untyped —
   `research-client.tsx:1046` uses `usePublic<Any>('analysis', '/data/analysis.json')` with no
   zod schema — so there is no validation risk when publish resumes. The next successful rsync
   reconciles the two. No action needed; noted so it is not mistaken for a second bug.


---

# Closing the loop (end of session)

## Everything verified working

| what | evidence |
|---|---|
| Publishing | back on its ~30-min cadence; `Live portfolio 2026-08-04 15:37` |
| Public data | all 7 files dated 2026-08-04, newest 15:32 |
| Dashboard tiles | ticker tape, `INDICES` (S&P 7,750 +1.97%), `VIX / REGIME` (16.47) all rendering, "8m ago" |
| Contracts | all 4 live payloads parse against the site's real zod schemas |
| Gate | `/data/sec/*` 404 on Pages **and** raw.githubusercontent; `/api/data/sec_filings.json` still 401 |
| Watchdog | publish freshness, script drift, published surface — all CLEAN |
| Deadman | green |
| Deploy gap | **7 stale scripts → 0** |
| CI | green on `main` |

## The nine defects found

1. `profit_factor: Infinity` froze all publishing for five days — the fix had been merged for
   eight days but never ported to the Pi.
2. A Pro-tier artifact failing validation fail-closed **all public** publishing.
3. `r2_sync`'s no-credentials path returned `(0, 0)` — missing R2 creds would have published
   public data while silently uploading no premium file at all.
4. `LatestDataSchema` required a field the generator never emits, killing five components
   continuously — invisible, and unrelated to the outage.
5. `predictions-client` rendered a null profit factor as `∞` — "infinitely profitable" off one trade.
6. Five `subprocess.run(timeout=)` calls with no handler; `push_gex` had already frozen the
   publish twice this way.
7. **SPY/QQQ/XLF resolved to the wrong companies** — subscribers clicking "SPY Quarterly Report"
   got Royal Caribbean's 10-Q. 60 of 420 filings were another company's.
8. `data/sec/` published unauthenticated, letting anyone rebuild the Basic-gated aggregate one
   ticker at a time — via Pages *and* the public repo.
9. A 3.3 MB CIK cache about to be committed and published, and re-committed weekly.

## The four guards, and what each would have caught

The through-line was never "bad code" — it was that **nothing asserted the outcome**. Each guard
answers a question nobody was asking:

| guard | where | question | would have caught |
|---|---|---|---|
| `check_publish_freshness` | Pi, 30 min | did the site actually publish? | #1 — in 90 min instead of 5 days |
| `check_script_drift` | Pi, 30 min | is the merged code the running code? | #1 — eight days before it fired |
| `check_published_surface` | Pi, 30 min | is anything published nobody declared? | #8, #9 |
| `check_premium_registration` | CI, per PR | is rule 5 actually satisfied? | the #8 class, at review time |
| `check-published-contracts` | deadman, 30 min | can the frontend parse what shipped? | #4 |

**Why two homes.** `ci.yml` path-ignores `data/**` and `public/data/**`, so CI can never see the
Pi data commit that introduces a newly-published path — that half must live on the Pi.
Conversely the Pi cannot review a PR. Neither alone is sufficient.

**Every guard was negative-tested.** A check that cannot fail is not a check: the surface guard was
proven to report an undeclared `sec/` *and* to stay quiet for gitignored `charts/`/`*.bak` (its
first cut produced exactly those false positives, and noise is how a check gets muted); the
registration check was proven to catch both a missing `.gitignore` entry and a missing
`data_gate.js` entry.

## Still open — deliberately

- **`deadman` has no Telegram secrets.** Detection is perfect and always was: it reported
  `114.2h old — Pi pipeline may be DOWN` every 30 minutes for 4.5 days and nobody saw it. Add
  `TELEGRAM_BOT_TOKEN` + `TELEGRAM_HOME_CHANNEL` as repo secrets and the notify step activates.
  **This is the single highest-value thing left.**
- **`strategy_override.json` / `strategy_stability.json`** — published, frozen since 2026-06-30,
  no consumer in `src/`, the Worker, or `llms.txt`. Marked `ORPHAN` in `PUBLISHED_SURFACE` rather
  than silently blessed. Candidates for deletion.
- **ETFs now show an empty SEC section** — correct (they file 497/NPORT-P, not 10-K/10-Q), but
  fetching fund forms would be better than nothing. Product call.
- **`data/sec/*-filings.json` in git history.** Untracked going forward, but past commits still
  contain them. Only matters if that data is considered sensitive rather than merely gated.
