# Audit of Hermes (DeepSeek V4 Flash) paper-trading investigation
**Date:** 2026-08-05 · **Method:** 14 agents (7 evidence sweeps + 7 adversarial re-checks), all against the live Pi, read-only.

> **On the method's own reliability.** The adversarial layer caught real errors (see the corrections
> marked throughout), but it is not infallible: one sweep claimed five 10-entry batches including Jul 8,
> its adversary *upheld* that claim, and both were wrong — `Entered:` at log lines 493/767/1111 reads
> `0` for Jul 8/9/10, and the `✅ ENTERED` count is 40 = 4×10. I resolved it by direct grep. Treat the
> verdicts here as evidence-backed, not as consensus-backed.

---

## Bottom line

Hermes correctly identified that the trader is not entering. It then attached that symptom to
a **fabricated cause** (frozen exits) and missed the **actual mechanism**, which is a stale-snapshot
ordering bug — and missed a **critical premium-data leak** in the public GitHub repo's history.

C3 is dead. C2 is right for an incomplete reason. The single most important finding in this whole
system was not in Hermes's report at all.

---

## Verdict table

| # | Hermes's conclusion | Verdict |
|---|---|---|
| C1 | Pipeline mechanically alive; push→R2→Worker gate→site works end-to-end | **PARTIALLY CORRECT** — HTTP path verified; the *distribution* path leaks |
| C2 | Portfolio-limit gate checked once before the loop; trader frozen since Aug 4 | **PARTIALLY CORRECT** — mechanism right, dates wrong, root cause incomplete |
| C3 | Exits are disabled; only a −15% crash can close the 8 positions | **INCORRECT** |
| C4 | Dashboard integrity issues (a–d) | **PARTIALLY CORRECT** — all four real; (a) badly understated, (d) right for the wrong reason |
| C5 | Peripheral systems running but idle; TSLA reconciled | **PARTIALLY CORRECT** — day trader is not peripheral |
| C6 | $100K → $89.6K (−10.4%), 55 closed, 45.5% WR | **CORRECT** but not corroborable at trade level |

---

## 1. C3 is refuted — the decisive evidence

`~/.hermes/scripts/run_exit_check.py` exists and is cron'd:

```
11,26,41,56 9-16 * * 1-5  cd ~/.hermes/scripts && flock -n /tmp/exit_check.lock python3 run_exit_check.py
```

It calls all three sweeps directly:

```python
sweeps = (
    ("stock_exit_sweep",  pt.check_trade_exits),   # 3% stop, 4/5% target, 3/5-day timestop
    ("safety_stop_sweep", pt.check_stop_losses),   # -15% backstop
    ("option_exit_sweep", pt.check_option_exits),
)
```

Its own docstring: *"This is the ONLY thing that runs exits on a timer — check_trade_exits() otherwise
only fires when a new trade is entered, which is why stale positions ran unmanaged."* The exact problem
Hermes describes was already found and fixed.

Running today, on a gate-blocked day:

```
exit_check_status.json:
  last_market_open_success_at = 2026-08-05T11:26:01-04:00
  overall_status = ok
  stock_exit_sweep ok · safety_stop_sweep ok · option_exit_sweep ok · policy_snapshot open_count 8
```

**The kill shot:** the two exits Hermes cited as *history* were produced by this sweeper, one of them
*after* the entry gate began blocking:

```
2026-08-03T09:41:01-04:00 EXIT AMZN target +5.4%
2026-08-04T11:56:01-04:00 EXIT ABBV stop  -3.2%
```

ABBV's rationale string is `"STOP: Hard stop hit at -3.2% (limit 3%)"` — emitted by
`check_trade_exits` (paper_trading.py:338), *not* the `"Stop-loss triggered at -15%"` literal at :921.
So "only a −15% crash can close them" is false on its own terms.

