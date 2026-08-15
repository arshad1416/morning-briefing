# Launch-readiness verification — 2026-08-14

> **STATUS — everything below has SHIPPED.** PRs #53, #54 and #55 are merged; the Worker is
> deployed, D1 migrated, and all Pi patches applied and verified. Two owner decisions remain, both
> at the end of this file: the CASL constants (nothing mails until they are real) and the historical
> `paper_trades.json` exposure (decided: accept it — it is paper money, and a force-push over a
> public repo would cost more than it buys).
>
> Read the sections in order — they are a running record, so an early section may describe a defect
> that a later one closes. Round 3 died on a session limit before any agent did work; its scope was
> closed by hand, and rounds 4 and 5 finished the rest.

The gauntlet's first pass: **verify, don't assume**. Read-only at that point — no source file
edited, nothing committed or deployed, no Pi state changed. HEAD `74eb72e35`, branch
`claude/maplegamma-launch-ready-43a81f`.

**Method.** 8 investigators over exclusive scopes, then 8 *fresh* adversarial critics prompted to
refute and required to re-run every load-bearing command rather than trust a paste. 16 agents,
0 errors. The critics earned their keep: one investigator's `grep -rn "fetchGated(" src/` output
was **fabricated** (a literal `fetchGated(` cannot match `fetchGated<NopeDetail>(`), and the critic
caught it by re-running the command.

Baseline check first: commit `5f3fc33` (the 2026-08-14 audit fixes) **is already merged** into
`main` and this branch, and `8983ed9f..HEAD` touches only Pi-generated JSON — so the line numbers
in the brief were still valid. Where they had drifted anyway, corrections are noted below.

---

## Scoreboard

| # | Claim | Verdict |
|---|---|---|
| 1 | Two unrealized P&Ls on /positions | **CONFIRMED** — but the gap is **$63.40**, not ~$310.85 |
| 2 | Two win rates for one account | **CONFIRMED** — and it's **four** surfaces, not two; root cause misdiagnosed |
| 3 | "Entry Price" shows the entry-date close | **CONFIRMED** — fix is in the generator, **zero** frontend lines |
| 4 | 50 archive pages republish a frozen scan | **CONFIRMED** — **45** pages, not 50; and the narrative is worse than the setups |
| 5 | Accountability is behind the $99 gate | **PREMISE REFUTED** — wrong file, and there is nothing honest behind the gate to ungate |
| 6 | No public /grading-rule page | **CONFIRMED** — and the rule itself already exists, precisely, in Pi code |
| 7 | Landing copy the gate contradicts | **CONFIRMED** — 10 instances, not 1; one is an outright rule-6 lie |
| 8 | No email capture for logged-out visitors | **CONFIRMED** — but "reuse briefing.js" is refuted: there is no subscribe route |
| 9 | www.maplegamma.ca 302s; canonical is split | **REFUTED** — it's a 301 and the canonical is already consistent everywhere |
| 10 | "59 stocks covered" | **CONFIRMED** — wrong three separate ways |
| 11 | chat.js has no global ceiling | **CONFIRMED** — but the endpoint has **zero consumers**; delete beats meter |
| 12 | Only /positions shows data age | **REFUTED** — /dashboard and /options already do; only /ticker is missing |
| 13 | 24 stale ticker pages, BK 35 days | **CONFIRMED** exactly — same two-line fix as #12 |
| 14 | Guard never calls `git ls-files` | **CONFIRMED** for `ls-files`; **charts/ and sec/ REFUTED** |
| 15 | check:contracts absent from ci.yml | **REFUTED** — it lives in deadman.yml deliberately |

