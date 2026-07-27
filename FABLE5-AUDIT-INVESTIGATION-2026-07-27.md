# Investigation: "Fable 5 Feasibility audit" findings — 2026-07-27

Source of the report the user pasted, and verification of every claim in it.

## Where the log lives

**Pi:** `~/.hermes/cron/output/f851f2f952f0/2026-07-27_04-21-57.md`

| | |
|---|---|
| Job name | `Fable 5 UX Audit + ML Feasibility` |
| Job ID | `f851f2f952f0` |
| Schedule | `20 4 * * 1-5` (registered in `~/.hermes/cron/jobs.json`, not the crontab) |
| Model | **`deepseek-v4-pro` via `cliproxy`** — *not* Fable 5 |
| Skill | `finance/daily-briefing-system` |
| Delivery | Telegram |
| History | 17 runs, `2026-07-06` → `2026-07-27`, same directory |

The job is named "Fable 5" for historical reasons — `~/.hermes/scripts/fable5_reminder.sh` records that
the Claude/Fable subscription was cancelled in July 2026 and the work moved to CLIProxy. The findings
are being attributed to a model that is not producing them.

---

## Headline: the staleness section is carried forward, not measured

The job prompt ends with *"Only state facts you can point to in tool output from this run; if data is
missing, say so instead of estimating."* The staleness claims violate that, and the mechanism is
traceable rather than random.

The skill file `finance/daily-briefing-system` embeds ~25 dated prior-audit notes as "Pitfalls",
including an explicit instruction:

> **Progressive staleness**: Research/Backtest sub-tab data age increases linearly with calendar time
> (was 10d stale on July 1, 12d on July 3, 15d on July 6) — the backtest tables are not refreshing.
> Track the age delta between sessions and flag if it continues to grow.

The model complies by **incrementing a day-count off a hardcoded "Jul 12" anchor instead of reading
`generated_at`**. Across successive runs the anchor never moves while the count climbs:

| Run | Claim |
|---|---|
| Jul 21 | "9d stale is critical. Check if cron died on Pi **July 12**" / "5d stale. The pipeline generating these stopped **July 12**" |
| Jul 23 | "**11d stale (Jul 12)**" |
| Jul 24 | "15d stale; now fully dark" |
| Jul 27 | "15d stale" / "All froze **~Jul 10-12** window" |

Every one of these is false (see table below). The skill file also carries other dated claims the model
recycles verbatim — `accuracy.json 36d stale`, `gex_data.json 28d stale`, `Live WR 33.3% vs backtest
74.3%` — and it **contradicts itself** on `paper_trades.json`, listing it as an open endpoint in one
bullet and as gated in another.

*(`~/.hermes/cron/executions.db` records only scheduling metadata — `status`, `claimed_at`,
`started_at`, `error` — with no per-run tool-call log, so it cannot show whether the model fetched the
endpoints and ignored them or never fetched at all. The conclusion rests on the three proofs above:
the numbers are wrong, the anchor is pinned across five runs, and the skill instructs exactly that
computation.)*

---

## CONFIRMED — real defects

> **All line references below are to the Pi copies under `~/.hermes/scripts/`, which is what cron
> executes.** The repo's `pi-scripts/` copies have diverged — see defect 1a. Do not edit by repo line
> number without checking which file is live.

### 1a. The fix for half of this is already written and simply not deployed