**Answering stress-test 2a directly:** the process is neither the council executor, the sleeve, nor
traderdev_bridge. It is `run_exit_check.py`, a job Hermes never found. **Why it was missed:**
`run_exit_check.py` does not exist in `pi-scripts/`, and `pi-scripts/crontab.txt` — a stale snapshot —
has no exit_check line. Anyone reasoning from the repo copy reaches Hermes's conclusion. AGENTS.md
rule 4 warns about exactly this.

C3's *sub-claims* are individually correct (the daily run only calls `check_stop_losses`;
`check_trade_exits` does live inside `enter_trade`; the gate's bare `return` does prevent reaching it).
The error is the inference: automated_paper_trader.py is not the only scheduled process touching the ledger.

**Forward projection (verified against `get_max_hold_days` + calendar):**
JPM/V/CPER (max_hold 3) time-stop **Thu Aug 6**; IWM/SPY/XLF/XLE/XLP (max_hold 5) hit threshold Sat
Aug 8, so the first weekday sweep closes them **Mon Aug 10** at days_held=7. The 07:05 trader on Aug 10
still sees 5 open and blocks; **entries resume Tue Aug 11** — absent an earlier target/stop.

---

## 2. C2 — right mechanism, wrong dates, incomplete root cause

**Confirmed:** `MAX_PORTFOLIO_POSITIONS = 5` (line 18) is checked once at lines 225-229 and `return`s
before the entry loop at 235. Nothing inside the loop re-checks the count.

**Alternative explanations tested (stress-test 2b):**
- *Stale ledger read?* **Refuted** — the read is fresh.
- *Did `check_trade_exits` inside the first `enter_trade` reset the count?* **Confirmed** — it
  timestopped IWM/XLF/XLU/TSLA mid-run. Hence `Open positions: 10 (was 4)`, not `(was 14)`.
- *Did a different constant cap it at exactly 10?* **Confirmed** — `paper_trading.py:494`
  `MAX_OPEN_POSITIONS = 10`. Ten entered, twelve rejected on it. **Hermes never identified the constraint
  that actually bound the run.**

**Two factual errors:**

1. **Aug 4 never printed "Portfolio limit reached (5)".** Hermes's evidence line for Aug 4 is Aug 5's
   output. Derived run boundaries (headers at 4362 / 4926 / 5127, EOF 5248): the Aug 4 run has **no**
   `Validated signals:` line and terminates at `No signals passed 4-invariant validation`. It died on a
   total NaN price blackout. *Correction scope:* Aug 4 opened at 9 open, so the gate would have blocked
   it anyway — the outcome was the same, the stated cause was not.
2. **Not new since Aug 4.** The gate has fired on **11 runs since 2026-07-15**. Four 10-entry batches:
   **Jul 14, Jul 21, Jul 28, Aug 3** (`Entered:` at log lines 1783/2879/3915/4917; `✅ ENTERED` count 40 = 4×10).
   Jul 8/9/10 printed `Entered: 0`. This is a ~weekly sawtooth, not an incident.

**The root cause Hermes did not reach — ordering, not just loop-invariance:**
The gate reads a position count taken *before* the only code that frees slots. `check_trade_exits`
runs inside `enter_trade`, strictly downstream of the gate. Aug 3 traded only because it happened to
open at 4. This is one architectural defect with two symptoms: a stale count blocks runs that
shouldn't be blocked, and an un-rechecked loop lets 10 in when the cap says 5.

**The fix forks — and Hermes's framing would send you the wrong way.** The script's own docstring
("4-invariant signal validation *replaces* hard position limits") and its summary prints
(`Position Limits: Correlation-adjusted (hard caps removed)`, `Daily Trade Cap: Removed`) contradict
the live constants at lines 16-18. Deciding between "enforce 5", "enforce 10", or "delete both and
trust the invariants" is a design call, not a bug fix. Note the third option is only safe *after* the
ordering fix: the invariant layer is not wrong, it is evaluated pre-loop (§3), so it cannot currently
carry the load the docstring assigns it. Fix the ordering and the invariants would bind as designed.

---

## 3. What Hermes missed — ranked