**Four of fifteen are refuted. One (#5) has a refuted premise. Three launch-blockers that are not
on the list at all were found by the critics.**

---

## Not on the list, and they outrank most of it

### A. A paying Pro subscriber is served a 40-day-stale artifact as current

`council_history.json` was believed to be a dead registration. It is not. The R2 object **exists**:
42,178 bytes, 25 runs, newest `generated_at` **2026-07-05**. `data_gate.js:52-53` does
`const obj = await c.env.PRIVATE.get(file); if (!obj) return 404` — **no freshness check at all**.
So a Pro subscriber gets HTTP 200 and a frozen July artifact containing concrete trade entries
(NVDA long, entry 138.5, stop 133.2, target …) presented as current, while `llms.txt:29` advertises
"council history" as a live Pro feature. Its only writer, `backfill_council_outcomes.py`, is a
manual tool and is **not in crontab**.

This is worse than the P0-B pricing complaint: an absent file is a gap; a stale file served at 200
is an active false statement to someone who paid.

### B. The Pro accuracy panel prints a fabricated denominator

`src/components/feature/prediction/AccuracyStats.tsx:56` renders a tile labelled **"Closed Trades"**
from `total_signals`, defined at `src/lib/schemas/market.ts:372` as
`f.expectancy.n_trades || f.summary.total_trades`. Live `accuracy.json` has `n_trades: 0`, so the
`||` falls through to a different quantity and the tile shows a number that is not closed trades.
Same failure mode as the max-pain label the last audit fixed — AGENTS.md rule 6, live, on a paid
surface. `/predictions` has a second consumer (`predictions-client.tsx:175-194`) rendering
"Live Simulation Metrics" off the same empty payload.

### C. Nine published JSON files contain bare `NaN`/`Infinity` — Python writes them, JavaScript cannot read them

```
public/data/archive/{2026-06-10,06-16,06-19,06-27,07-15}.json   → 5
public/data/backtests/{AAPL_mean_reversion,SPY_sma_cross ×2,SPY_mean_reversion}.json → 4
```

Verified: `node -e "JSON.parse(...)"` fails on all nine; Python's `json` accepts them silently,
which is why they shipped. Consequences:

- **The 5 archive files** — `src/app/archive/[date]/page.tsx:36` uses a plain `JSON.parse`, so
  `loadBriefing()` returns null and five live `/archive/<date>/` pages build as **content-empty
  `NewsArticle` shells**. `archive-client.tsx:143` fetches the same URLs client-side, so expanding
  any of those five cards on `/archive/` throws.
- **The 4 backtest files** — already handled. `src/lib/backtests/coverage.ts:164` has a
  `parseTolerantJson` written for exactly this, and its comment records the previous incident
  verbatim: a plain parse *"silently dropped every one of them — the page reported '7 saved runs'
  as though that were the whole corpus."*

**So this repo already diagnosed and fixed this bug class once, and the archive loader never got
the fix.** The lazy repair is to export `parseTolerantJson` and use it in the two archive callers.
The root cause is the Pi writer's `json.dump` defaulting to `allow_nan=True`; that fix lands in
`arshad1416/hermes-scripts` and does not retroactively repair the nine existing files.

No e2e test can catch this today: `e2e/tests/responsive-layout.spec.js:9` pins
`GENERATED_ARCHIVE_DATE = archiveIndex.dates[0]` — the newest date only. One of 76 archive routes
is under test, and it is never a `NaN` file.

---

## What the brief got wrong

**#1 — magnitude and mechanism.** The two P&Ls differ by **$63.40** today, not ~$310.85
(header `unrealized_pnl` 425.07 vs Σ row `pnl` 361.67, payload `generated_at` 2026-08-14 17:15:03).
It is invariant to *current* prices but is **not a fixed constant across days**: today's two
same-day entries (XLV, KO) take the `entry_price_usd` short-circuit at `push_dashboard.py:596-598`
and contribute exactly 0.00; they start contributing tomorrow. Per-row contributions: DIA 23.04,
IWM −113.70, XLK 27.26. `get_entry_price` is at **:178-204**, not ~194-206. Lines 647-649 are
*generator* lines; the header tile is `positions-client.tsx:265-267`. And crucially — **the header
is the correct number.** `Σ(current_price×qty − entry_value) = 425.07` exactly. Only the rows are
wrong.

**#3 — wrong file, wrong count, wrong session count.** The label "Entry Price" is *honest*; the
generator writes the wrong value into `t.entry_price`. **Zero frontend lines change.** The TH is at
`positions-client.tsx:320` and the value cell at `:336` — `:337` is Current. IWM's booked 296.19 is
the close **24** trading sessions before the entry date, not 19. And it is not IWM-only: DIA
(540.43 booked vs 538.99 published) and XLK (186.90 vs 186.32) are equally affected. One
understatement in the brief's favour: the badge is **mis-rendering right now** — IWM shows
"⏳ Up 0–2%" where the booked basis gives 3.00% → "✅ Up 2–5%".

**#2 — root cause misdiagnosed.** It is not "a hollow 0.0 from an empty list", so
*suppress-when-empty does not fix it*. It is a **denominator mismatch**: `push_dashboard.py:437-440`
reads prune-immune lifetime counters (46.8%, 79 closes since 2026-06-12);
`generate_prediction_accuracy.py:204` reads `closed_trades`, scoped to whatever closed since the
08:00 prune. The Pi's own log proves the short window is routinely *non-zero and wildly different*
— 19 of 19 retained runs saw a non-zero close count, including days at 12.5% and 100.0%.
Suppression would not have fired on any of them. Also: **four** surfaces publish a win rate, and
`/positions` alone publishes two of them (46.8% at `:258` and 0.0% at `:415`) under the **same**
`win_rate` glossary term. And the `/predictions` number does **not** come from
`generate_prediction_accuracy.py` at all — it comes from `update_prediction_accuracy.py`, which
exists **only** on the Pi and has no copy in this repo, i.e. it is invisible to repo-only review.

**#4 — page counts and the wrong half of the defect.** The freeze is real and byte-identical:
one scan whose own `scanned_at` is **2026-05-29T12:20:48**, republished across 50 archive *files*.
But measured **live**, the route builds **76** pages of which **45** render the frozen setups
(the other 5 are the `NaN` shells above). The cited `$426.99` **is never rendered** —
`page.tsx:304-310` prints ticker, score, change_pct and signals; `price` and `rsi` are read but not
displayed. "Stamp the real scan date" is **not available**: `generate_latest.py:154` copies only
`scan["top_setups"]` and never `scanned_at`, so no provenance survives into the payload.
And the bigger half is the one the brief misses — the `narrative` object is byte-identical across
**43 live pages**, contains a specific dollar portfolio balance, and feeds **both** the
`NewsArticle` description (`:190`) and the page `<meta name=description>` (`:129-131`). The root
cause was already fixed upstream 19 days ago (`2b5e65760`, the `UPSTREAM_MAX_AGE_H = 26` guard at
`generate_latest.py:151-152`); the stale *archived copies* are what remain.

**#9 — refuted twice over.** Every alternate host returns **301** (permanent), not 302 —
`cloudflare-worker/src/index.js:27` hardcodes it. A 302 would be the described bug; a 301 is
correct behaviour. The canonical is already picked and already consistent across all four named
surfaces *plus* `layout.tsx:36 metadataBase`, and the live sitemap contains **zero** `.ca` URLs.
`src/lib/seo.ts buildMetadata` structurally *cannot* assert a competing host — it emits relative
paths only (`:31`, `:36`). **Recommendation: change nothing.** Any edit to `index.js` costs a
manual Worker deploy (the Worker does not ship on merge) and buys nothing.

**#12 — headline false.** `/dashboard` renders `<DataFreshness>` in four tiles
(`VerdictBar.tsx:59`, `IndicesCard.tsx:45`, `VixRegimeCard.tsx:47`, `GexDexVexCard.tsx:92`) and
shows "10h ago" live. `/options` renders it too. **Only `/ticker/[symbol]` is missing it** — and
that is the same two-line diff that closes #13.

**#14 — `charts/` and `sec/` are wrong, and `sec/` is actively harmful.** `charts/` **is**
registered in all four places, just through different mechanisms than the guard reads
(`.gitignore:75-76`; `r2_sync.py:173-177` uses a dedicated directory loop, not `PRIVATE_FILES`;
`data_gate.js:14 PRO_PREFIXES`), and is untracked. `sec/` is a deliberate **fifth** category —
`pi-scripts/publish_policy.py:7-21` documents that putting a *directory* into `PRIVATE_FILES` makes
`s3.upload_file` fail, which counts as a transport failure, which **fail-closes the entire
publish**. That comment was written against this exact temptation. The `ls-files` half is real and
worth fixing; these two are not.
Causal correction: the guard did not *fail* to catch the paper_trades leak — it postdates it by
three weeks (guard created 2026-08-04 `9822ca8df`; leak 2026-07-11). The cause was an incomplete
untrack in a human commit (`804a87200` added both `.gitignore` lines but `git rm`'d only the `data/`
copy). The "~8h" figure is accurate to the minute: **7h59m21s**.
Also found: `check_published_surface()` in the Pi's `cron_watchdog.py:486` **already** does the
`git ls-tree` check — but only over `HEAD:public/data`. The genuine residual gap is that **`data/`
is unguarded on both sides**.

**#15 — refuted, both halves.** `check:contracts` **is** in CI, at
`.github/workflows/deadman.yml:118-120` on a `*/30` schedule, and that is the correct home:
`scripts/check-published-contracts.mts:26` defaults its origin to the **live site**, so as a PR gate
it would fetch production rather than the PR's tree — passing or failing independently of the diff,
and red-lighting every open PR whenever the Pi is mid-publish. The numbers 4 and 11 are both real,
but the 7 uncovered payloads are **exactly the 7 gated ones**, unreachable from a GitHub runner
without a session cookie. (True gated count is **12**, not 11 — `gex-detail.json` was missed.)

**#10 — right, and worse than stated.** `LandingPage.tsx:344` `{ value: "59", label: "stocks
covered" }` sits under `aria-label="Platform coverage"`, so a reader is told the *platform* covers
59 stocks. It is (a) not a coverage number — it traces to a backtest ticker list; (b) stale even
against that origin — no live backtest script lists 59 (they list 60, 60, 65); (c) not "stocks" —
25 of the 60 are ETFs. Its two neighbours are worse: **"17.5K trades tested on past data"** and
**"26 years of market history"** reconcile only against the **$99-gated** `prediction-engine.json`,
while the **public** `/research` page shows 11 backtest runs across **3 tickers** (AAPL, SPY, GLD),
~109 trades, all windows 2024-01-01→2026-06-01. A visitor can contradict the trust bar two clicks
away, for free. Separately, `LandingPage.tsx:165` renders a **hardcoded 72** on a gauge labelled
"The Verdict", with `aria-label="Verdict reading: 72 out of 100, leaning bullish"` and no
"illustrative"/"sample" disclaimer anywhere in the file, while the real public `verdict.json` says
something else.

**#8 — "reuse briefing.js" is refuted.** `briefing.js` is **59 lines** and mounts **two routes,
both unsubscribe** (`:41` POST, `:49` GET), both token-only. **There is no subscribe route anywhere
in the Worker.** RFC 8058 headers are set on the **Pi** (`send_subscriber_briefing.py send_one()`),
not in `briefing.js`; account-page management is `auth_password.js:95`. What is genuinely reusable
is ~22 lines of HMAC helper. There is **no subscriber table** — subscription is a single
`briefing_opt_in` column added to `users` by migration 0003.
The task's own fallback hypothesis ("nothing can actually send mail") is **also refuted**: SMTP
works and delivers daily (`secure.emailsrvr.com:587`, `briefing_delivery.log` Aug 14 07:28). The
mass sender is blocked by a commented-out crontab line **and** a deliberate CASL guard.
CASL today is **1 of 3**: unsubscribe yes; `OPERATOR_NAME`/`OPERATOR_ADDR` are literal placeholder
strings `[operator legal name]` / `[mailing address]`. Sender identification also fails for a
reason the brief doesn't raise: the From is `"MapleGamma Daily Briefing" <arshad@carfii.com>`.
DNS framing was pointed at the wrong domain — nothing sends as `@maplegamma.com`; `carfii.com` has
SPF and DMARC and is aligned today.

**Two design landmines found in #8 that must constrain any implementation:**
1. **Do not write captures into `users`.** `pw_hash` is nullable, so a public endpoint inserting
   there creates squattable rows: `auth_password.js:34` returns 409 `email_taken` (permanently
   locking the real owner out of signup), and `auth_oauth.js:72` fires its anti-hijack guard only
   `if (existing && existing.pw_hash)` — so a `pw_hash`-NULL capture row falls through at `:85` and
   **becomes the victim's Google account**, skipping the consent gate and `insertConsent` at `:93`.
2. **`briefing.js:49` mutates on a bare GET.** The unsubscribe write happens with no confirmation,
   and the Pi uses the same URL for the visible body link *and* the `List-Unsubscribe` header.
   Corporate link scanners and Outlook Safe Links will silently unsubscribe people.
   Also: zero abuse control exists on any public write path — no Turnstile/CAPTCHA anywhere in the
   repo, and the only rate limiter is `chat.js`'s, used only by chat.

**#11 — real, but the fix is deletion.** All four sub-claims hold (`chat.js:172` max_tokens 2000;
limiter at `:99-117`, per-IP only; route unauthenticated at `index.js:51-52`). But the endpoint has
**zero consumers** — cleared across `src/`, `e2e/`, the legacy SPA, and the Pi. It is not reachable
at `maplegamma.com` (wrangler routes only `maplegamma.com/api/*`, and there is no `/api/chat`
mount); it is live on the `workers.dev` hostname. Adding ~6 lines, a `[vars]` entry, a sentinel row
and a DELETE-guard to meter an endpoint nobody calls is the wrong shape.
One thing nobody flagged: `chat.js:72-91 positionDisclosure()` reads `env.PRIVATE.get(
'ibkr_positions.json')` — the fail-closed premium bucket — and leaks one bit of it per successful
request ("the site operator currently holds a position in {TICKER}"), unauthenticated.