Commit `2b5e6576` (Jul 26, *"harden Pi data pipeline — atomic writes, DST fix, flock guards, staleness
checks"*) added `UPSTREAM_MAX_AGE_H = 26` and a `_file_age_hours()` guard to
`pi-scripts/generate_latest.py`. **Cron does not run that file.**

| Path | Modified | Hardened? | Run by cron? |
|---|---|---|---|
| `~/.hermes/scripts/generate_latest.py` | Jul 23 13:06 | ✗ | **yes** |
| `~/morning-briefing/pi-scripts/generate_latest.py` | Jul 26 17:22 | ✓ | no |

The hardened copy is sitting on the Pi, one directory away, unused. `push_dashboard.py` has drifted the
same way (33 changed lines between the two copies). **The deployment step from `pi-scripts/` into
`~/.hermes/scripts/` is missing or not running** — that is the actual defect behind most of what
follows, and it is a class of bug, not a one-off.

Deploying the repo copy fixes `premarket_top_setups` and `watchlist_summary`. It does **not** fix the
narrative or the central-bank text — those are unguarded in the repo copy too (see below).

### 1b. `generate_latest.py` republishes three dead caches every 30 minutes

`push_dashboard.py:671` (Pi copy; `:696` in the repo copy) shells out to
`~/.hermes/scripts/generate_latest.py` on every intra-day run, so `latest.json` gets a **fresh
`generated_at` wrapped around a May payload**. Three `load_json()` reads have no age guard:

| Field | Source | Source date | Age |
|---|---|---|---|
| `narrative.summary_paragraph` | `~/.hermes/briefing-cache/pipeline_synthesis.txt` | **May 30** | 58d |
| `premarket_top_setups` | `~/.hermes/market-intel/premarket_scan.json` | **May 29** | 59d |
| `watchlist_summary` | same May 29 file | **May 29** | 59d |

- **The narrative is the worst of these.** The "$1,177.72 balance, ≈95% cash, seven open positions,
  three IBIT entries" text that the audit praises as *"Keep: Real portfolio narrative"* is a **May 30
  snapshot**, verified byte-for-byte against `pipeline_synthesis.txt`. It is the dashboard's headline
  copy and it has not changed in 58 days.
- **`premarket_top_setups` is byte-identical to the May 29 file** — MSFT $426.99, ARKK $81.01,
  IBIT $41.56. This is more dangerous than the zeros: zeros read as broken, stale setups read as live.
- **`watchlist_summary` zeros** — the audit's one fully correct finding. The May 29 file has no
  `total_scanned` / `green_count` / `red_count` keys at all, so
  `scan.get("total_scanned", 0)` (Pi copy line 120) yields 0 for every field.
- **No producer found.** `grep -rl premarket_scan ~/.hermes --include=*.py --include=*.sh` returns only
  `generate_latest.py` — the *reader*. `~/.hermes/scripts` is a git repo and its full history
  (`--all`, plus `--diff-filter=D`) contains no premarket script ever, deleted or otherwise. A producer
  outside `~/.hermes`, or one composing the path dynamically, would not be caught by this — but nothing
  under `~/.hermes` writes that file.

`central_banks` is the same class with a different cause: it reads
`briefing-cache/central_banks.json`, **which does not exist**, so it falls through to the hardcoded
`DEFAULT_FED` / `DEFAULT_BOC` constants (Pi copy lines 221-229). The published text matches those
constants verbatim — a June Fed/BoC summary that will never change.

**Two of the three survive deployment.** The hardened repo copy guards `premarket_scan` (line 146),
`insider_trades` (239) and `congress_trades` (245), but `pipeline_synthesis.txt` is still a bare
`if synthesis_path.exists()` (line 123) and `central_banks` still falls back to the hardcoded
constants (line 270). So even after `2b5e6576` reaches the Pi, the **58-day-old narrative and the June
central-bank text keep publishing**.

The same file **already fixed this exact bug once**: `global_news.json` got a 24h age-out
(`GLOBAL_NEWS_MAX_AGE_H`) with a comment describing seven weeks of repeated headlines. That one is
fresh today.

### 2. `maplegamma-data.json` publishes SPY data under a `tickers.SPX` key

```
"tickers": { "SPX": { "current_price": 736.69, "gamma_flip": 749.38,
                      "floor_zone": { "strike": 730.0 }, ... } }
```
SPX is **7,419** today (`latest.json`). Every value in that object is SPY-scale.

The **frontend already compensates** — `src/lib/schemas/market.ts:252-262` hardcodes `ticker: 'SPY'`
with a do-not-revert comment, and `src/app/options/page.tsx:5` was corrected to match. So human
visitors see correct labels. **Agent and Pi-side consumers do not:**

- This is precisely what produced the audit's false *"GEX data 15d stale — gamma floor $750 calculated
  at SPX 7575, real SPX now ~7412"*. The model read a SPY level under an SPX key, saw it didn't match
  spot, and inferred staleness. The data was ~21h old.
- `maplegamma_council.py:132` reads `tickers.SPX` and feeds `spot: 736.69` into the LLM council prompt
  with no disambiguation.

The writer is `push_gex.py`; `market.ts:260` correctly identifies the defect as living there.

### 3. `llms.txt` under-declares the open endpoints

Seven endpoints return HTTP 200 to anonymous requests but are **missing from the "Open data endpoints"
list** that the audit skill treats as authoritative: `screener-lite.json`, `options-status.json`,
`crypto-cohorts.json`, `briefing-intel.json`, `twitter-intel.json`, `archive-index.json`,
`gex_data.json`. (`options-status` and `crypto-cohorts` *are* mentioned in the prose — "Options-strategy
and crypto-cohort previews are currently public" — but with no URLs, so a browserless agent cannot fetch
them. `screener-lite.json` and `gex_data.json` are not mentioned anywhere.)

Direct consequence: the audit's *"Screener — fully gated, no free tier access, can't verify if pipeline
even runs, 🔴 CRITICAL"* is **wrong**. `/data/screener-lite.json` is public, fresh (Jul 27 14:50 UTC)
and carries 1,680 tickers. The agent followed `llms.txt` as instructed and never looked.

Separately, `/data/gex_data.json` serves 200 OK but was generated **June 11** (46d). The skill file
flagged it on Jul 9 as *"abandoned — either restore the pipeline or remove the endpoint"*; it is still
being served.

---

## FALSE — measured against the blobs the site actually served at 04:21 Jul 27

| Audit claim | Actual |
|---|---|
| Verdict 17d stale, `heuristic_fallback` calibration | `2026-07-24T11:20:01Z` (last weekday), `conviction_source: "model"` |
| maplegamma-data.json Jul 12 ✗ / 15d stale | `2026-07-26T07:22:37` — ~21h |
| reddit-sentiment stale ≥15d | `2026-07-26 07:22` — ~21h |
| "3 of 5 open endpoints stale ≥15d" | 0 of 5. All were Jul 24–26 |
| "All froze ~Jul 10-12 → likely Pi cron failure" | No freeze. Unbroken weekday commits through Jul 27 |

Verified by `git show <commit>:data/<file>` on the blobs published before the audit ran, and by
re-fetching every endpoint **from the Pi itself**. `heuristic_fallback` is a real value
`generate_verdict.py` can emit, but it was not the value on any of these runs.

CDN caching is ruled out: `cf-cache-status: DYNAMIC`,
`cache-control: public, max-age=0, must-revalidate`.

---

## BY DESIGN — not defects

The audit rates these 🔴 CRITICAL three times; they are the paywall working as documented in `llms.txt`
since the Jul 14 gating transition.

| Endpoint | Status |
|---|---|
| `/api/data/{paper_trades,accuracy,prediction-engine,screener-data,walk_forward_v2}.json` | `401` |
| `/data/{paper_trades,accuracy,prediction-engine}.json` | `404` + SPA fallback HTML |

Research walk-forward / `walk_forward_v2` / `strategy_improvement` being paywalled is the same thing.

**PART 2 (ML feasibility) is not analysis** — Q1–Q5 are reproduced verbatim from the skill file's own
"ML feasibility analysis rules" section, including the "135K × 15 features in ~30s" figure. The model
correctly flags that it could not revalidate them. There is no new information in Part 2.

**Three-account ambiguity** — $1,178 (May 30 narrative) vs $87,845.61 (paper ledger, Jul 24 close) vs
$1,987 (`accuracy.json`, June 3). This is the skill's own documented "three-account ambiguity"; not
investigated here.

---

## Suggested fixes, highest leverage first

1. **Deploy `pi-scripts/` → `~/.hermes/scripts/`, and find out why that step isn't running.** The
   hardening commit landed Jul 26 and never reached the executing path; `push_dashboard.py` has drifted
   too. Until this is understood, any fix written in this repo may silently not take effect — which
   makes every item below conditional on it.
2. **Fix the audit job.** Strip the dated prior-audit claims out of `finance/daily-briefing-system`, or
   every future report stays untrustworthy. The "progressive staleness" pitfall in particular instructs
   the model to *compute* an age from a hardcoded anchor instead of reading `generated_at`. Also rename
   the job — it says Fable 5, it runs `deepseek-v4-pro`.
3. **Guard the two reads the hardening commit missed** — `pipeline_synthesis.txt` (line 123) and the
   `central_banks` hardcoded fallback (line 270). Prefer *dropping* the field when the source is stale
   over shipping May data: an absent narrative is honest, a 58-day-old one is not.
4. **Restore or delete the premarket scanner.** Nothing under `~/.hermes` writes `premarket_scan.json`,
   and the `~/.hermes/scripts` git history never contained a producer.
5. **Fix the `SPX` key in `push_gex.py`** → `SPY`, then remove the compensating shim in
   `src/lib/schemas/market.ts:252-262` and fix `maplegamma_council.py:132`.
6. **Add the undeclared public endpoints to the `llms.txt` endpoint list**; retire or restore
   `gex_data.json` (46d stale, still served).