### CRITICAL — Premium data is anonymously readable from the public repo's git history
`arshad1416/morning-briefing` is **PUBLIC**. `.gitignore` + `git rm --cached` do not rewrite history:

```
curl https://raw.githubusercontent.com/arshad1416/morning-briefing/c45ef537.../public/data/paper_trades.json
→ HTTP 200, 5548 bytes, live portfolio payload
```

`paper_trades.json` in **1,231 commits**; `prediction-engine.json` 1,081; plus 18 more gated files.
Only 5 of 25 `PRIVATE_FILES` were never committed. Additionally **60 Pro-gated `charts/*.json`** and
**22 `sec/*.json`** were tracked until Jul 9 and are retrievable today — neither appears in
`PRIVATE_FILES` nor in the repo's CI guard, which iterates the 25 names only.

Root incident, proven: commit `804a87200` (Jul 11) added *both* `.gitignore` lines but only removed
`data/paper_trades.json`. The `public/` copy survived until `c71c4aa21` the next morning — **~8 hours
serving the live ledger on Pages to anyone.** `scripts/check_premium_registration.py` would still pass
that commit; it verifies the .gitignore lines exist, not that the tracked file was removed.

*Scope, stated fairly:* content is simulated paper-trading and generated analysis JSON through
~Jul 12–22. **No PII, no credentials, no customer data.** The exposure is subscriber value, not safety.
Hermes's C1 is true of the HTTP path and blind to the distribution path.

### CRITICAL — The invariant layer has the same defect as the constants
`signal_validator` is called for **all** candidates in Step 5.5, before any entry, and the entry loop
never re-validates. The observed consequence on Aug 3: `MAX_IN_HIGH_GROUP = 2`, yet **JPM, V and XLF
all entered as `group=financial`** — three positions in a correlated group capped at two. Each passed
because the pre-batch snapshot showed only one financial. **Moving `MAX_PORTFOLIO_POSITIONS` inside the
loop fixes Hermes's symptom and leaves this breach in place.** Every gate in the pipeline is evaluated
against the pre-batch book; exactly one *count* cap (`MAX_OPEN_POSITIONS`) is evaluated live.

*Stated deliberately as the observed breach only.* Two agents produced conflicting counterfactuals for
what per-entry evaluation would have blocked (they disagree on which financial trips the cap first,
because `check_trade_exits` closes the pre-existing Jul-28 XLF mid-run). The observed 3-against-2 is
enough to support the conclusion; the counterfactual is not needed and is not asserted.

*Corrected during adversarial review:* the accompanying "portfolio risk 15% vs a 6% cap" claim is
**false**. Those `risk=` log figures are the validator's unadjusted share counts; the trader shrinks
every order twice (calibration ×0.63, then the 10%-notional cap: AMZN 74→32, SPY 74→11, XLF 923→153).
Every open position has `stop_loss: None`, so the risk fallback is 3% of notional — derived from the
ledger by arithmetic, not by executing anything: 0.03 × 69,383.92 = **$2,081.52 / $88,636.86 = 2.35%**,
under half the 6% cap. The risk cap was not breached; the correlation cap was.

### CRITICAL — The dashboard publishes two contradictory unrealized P&Ls
Header tile `unrealized_pnl` uses the ledger's booked basis; the eight table rows use a re-fetched
yfinance close. The gap is **exactly $310.85**, and it is price-invariant — reproduced at two different
30-minute snapshots (995.19−684.34 and 853.26−542.41). A subscriber who adds the P&L column gets a
number ~45% below the tile above it. Per-position: **V is off by $236.40, SPY by $103.29, XLP displays
$0.00 P&L where the real figure is a loss.**

This is not "approximate" (C4a). It is two incompatible cost bases in one gated object, and it is
precisely the failure AGENTS.md rule 6 warns about.

### CRITICAL — The 3% price gate measures distance, not age
At 07:05 pre-market, `get_current_price()` returns the previous session's close — the same data family
the signal price comes from. **IWM was booked at 296.19, the 2026-07-07 close — 19 trading sessions
old — and the gate read only 1.7%.** Nothing anywhere in the entry path compares the signal's own date
against the booking date.