**#13 — exact.** Measured from each file's own `generated_at` across both `data/tickers/` and
`public/data/tickers/` (3,040 files each, identical): `<1d: 3016 | 7-14d: 23 | ≥30d: 1`; 24 stale,
BK at 35.4 days. Sharper than the claim: **22 of the 24 share `generated_at`
`2026-08-05T14:45:01.677443+00:00` to the microsecond** — one dropped-universe batch, plus TOI and
BK as the only independent cases. **Prune is the wrong default**: BK is BNY Mellon, live and
listed, and under `dynamicParams=false` pruning hard-404s a legitimate page. Date-stamp instead —
the same two-line diff as #12.

---

## #5 — written recommendation (no code written)

**The premise is refuted, and this is the finding that changes the launch.**

`accuracy.json` is **not the grade**. It is paper-trading P&L whose only notion of "correct" is the
**sign of `pnl_pct` on a closed trade** (`generate_prediction_accuracy.py:79-84`). It contains no
call, no date, no benchmark, no horizon — and it is currently **empty** (`closed_trades: 0`,
`win_rate: 0.0`). `prediction-engine.json` is a backtest corpus. Ungating either proves nothing.

The real per-call scored ledger is **`trade_outcomes.json`** — 25 dated entries with predicted
regime, realized regime and a correctness flag. It is Pro-gated, and **no page fetches it at any
tier**: the string appears exactly twice in the entire frontend + worker tree, both inside
`data_gate.js`'s `PRO_FILES` literal. No API entry, no zod schema, no query key. **A paying Pro
subscriber cannot see the misses either.** The paywall is not what hides the scorecard — the
absent UI is.

