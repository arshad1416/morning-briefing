# Positions staleness: schedule-aware replacement for `staleDays > 2`

**APPLIED 2026-08-22** — the live module is `src/lib/staleness.ts`, the suite
runs as `npm run check:staleness` (`scripts/check-staleness-rule.mts`, which
imports the real module so it cannot drift), and `mutate.sh` mutates the real
module. The staged `.proposed` artifacts and `run_tests.sh` are deleted now
that the real files carry the logic; what remains here is the design history.

## The bug

`src/app/positions/positions-client.tsx` decided staleness with:

```js
// The refresh is daily, so >2d means runs are failing, not that it is a weekend.
const isStale = staleDays != null && staleDays > 2;
```

The comment's premise is false. The agent's cron is:

```
12 7 * * 1-5     # weekdays only, America/Toronto
```

so on a **healthy** system the newest write on a Sunday afternoon is Friday
07:12, which is more than two days old. The banner therefore fired every week
from roughly Sunday 08:00 until Monday 07:12, telling paying subscribers
*"These figures are 2 days old, the brokerage feed stopped updating"* while
nothing was wrong.

Measured, not estimated. The suite (`scripts/check-staleness-rule.mts`)
simulates a full healthy year hour by hour and runs the old rule over the same
data:

```
old rule on the same data: 1248 false-alarm hours (~24.0h/week)
```

That is an independent confirmation of the ~23 h/week figure derived by hand,
from a different method.

It self-clears every Monday morning, which is why it survived unnoticed: anyone
checking on a weekday sees a healthy page.

## Why raising the threshold cannot work

The legitimate Friday→Monday gap is **72 h**, but the customer-facing warning
needs to fire well before that. Any constant that is quiet on weekends is too
slow on weekdays, and vice versa. No single age cutoff satisfies both, so the
rule has to know the schedule.

## The fix

Count **missed scheduled runs** instead of elapsed days.

- `missedScheduledRuns(asOf, now, tz)` counts weekday 07:12 America/Toronto
  boundaries crossed since `asOf`. Returns 0 all weekend on a healthy system.
- `assessStaleness(asOfIso, now, tz)` returns `{ isStale, missedRuns, ageDays }`
  and flags stale at **2 missed runs**.

One missed run is tolerated on purpose: a single transient failure self-heals
the next morning, and the operator is already alerted by the daily Telegram
path (§18.2). The customer does not need a warning about something already
being handled.

## Verification

```bash
npm run check:staleness   # 34 assertions
./mutate.sh               # 9 killed, 2 documented-equivalent survivors
```

`npm run check:staleness` output:

```
  34 passed, 0 failed
  healthy-year sweep: 8760 hourly samples, 0 false alarms
  old rule on the same data: 1248 false-alarm hours (~24.0h/week)
```

The suite deliberately **runs the old rule too** and asserts it *does*
false-alarm. A test that cannot fail proves nothing, so the regression test
demonstrates it catches the very bug being fixed.

Both scripts are self-checking:

- `mutate.sh` runs the unmutated original first and aborts if it fails, because
  a broken runner would otherwise report every mutant as "killed". This is not
  hypothetical: it happened during development when `tsx` refused a staged
  `.proposed` extension and the harness cheerfully reported 11/11 killed.
- It also fails on `pattern-not-found`, since a mutation whose pattern has
  drifted silently stops testing anything.

Two mutants survive and are expected to. Both are **equivalent mutants**, proven
unreachable rather than untested:

| Mutant | Why it cannot be killed |
| --- | --- |
| `scheduled > asOf` → `>=` | the loop advances a full calendar day before its first comparison, so equality never occurs |
| remove the `now <= asOf` clamp | with `now < asOf` the first scheduled instant already exceeds `now`, so the loop breaks and returns 0 anyway |

## How it was applied

1. `src/lib/staleness.ts` carries the rule.
2. `src/app/positions/positions-client.tsx` was patched:

```diff
+import { assessStaleness } from '@/lib/staleness';
+
 const asOf = account.data?.timestamp ?? positions.data?.timestamp ?? null;
 const asOfMs = asOf ? Date.parse(String(asOf)) : NaN;
-const staleDays = Number.isNaN(asOfMs) ? null : (Date.now() - asOfMs) / 86_400_000;
-// The refresh is daily, so >2d means runs are failing, not that it is a weekend.
-const isStale = staleDays != null && staleDays > 2;
+// Schedule-aware: the cron is `12 7 * * 1-5`, weekdays only, so raw age lies
+// every weekend (see docs/positions_staleness/README.md).
+const { isStale, missedRuns } = assessStaleness(asOf, new Date());
+const staleDays = Number.isNaN(asOfMs) ? null : (Date.now() - asOfMs) / 86_400_000;
```

3. The banner wording should stop quoting a day count, which is the number that
   was misleading:

```diff
-  These figures are {Math.floor(staleDays as number)} days old — the brokerage feed stopped
-  updating after {String(asOf).slice(0, 10)}. Everything below is that day&apos;s snapshot,
-  not your account today.
+  These figures are from {String(asOf).slice(0, 10)} — the brokerage feed has missed{' '}
+  {missedRuns} scheduled updates. Everything below is that day&apos;s snapshot, not your
+  account today.
```

This exact integration was typechecked against the real page with
`npx tsc --noEmit`: clean.

## A note on the staged `.proposed` files

While this fix was staged rather than applied, the module and its suite lived
here with a `.proposed` suffix. That was not cosmetic: `tsconfig.json` has
`include: ["**/*.ts"]`, so a committed `.ts` file under `docs/` would join the
production typecheck and break `npm run build`. The suffix kept them out of the
build, and the runner materialized real `.ts` copies in a temp dir.

Now that the fix is applied, the module is real code at `src/lib/staleness.ts`
and the suite is `scripts/check-staleness-rule.mts` (a `.mts`, matching
`check-published-contracts.mts`). The staged copies were deleted rather than
kept: a duplicate of shipped logic sitting in `docs/` is something a later
refactor silently leaves behind, and the suite now imports the real module so
it cannot drift from it.

## Known limitation

Market holidays are not modelled, but the cost is smaller than it first looks,
and I had it wrong before measuring it.

A **single** weekday holiday is free. Simulating all of 2026 hour by hour for a
healthy agent that also skips the nine weekday market holidays gives:

```
0 banner hours out of 8760
```

That is because the 2-missed-run threshold already absorbs one skipped day, the
same tolerance that covers a single transient failure.

The case that does misfire is **two consecutive** weekday closures. With the
last run on Wed and Thu+Fri both closed:

```
Thu 12:00 (hol 1)      missed=1  banner=false
Fri 08:00 (hol 2)      missed=2  banner=true
Sat/Sun                missed=2  banner=true
Mon 07:00 (pre-run)    missed=2  banner=true
```

so the banner shows falsely from Friday morning until Monday's run, about 72 h.
That configuration is rare (US/CA markets almost never close two weekdays in a
row), and it errs toward warning rather than staying silent during a real
outage.

**A correction worth recording:** my first attempt at this measurement reported
436 false-alarm hours a year, and I nearly wrote it down. The probe was wrong,
not the code: it held `asOf` frozen for 96 h after each holiday, which models an
agent that never runs again rather than one that resumes the next morning. The
bug flattered the *old* rule's replacement by inventing a cost that does not
exist. Fixing the simulation to let the agent resume gave 0. Same class of
mistake as measuring coverage against the wrong page: a simulation whose
premise is wrong produces a confident, specific, entirely fictional number.

The clean fix is to have the agent write a `next_expected` timestamp into the
envelope so the UI stops duplicating the schedule at all. That also removes the consecutive-holiday case for free, since
the agent knows the trading calendar and the browser does not. Worth doing when
the IBKR feed work lands.