*Corrected during adversarial review:* the claim that a `0.0% diff` reading is "the fingerprint of
maximum staleness" is **inverted** — 0.0% means the signal equals the freshest existing bar. The
surviving, verified half is that the gate cannot see age at all.

### HIGH — Aug 4's NaN blackout, and two fail-open guards
On Aug 4 all 60 tickers returned `market=$nan`, and the sanity gate **passed all 60** (`Valid signals: 60`,
the highest in the 27-run log) because every comparison against NaN is False. Same pattern Jul 29.
The run was saved only incidentally, by the downstream regime check also comparing against NaN.

Relatedly, `check_stop_losses` skips any position whose price fetch returns None, and the caller then
prints **"No stops triggered"** — indistinguishable from "checked, all fine". Aug 4 printed it for all
9 positions. *Scope:* `fetch_price` demonstrably worked that day (ABBV closed at 11:56 on a live quote),
so this is code-path fragility, not an observed failure.

### HIGH — Concurrency: an archival job can freeze the whole trading estate
`save_ledger()` is an unguarded, non-atomic read-modify-write. `archive_trades_to_turso.py` (`0 8 * * 1-5`)
truncates the ledger then streams ~6KB, while `trading_recovery.py` (`*/5`) reads it at minute 0 —
the same minute. A torn read fails **closed**: `blocks_entries=True` writes `trading_entry_block.json`,
which gates `enter_trade` for *every* strategy. The block file records a real 20-minute freeze on Aug 4
(different issue code, so the specific race is untriggered, not impossible). One-line fix each side:
tmp + `os.replace`.

### HIGH — The 08:00 prune silently voids two risk controls
Emptying `closed_trades` blinds the 3-day re-entry cooldown and the 30-day loser blacklist, both of
which iterate that list. For the two post-08:00 entry systems (sleeve, day trader) these gates can
**never** fire — the day trader could re-buy a name stopped out an hour earlier. Same prune is the
cause of C4c's empty `recent_trades`, and it also zeroes a *second* gated page: `prediction-engine.json`
publishes **0% win rate / 0 closed trades** for the same account that `/positions` shows at 45.5% / 55.

### HIGH — Realized P&L is not corroborable at trade level
Turso holds **48** rows summing **+1,871.71**, against 55 reported closes and a reported realized
**−11,363.14**. Seven closes have no archived row, carrying an implied **−13,234.85** — more than the
entire reported loss. Archiving began 2026-07-01; the account was created 2026-06-12, so ~19 days were
pruned before archiving existed. The headline −10.4% rests on a single running counter.
*Partly recoverable:* `data/paper_trades.json` was git-tracked from 2026-06-03 until Jul 11, so ~400
historical pushes survive in the public history — the same leak above is also the forensic record.

### MEDIUM — C5 understates the day trader
`intraday_day_trader.py` is **not** peripheral: it calls `enter_trade` and `close_trade` against the
same shared ledger. Its budget is separate (`STRATEGY_POSITION_BUDGET = {"day-trader-v1": 3}` on top of
the shared 10), so the freeze is **local to `automated_paper_trader.py`**, not system-wide — an
important scoping correction in Hermes's favour that Hermes did not make. Also: the enumeration of
ledger writers is incomplete — there is a **second scheduler**, `~/.hermes/cron/jobs.json` (16 enabled
jobs), two of which touch the ledger.

### MEDIUM — C4d is right for the wrong reason
`type: "ETF"` on JPM and V is straightforwardly wrong. **CPER is not** — it is a real copper ETF, absent
from both `COMMODITY_TICKERS` and `KNOWN_ETF_TICKERS`, so it falls through to `"stock"` and gets a
3-day hold. The dashboard is accidentally right and the **ledger** is wrong. Whether fixing it changes
the hold depends on which set it is added to (the 5-day hold is gated on `etf`, not `commodity`).
Hermes repeated the ledger's classification as fact.