**And there is nothing honest behind the gate to ungate.** The council aggregator has **never once
succeeded** in the entire logged period: `agent_council.log` spans 2026-06-30 → 2026-08-14 with 111
completions — 30 `degraded`, 81 `fallback`, **0 clean**. Today `market_pulse` is absent from both
the A and B arms (`meta.status == aggregator_failed`). `trade_outcome_logger.py:113-114` then does
`mp.get('regime','neutral')` and `mp.get('confidence', 5)` — so **a missing call is recorded as a
"neutral" prediction and graded wrong**. The fingerprint is unmistakable: all 25 recommendations
carry confidence 0.5.

So "publish the scorecard including the misses" would today publish **fabricated misses**.

**A precise grading rule does already exist** — implemented identically in two places
(`trade_outcome_logger.py:189-196`, mirrored in `backfill_council_outcomes.py`):

> Benchmark **^GSPC**. Horizon **same-day**, close vs the prior trading day's close.
> `ret > +0.1%` → bullish; `ret < −0.1%` → bearish; otherwise **neutral** (the scratch band).
> A call is correct iff predicted regime == realized regime, with long→bullish and short→bearish.
> `correlation_score` = fraction of scored recommendations correct.

It lives **only in code, on the Pi**, in files that have no copy in this repo. The only public
trace is one clause in `llms.txt:6-7` with no thresholds. Nothing needs to be invented to publish
it — it is already precise enough to state verbatim.

### The options

| | What becomes public | Registration edits | Honest today? |
|---|---|---|---|
| **A. Rule only** | `/grading-rule` v1.0, dated, stating the ^GSPC / same-day / ±0.1% rule verbatim; linked from the hero | **none** | **Yes** — the rule is a commitment, not a claim about past results |
| **B. Rule + one worked day** | A + one fully worked scored day: call → rule → outcome | none *(the sample is prose)* | **No** — 22 of 25 graded calls are default-neutral fabrications |
| **C. Rule + rolling figure** | A + a derived public `outcomes-lite.json` beside `make_screener_lite()`, plus schema/API/render | none *(derived teaser, exactly like `screener-lite.json` — no gate change)* | **No**, until the aggregator is fixed |
| **D. Ungate `accuracy.json`** | The file the brief named | 4 places | **No** — it isn't the grade, and it's empty |

**Recommendation: A now, then fix the aggregator, then C. Never D.**

Publishing the rule **before** the sample it grades is exactly what makes it falsifiable, costs
zero registration edits, and is the only item here that is honest on day one. Shipping B or C on
top of a ledger where 22 of 25 entries are default values would launder a pipeline hole into a
public accountability claim — the precise opposite of the positioning.

The aggregator fix is two separable changes, both on the Pi: (1) a ~4-line guard at the top of
`extract_council_recommendations` that **skips** the entry when `meta.status == 'aggregator_failed'`
or `market_pulse` is empty, instead of booking a default "neutral" and grading it wrong; and
(2) diagnosing the `deepseek-v4-pro` aggregator failure itself.

---

## Owner actions — not code, flagged as instructed

1. **`paper_trades.json` is in public git history.** `arshad1416/morning-briefing` is a **public**
   repo, and the Basic-gated payload is retained in full from 2026-06-03 (`44b10eb95`) through
   2026-07-12 (`c71c4aa21`), across 1,251 commits touching the two paths.
   `git show 804a87200^:public/data/paper_trades.json` still returns the complete 203-line payload
   with live portfolio positions. Removing it from the working tree did not remove it from history.
   Options: accept the historical exposure, or rewrite history with `git-filter-repo` and
   force-push — which must be coordinated against the Pi's autonomous ~30-minute commits to `main`
   and would invalidate every existing clone. **Do not attempt this as part of any code fix.**
2. **Cloudflare Cache Rule for `/data/*`** — dashboard only. Pages *appends* `_headers` rules, so a
   per-path TTL would ship as `max-age=0` **and** `max-age=120` together.
3. **Pages build quota headroom for launch week** — measured 256 builds Aug 1–14 across both
   projects, projecting ~427 against a 500/month per-account cap. Measure deployments, not commits.
4. **CASL constants** — `OPERATOR_NAME` and `OPERATOR_ADDR` need a real legal entity and a real
   mailing address before any mass send. The runtime guard at `send_subscriber_briefing.py:167`
   already refuses to send until they are filled; no code change is needed to unblock it.
5. **Deliverability is unproven.** `briefing_delivery.log`'s "✅ Sent" is an SMTP accept, not an
   inbox placement. Nobody has evidence the 07:37 daily email lands in Inbox rather than Spam —
   which is the actual precondition for a launch funnel.

---

## Where each fix lands

`pi-scripts/` here are **version-controlled copies**. Verified byte-identical to the executing Pi
copies (md5 match in both directions) for `push_dashboard.py`, `generate_prediction_accuracy.py`
and `r2_sync.py` — so there is no drift to reconcile, but editing them here still **deploys
nothing**.

| Fix | Repo |
|---|---|
| #1, #2, #3 (generators), #5 aggregator guard | **`arshad1416/hermes-scripts`** — mirror into `pi-scripts/` here |
| #4, #6, #7, #10, #12, #13, #14, and the three new blockers | **this repo** |
| #8 | split — Worker + migration here, recipient query on the Pi |
| #9, #15, #14's `charts/`+`sec/` half | **nothing to do** |

`update_prediction_accuracy.py` — the actual writer of the `/predictions` win rate — exists **only**
on the Pi and has no copy here at all. Same for the entire mail system
(`send_subscriber_briefing.py`, `send_comprehensive_briefing.py`) and `publish_ticker_details.py`.

---

## What shipped (round 2 + hand closeout)

Every item below was built by a builder under exclusive file ownership and reviewed by a *fresh*
adversarial critic that re-ran the load-bearing commands rather than trusting a paste. One edit was
**rejected** (see below) and was rewritten by hand.