### 2e — the ImportError era, answered
Six consecutive runs (Jun 30 – Jul 7) died on `ImportError: load_ledger`. A seventh (Jul 13) crashed
with an `AttributeError` *inside the newly-added limit block itself*, after completing the full pipeline
to `Validated signals: 19`. And the pre-Jul-13 gate counted `ledger_data.get("entries", [])` — a key the
ledger has never had — so **both hard limits were silent no-ops before Jul 13**. The Jul 13 edit fixed
the key name and left the ordering/loop defect in place: an incomplete fix, which is why the code
comment at line 213 cites a Jul 8 incident.

**Only 4 of 27 logged runs ever entered a trade (14.8%).** Asserting the system "works" is overclaiming.

---

## 4. Arithmetic (stress-test 2d) — all reconciles

Every chain closes to the cent, independently recomputed:

- Σ(qty × entry_price) over 8 positions = **69,383.92** = dashboard `invested` ✓
- 19,252.94 + 69,383.92 = **88,636.86** ✓ *(definitional — `_sync_account_balance` computes it)*
- 100,000 − 11,363.14 = **88,636.86** ✓ *(genuine independent check)*
- **Aug 4→5:** ABBV 35 × 250.94 = 8,782.90; 10,747.07 + 8,782.90 − 277.03 = **19,252.94**, residual **0.00** ✓
- **Aug 3:** 62,286.92 → 4 closes → 10 entries → AMZN close = 10,747.07, residual **0.00** at every step ✓
- Position chain 4 → −4 → +10 → −AMZN = 9 → −ABBV = 8 ✓
- 63 − 8 = 55 = 25W + 30L; win_rate 45.5 = 25/55 ✓
- All four dashboard identities hold — **and all four are definitional**, not independent checks.

The numbers are internally immaculate. That is exactly why the §3 findings matter: consistency here
says nothing about whether the *basis* is right, and it isn't.

---

## 5. Bottom line — is live paper trading "working"?

**Mechanically alive, directionally unreliable, and its published output is wrong in ways a paying
subscriber can detect with a calculator.**

- **Working:** crons fire; the exit sweeper runs every 15 min and demonstrably closes positions; the
  Worker gate returns 401 anonymously; R2 sync is complete (82 = 22 private + 60 charts, 0 failed);
  the ledger reconciles to the cent.
- **Not working:** the entry path has fired on 4 of 27 runs; every gate that matters is evaluated
  against a pre-batch snapshot, so the book oscillates between 10 (double the stated cap) and frozen;
  positions are booked at prices up to 19 sessions stale that no one could have transacted at; two
  premium pages publish contradictory numbers for the same account; and the paywall is bypassable
  through the public repo's git history.

**Fix first — the pre-batch snapshot pattern.** The entry gate, the stale position count, and the
un-enforced correlation cap are one architectural bug, not three. It is live, it is mispricing the book
right now, and until it is fixed the invariant layer cannot be trusted to replace the hard caps the
docstring says it replaced.

**Fix second — the recurrence guard, not the history.** On the leak: there is nothing to *rotate* —
no credentials, no PII, no customer data, and the exposed content is simulated trading JSON that has
been stale since ~Jul 22. A history rewrite is also a poor trade here: `main` receives machine-generated
Pi commits every ~30 minutes during market hours and every push burns a Pages build against a 500/month
quota, so force-pushing a rewritten branch under a live cron writer is genuinely destructive for content
whose value has already decayed. The defensible call is to decide whether that content still has value —
and if not, close it as accepted-and-decayed — while fixing what allows recurrence:
`scripts/check_premium_registration.py` verifies that the `.gitignore` lines exist, not that the file was
actually untracked, which is exactly why commit `804a87200` passed while leaving the public copy live for
8 hours. That guard gap is the finding worth acting on; extend it to `charts/` and `sec/`, which no guard
covers at all.

All Pi access in this audit was read-only; no file, process, or scheduled job was modified.