| Item | Before → After |
|---|---|
| **#1 / #3** one cost basis | header **$425.07** vs Σ rows **$361.67** (gap **$63.40**) → Σ rows **$425.07**, gap **$0.00**. Header unchanged — it was always right. `entry_price` 299.98→296.19 (IWM), 538.99→540.43 (DIA), 186.32→186.90 (XLK). IWM `pnl_pct` 1.70→**3.00**, moving its badge from "⏳ Up 0–2%" to "✅ Up 2–5%". The closed-trade path had the **identical** defect (re-derived *both* ends from yfinance, and priced option rows off the *underlying*) — also fixed. ~39 lines of dead helpers deleted, including `to_native()`, which the critic found was not merely dead but **wrong**: it would have understated a USD fill by 28%. |
| **#2 + fabricated denominator** | `accuracy.json` win_rate **0.0 → 46.8**, closed_trades **0 → 79**, total_trades **5 → 84**; `prediction-engine.json` live_trading **0 → 46.8 / 79 / 37W-42L**. `market.ts` un-blended `total_signals` (the "Closed Trades" tile really showed **5**, the open-position count — the brief's "0" was wrong). Panels that had no retained sample now print **—** instead of a fabricated `+0.00%`. The `update_prediction_accuracy.py` fix is the laziest in the set: `wins`/`losses` were **already** assigned from the metadata counters and then dropped on the floor. |
| **#4 + bare NaN** | `parseTolerantJson` moved to `src/lib/json.ts` and reused by both archive callers — the repo had already solved this bug class for backtests and the archive loader never got it. 5 content-empty `NewsArticle` shells → **0**; 20 rows that would print "NaN (NaN%)" → **0**. A corpus rule suppresses any narrative/setups block that merely *repeats* an earlier date's, closing the rendered section, the JSON-LD description and the meta description in one place: **43 → 2** pages asserting frozen content as that day's news. |
| **#6 + #10** | New public `/grading-rule` v1.0, dated, stating the real rule verbatim (^GSPC, same-day close vs prior trading-day close, ±0.1% scratch band), linked from the hero, **zero** registration edits. Trust bar `17.5K / 59 / 26` → `11 / 3,000+ / 109` — figures that now reconcile with the **free** `/research` page instead of contradicting it. `aria-label` "Platform coverage" → "What MapleGamma publishes". |
| **#11** | 2 unauthenticated mounts → **0**. 196 lines deleted. Also closes an unflagged leak: `positionDisclosure()` read the fail-closed premium `ibkr_positions.json` and disclosed one bit of it per request, unauthenticated. |
| **#12 / #13** | 3,040 `/ticker` pages with no data age → all 3,040 stamped; 3,016 fresh, **24** amber, BK "35d ago". One two-line diff closes both. Not pruned — `dynamicParams=false` would hard-404 BNY Mellon. |
| **#14** | Guard assertions per premium file **3 → 5**, adding tracked-ness across `data/` and `public/data/` — 48 previously-unchecked paths. Proven red on a synthetic leaking repo, green on this one. `charts/`/`sec/` correctly **not** implemented. |
| **NEW-A** | `council_history.json`: HTTP **200** with a 40-day-stale artifact → HTTP **404**. `.gitignore` entries deliberately **retained** (un-ignoring is the unsafe direction on a public repo) with a comment saying why. |

**Rejected and rewritten by hand:** `pi-scripts/test_push_dashboard_basis.py`. The critic proved it
was a fossil — a copy of the expressions with no reference to the module, so it stayed green next to
the *unfixed* file. It now asserts against the shipped source. Proof it is real: reverted in a
scratch copy → **3 failures**; against the shipped file → **10 passed**.

**Green gate — final, all five, measured after round 4:**

| Command | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `cd cloudflare-worker && npm test` | **86 passed, 0 failed** (14 files; 76 before round 4) |
| `pi-scripts` 6-suite unittest | **66 OK** — the six now named in both `ci.yml` and AGENTS.md (`test_generate_prediction_accuracy` previously collected **zero** tests and passed silently) |
| `npm run build` | exit 0, **3,135** static pages, `/grading-rule` in `out/` and in the sitemap |
| `npm run test:e2e` | **exit 0 — 60 passed, 0 failed, 40 skipped**, with `retries: 0` |
| `scripts/check_premium_registration.py` | exit 0 — 24 files consistent across all four places **and untracked in both trees** |

**e2e: `npm run test:e2e` exits 1 — and the failure is PRE-EXISTING, not ours.** Attributed by
experiment rather than argued:

| Run | Tree | Result |
|---|---|---|
| 1 | this branch, full suite | 58 passed, 37 skipped, **1 failed** — `research-details.spec.js:94` |
| 2 | this branch, full suite | 57 passed, 37 skipped, **2 failed** — `:94` **and** `:111` |
| 3 | this branch, `research-details.spec.js` alone | **2 passed**, in 1.2s and 1.4s |
| 4 | **clean worktree at HEAD `74eb72e35`, none of our changes** | 58 passed, 37 skipped, **1 failed** — `research-details.spec.js:94`, identical |
| 5 | this branch, `CI=1` (CI's own retry settings) | **exit 0** — 58 passed, 37 skipped, **1 flaky** |

Run 4 is decisive: the same test fails the same way with our diff entirely absent. Two further
facts rule out a regression on our side — a real one would also fail in isolation (run 3 passes in
1.2s against a 30s budget), and a deterministic break does not change its blast radius between two
identical runs (run 1 failed one test, run 2 failed two).

**Root cause: these two tests are timing-fragile under contention, and CI has been hiding it.**
`e2e/playwright.config.js` sets `retries: process.env.CI ? 2 : 0` with `workers: 2` and a 30s
per-test timeout. Both tests time out on their FIRST interaction — `locator.click` waiting for a
button that renders in ~1s unloaded. CI's two retries mask it; a local run has none.
Run 5 confirms the diagnosis from the other direction: given CI's own retry setting the suite
**exits 0** and Playwright itself labels the test `flaky`, not failed.

**Round 4 then fixed it properly rather than papering over it.** The root cause is not slow
hydration: the first `click` fires before the tab pane mounts. A `toPass` guard replaced the two
bare tab clicks in `research-details.spec.js`. `playwright.config.js` is **untouched** — no raised
timeout, no `test.slow()`, no local retries, because those would hide the signal for everyone.
Final state of the documented command, with `retries: 0` and no CI safety net:

    npm run test:e2e  →  exit 0 · 60 passed · 0 failed · 40 skipped

Up from 58 passed / 1 failed / 96 total. The +4 total reconciles exactly: the new frozen-ticker
data-age test across 4 projects, skipping on the 3 non-desktop ones.

**Pi patches** — `patches/hermes-scripts/`, four files. Each was cut with `diff -u` against the live
Pi copy, applied with `patch --dry-run`, and verified to reproduce the repo copy byte-for-byte.
**The owner deploys.** Nothing was written on the Pi.

---

## Round 4 — the four that were open

8 agents, 0 errors. All four shipped. One edit was **rejected** and repaired by hand.

- **#8 email capture — built in full.** Standalone `briefing_subscribers` table (migration 0006,
  appended to `test/helpers.js migrate()`), `POST /api/briefing/subscribe`, the landing-page form,
  the mutating-GET fix, and abuse control. Worker suite **76 → 86 tests, 0 failed**.
  The critic *built the rejected design* rather than trusting the argument for the safe one: with
  the capture written into `users`, the test `a captured address can still sign up for a real
  account` fails `expected 409 to be 200` — `auth_password.js:34`'s `email_taken`, i.e. the squat
  locking the real owner out. That is why the table stands alone with no FK.
  **GET now confirms and POST writes**, so link scanners stop silently unsubscribing people, and
  RFC 8058 one-click still works — verified against the live Pi sender, which uses one URL for both
  the body link and the `List-Unsubscribe` header.
- **NEW-D — patched.** Measured against the live Pi copy under a scratch HOME: on an
  `aggregator_failed` day, **before → 1 entry written** (`prediction: neutral, confidence: 0.5,
  correct: false` — a fabricated miss); **after → 0 entries**. Same for a healthy day with no
  ^GSPC close. `portfolio_fallback` is deleted, so the page's published rule and the scorer now
  agree.
- **`/grading-rule` now names what it grades** — `maplegamma_analysis.json → market_pulse.regime`,
  and says plainly that this is not the public 0–10 verdict score.
- **`/archive` index — 48 frozen-narrative cards → 1** (the origin, kept deliberately, matching the
  per-date rule). Premarket setups suppressed corpus-wide.
- **e2e — 58 passed/1 failed → 60 passed/0 failed across 100 tests, four consecutive runs.** The
  pre-existing research flake was diagnosed rather than papered over: the first `click` fires before
  the tab pane mounts, so a `toPass` guard replaced the bare clicks. `playwright.config.js` is
  untouched — no raised timeouts, no local retries.

**Rejected and repaired by hand:** the archive builder's new `describe()` emitted
*"MapleGamma daily market briefing for &lt;date&gt;: the S&P 500 closed at X"* into the meta description
and the NewsArticle JSON-LD on 51 pages. Briefings generate **pre-market**, so X is the prior
session's close — and **17 archived dates fall on a weekend** (2026-07-04 and 07-05 both carry
Friday's 7,483.24). It asserted a market close on days the market was shut. Rewritten to state the
levels the briefing was written against, without claiming a close on that date. Exactly the defect
class this whole exercise exists to catch, introduced by a fix for it.

**Also repaired by hand, from critic findings:**
- **No server-side consent gate.** The landing form's checkbox gated only the button's `disabled`
  and was never transmitted, so `terms_version`/`ack_version` recorded the Worker's env at insert
  time — a version stamp, not evidence a subscriber agreed. Now sent and gated server-side, the way
  `auth_password.js` gates before `insertConsent`. New test proves it: without the gate it fails
  `expected 200 to be 400`.
- **Global ceiling was exhaustible by five IPs.** `PER_IP_PER_HOUR = 5` is 120/day/IP against a
  500/day global, so five IPs pacing under their own limit could 429 the site's only email capture
  for a day. Unlike the chat endpoint it replaced, a subscribe has no marginal cost, so the ceiling
  is now 5,000 and the test reads the constant from source rather than hardcoding it.

---

## Shipped to production, 2026-08-14/15

PR #53 merged (`902dcdd05`), CI green on `main`. Deploy order was D1 migration → Worker → Pages.
Verified against production, anonymously:

| Probe | Was | Now |
|---|---|---|
| `POST /chat`, `POST /` | live, unauthenticated, OpenRouter-billed | **404** |
| `council_history.json` | **200** + a 40-day-stale artifact | **404** |
| subscribe without consent | — | **400** |
| `accuracy.json` | 401 | **401** (gate intact) |

`OPENROUTER_API_KEY` deleted from the Worker; the orphaned `council_history.json` R2 object deleted.

**All Pi patches applied** (backups in `~/.hermes/backups/pre-launch-2026-08-14/`), every one
dry-run first, compiled after, and repo/Pi md5 parity re-verified. The publisher was then run for
real:

    header unrealized  425.07
    sum of row pnl     425.07
    GAP                0.0        (was $63.40)
    win_rate           46.8
    entry_price        DIA 540.43 · IWM 296.19 · XLK 186.90   (booked fills)

### The aggregator: root cause found, fixed, and proven

It had failed **111/111 runs** since 2026-06-30, always logging `failed: None`. The cause was not
the model, the key, or the proxy — all three test clean. `deepseek-v4-pro` is a **reasoning** model,
and `max_tokens` caps *total* completion tokens with reasoning included. Reproduced against the real
13,541-char expert payload:

| `max_tokens` | `finish_reason` | content | reasoning tokens |
|---|---|---|---|
| 3000 (shipped) | `length` | **0 chars** | 3000 of 3000 |
| 8000 | `stop` | 1,716 chars | 1,908 |
| 16000 | `stop` | 1,852 chars | 3,467 |

The model spent its entire budget thinking and emitted nothing. The call returned HTTP 200, so
`call_api`'s `except (KeyError, IndexError): pass` left content **and** error as `None` — which is
why six weeks of failures printed no reason. Both are fixed: the aggregator gets a budget its
reasoning cannot exhaust, and an empty completion now names itself.

First clean run in 111: `status` **`full`** (was `aggregator_failed`), `market_pulse` present,
regime `bullish`, 5/5 experts.

`backfill_council_outcomes.py` carried the identical default-neutral bug — so a rebuild would have
re-created the fabrications. Fixed too; the ledger is repairable again. The 22 fabricated entries
were then removed (**25 → 3** real ones), with a note in the file recording why.

---

## Follow-up sweep, 2026-08-15

**Two more stale artifacts were being served at HTTP 200, same class as
`council_history.json`.** Both were registered, had no UI consumer at any tier, and no live
producer — and both turned out to hold real bytes in R2:

| File | R2 contents | Now |
|---|---|---|
| `walk_forward.json` | `generated_at` **2026-06-03** — 73 days stale | deregistered, object deleted |
| `journal.json` | entries with June-30 trade ids | deregistered, object deleted |

`r2_sync`'s own state file said "never uploaded" for all three, so **the upload cache is not
evidence of what R2 holds** — the objects had to be fetched to know. `.gitignore` entries kept for
both, same asymmetry and same reason as `council_history`.

**The specialist token budgets had the aggregator's bug too.** The first run after the aggregator
fix reported, in the new error message that fix added:

    failed_experts: {"deepseek_quantitative": "empty_content: hit max_tokens
                     (3000 used, 3000 of them reasoning)"}

So every council run had been a silent **4-of-5**, not 5-of-5 — the specialist calls still used the
3000 default. Budgets are now named module constants sized for models that think longer, not
literals at the call site:

    EXPERT_MAX_TOKENS      32000    EXPERT_TIMEOUT      240s   (was 3000 / 90s)
    AGGREGATOR_MAX_TOKENS  65536    AGGREGATOR_TIMEOUT  420s   (was 3000 / 90s)

The proxy accepts at least 131072, verified; billing is per token *used*, not per cap. Both arms now
report `status: full`, `experts_succeeded: 5/5`, `failed_experts: {}`, in ~134s.

**Also closed:** `sitemap.ts` no longer re-implements `listDates()` a third time (a sitemap that
disagreed with the routes about which dates exist is how you publish URLs that 404); the prerendered
`/ticker/SPY/` route joined `CONCRETE_ROUTES` alongside the `?symbol=` fallback, which exercises a
different render path; a global-ceiling trip now logs loudly, because from outside it is
indistinguishable from a quiet day; and both unsubscribe pages plus the Pi email footer stopped
telling landing-page captures to "manage email on your account page" — they have no account, and
`/#/account` was a dead legacy-SPA route for account holders too.

**Not written: the first graded entry.** A dry run proves the chain end to end — a real `neutral`
call graded against a real `bearish` outcome (−0.17%), scoring 0.0, with `market_pulse` present so
the guard correctly let it through. It was not saved: tonight's analysis was regenerated at 23:51,
*after* the close it would be graded against, and a look-ahead entry is fabricated in a different
way. Monday's scheduled run (council 07:23, graded 16:32) produces the first honest one.

---

## Still open — owner decisions only

1. **CASL constants.** `OPERATOR_NAME` and `OPERATOR_ADDR` need a real legal entity and a real
   mailing address; nobody but the owner can supply them. The runtime guard already refuses to send
   until they are filled, and the subscriber cron line is still commented out. **No mail goes out
   until both are done** — the capture form is collecting addresses that currently go nowhere.
2. **`paper_trades.json` in public git history**, 2026-06-03 → 2026-07-12, 1,251 commits. Removing
   it means `git-filter-repo` plus a force-push that invalidates every clone and races the Pi's
   ~30-minute commits. Not attempted.

Lower severity: no operator visibility into `briefing_subscribers` (a global-429 day is
indistinguishable from a quiet day); both unsubscribe pages and the Pi footer tell capture
subscribers to "manage email on your account page", which they do not have; `/ticker/[symbol]/` —
3,040 prerendered pages — still has no e2e coverage, only the `?symbol=` fallback; `sitemap.ts`
re-implements `listDates()` byte-for-byte instead of importing the new `corpus.ts`; and
`journal.json` and `walk_forward.json` look orphaned the same way `council_history.json` was.
