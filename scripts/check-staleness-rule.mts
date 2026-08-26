/**
 * Does the IBKR staleness banner still follow the agent's actual schedule?
 *
 * The rule it guards used to be `staleDays > 2`, justified by "the refresh is
 * daily" — but the agent's cron is `12 7 * * 1-5` (weekdays only), so on a
 * HEALTHY system the banner fired every week from ~Sunday 08:00 until Monday
 * 07:12, telling paying subscribers the brokerage feed had stopped updating.
 * That bug was invisible to spot-checks: it only misfired on Sunday
 * afternoons, so anyone testing on a weekday saw a healthy page.
 *
 * The central check here is therefore not a handful of cases — it simulates a
 * FULL YEAR of a perfectly healthy system, hour by hour (both DST transitions
 * included), and asserts the banner never once appears. It also runs the
 * replaced >2d rule over the same year and asserts it DOES false-alarm
 * (~24h/week): a test that cannot fail proves nothing.
 *
 * This imports the REAL module (src/lib/staleness.ts) rather than a copy, so
 * it cannot drift from what the site actually runs. See
 * docs/positions_staleness/ for the design history and the mutation harness
 * (mutate.sh) that proves these assertions can go red.
 *
 *   npm run check:staleness
 */
import { assessStaleness, missedScheduledRuns } from '../src/lib/staleness';

const TZ = 'America/Toronto';
let pass = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; } else { failures.push(`${name}${detail ? ` -- ${detail}` : ''}`); }
}

/** Wall-clock parts in the agent tz, for readable failure messages. */
function label(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, weekday: 'short', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

function tzParts(d: Date) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(d)) if (p.type !== 'literal') o[p.type] = p.value;
  return { weekday: o.weekday, hour: Number(o.hour) % 24, minute: Number(o.minute) };
}

const IDX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// ---------------------------------------------------------------------------
// 1. THE REGRESSION TEST: a full healthy year must never show the banner.
// ---------------------------------------------------------------------------
// Model a healthy system: at any instant, the newest file is from the most
// recent weekday 07:12 that has already passed.
function lastHealthyRun(now: Date): Date {
  const cursor = new Date(now.getTime());
  for (let i = 0; i < 14; i++) {
    const p = tzParts(cursor);
    const isWeekday = IDX[p.weekday] >= 1 && IDX[p.weekday] <= 5;
    const past = p.hour > 7 || (p.hour === 7 && p.minute >= 12);
    if (isWeekday && past) {
      // build that day's 07:12
      const d = new Date(cursor.getTime());
      const cur = tzParts(d);
      const deltaMin = (cur.hour * 60 + cur.minute) - (7 * 60 + 12);
      return new Date(d.getTime() - deltaMin * 60_000);
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    // move to late in that day so the "past" test can succeed
    const c = tzParts(cursor);
    cursor.setTime(cursor.getTime() + (23 - c.hour) * 3_600_000);
  }
  throw new Error('no healthy run found');
}

let healthyHours = 0;
let falseAlarms = 0;
const falseAlarmSamples: string[] = [];

// 2026-01-01 through 2026-12-31, every hour. Covers DST start (Mar 8) and
// end (Nov 1) in America/Toronto.
const start = Date.UTC(2026, 0, 1, 0, 0, 0);
const end = Date.UTC(2027, 0, 1, 0, 0, 0);
for (let t = start; t < end; t += 3_600_000) {
  const now = new Date(t);
  const asOf = lastHealthyRun(now);
  const v = assessStaleness(asOf.toISOString(), now, TZ);
  healthyHours++;
  if (v.isStale) {
    falseAlarms++;
    if (falseAlarmSamples.length < 5) falseAlarmSamples.push(label(now));
  }
}
check(
  'healthy system never shows the banner (8760 hourly samples across 2026)',
  falseAlarms === 0,
  `${falseAlarms}/${healthyHours} hours false-alarmed, e.g. ${falseAlarmSamples.join('; ')}`,
);

// ---------------------------------------------------------------------------
// 2. PROVE THE OLD LOGIC FAILS THE SAME TEST.
// A test that cannot fail proves nothing, so run the replaced rule and confirm
// it does light up -- and roughly when §18.6 predicted (~23h/week => ~1200h/yr).
// ---------------------------------------------------------------------------
let oldFalseAlarms = 0;
for (let t = start; t < end; t += 3_600_000) {
  const now = new Date(t);
  const asOf = lastHealthyRun(now);
  const staleDays = (now.getTime() - asOf.getTime()) / 86_400_000;
  if (staleDays > 2) oldFalseAlarms++; // the old rule
}
check(
  'old >2d rule DOES false-alarm on the same healthy year (test can fail)',
  oldFalseAlarms > 0,
  `old rule fired ${oldFalseAlarms}h`,
);
check(
  'old rule false-alarm volume matches the ~23h/week estimate in §18.6',
  oldFalseAlarms > 900 && oldFalseAlarms < 1500,
  `got ${oldFalseAlarms}h/yr (~${(oldFalseAlarms / 52).toFixed(1)}h per week)`,
);

// ---------------------------------------------------------------------------
// 3. A REAL OUTAGE MUST STILL BE CAUGHT.
// ---------------------------------------------------------------------------
// The actual incident: last write Wed 2026-08-19 07:12 EDT.
const outageAsOf = '2026-08-19T07:12:00-04:00';
// Thu 08-20 08:00: one run (Thu) missed -> tolerated, operator already alerted.
check(
  'one missed run does not alarm the customer',
  assessStaleness(outageAsOf, new Date('2026-08-20T08:00:00-04:00'), TZ).isStale === false,
);
// Fri 08-21 08:00: Thu + Fri missed -> genuine outage, banner on.
const day2 = assessStaleness(outageAsOf, new Date('2026-08-21T08:00:00-04:00'), TZ);
check('two missed runs alarms', day2.isStale === true, JSON.stringify(day2));
check('two missed runs counted exactly', day2.missedRuns === 2, `got ${day2.missedRuns}`);
// The current real moment, days into the outage: must be loudly stale.
const nowish = assessStaleness(outageAsOf, new Date('2026-08-21T16:18:00-04:00'), TZ);
check('the live incident reads as stale', nowish.isStale === true);

// A long outage keeps counting business days only, never weekend days.
const longOut = assessStaleness(outageAsOf, new Date('2026-08-31T08:00:00-04:00'), TZ);
// Thu20 Fri21 Mon24 Tue25 Wed26 Thu27 Fri28 Mon31 = 8
check('long outage counts business days only', longOut.missedRuns === 8, `got ${longOut.missedRuns}`);

// ---------------------------------------------------------------------------
// 4. WEEKEND BOUNDARY, the exact window that used to misfire.
// ---------------------------------------------------------------------------
const fri = '2026-08-14T07:12:00-04:00'; // healthy Friday write
for (const [when, iso] of [
  ['Sat 12:00', '2026-08-15T12:00:00-04:00'],
  ['Sun 08:00', '2026-08-16T08:00:00-04:00'], // old rule started lying here
  ['Sun 23:00', '2026-08-16T23:00:00-04:00'],
  ['Mon 07:00', '2026-08-17T07:00:00-04:00'], // still before the run
] as const) {
  const v = assessStaleness(fri, new Date(iso), TZ);
  const oldWouldFire = (new Date(iso).getTime() - Date.parse(fri)) / 86_400_000 > 2;
  check(`weekend quiet at ${when}`, v.isStale === false, JSON.stringify(v));
  if (when.startsWith('Sun 08') || when.startsWith('Sun 23') || when.startsWith('Mon 07')) {
    check(`(old rule DID fire at ${when}, confirming the bug)`, oldWouldFire === true);
  }
}

// ---------------------------------------------------------------------------
// 5. DST transitions: the run instant must not drift.
// ---------------------------------------------------------------------------
// Spring forward Sun 2026-03-08, fall back Sun 2026-11-01.
check(
  'no false alarm across spring-forward weekend',
  assessStaleness('2026-03-06T07:12:00-05:00', new Date('2026-03-09T07:00:00-04:00'), TZ).isStale === false,
);
check(
  'no false alarm across fall-back weekend',
  assessStaleness('2026-10-30T07:12:00-04:00', new Date('2026-11-02T07:00:00-05:00'), TZ).isStale === false,
);
// NOTE: this assertion first said 5, and the helper returned 3. The helper was
// right and the test was wrong -- I had counted calendar days (Oct 30, 31, Nov
// 1, 2, 3) instead of scheduled runs. Oct 31 is a Saturday and Nov 1 a Sunday,
// so the missed runs are Fri Oct 30, Mon Nov 2, Tue Nov 3 = 3. Amusingly this
// is the very confusion between "days elapsed" and "runs expected" that the
// module exists to fix, reproduced by me inside its own test.
check(
  'outage still detected across a DST boundary (Fri30 + Mon2 + Tue3)',
  assessStaleness('2026-10-29T07:12:00-04:00', new Date('2026-11-03T08:00:00-05:00'), TZ).missedRuns === 3,
);

// ---------------------------------------------------------------------------
// 5b. MUTATION-DRIVEN TESTS.
// Mutation testing (mutate.sh) found these two gaps: the suite stayed green
// when the DST offset correction was deleted, and when the default timezone was
// switched to UTC. Both mutants are now killed by the assertions below.
//
// The other two survivors were EQUIVALENT mutants, not gaps, and are left
// alone deliberately: `scheduled > asOf` -> `>=` is unreachable because the
// loop advances a full day before its first comparison, and removing the
// `now <= asOf` clamp changes nothing because the first scheduled instant then
// already exceeds `now` and breaks the loop. Adding tests for behaviour that
// cannot differ would be theatre.

// Kills "ignore DST offset correction": without it, 07:12 is computed in UTC
// (= 03:12 EDT), so a run looks like it has already happened at 05:00 local
// when in reality it is still two hours away.
check(
  'run instant is 07:12 LOCAL, not 07:12 UTC (Mon 05:00 EDT, before the run)',
  missedScheduledRuns(
    new Date('2026-08-14T07:12:00-04:00'), // healthy Friday write
    new Date('2026-08-17T05:00:00-04:00'), // Monday, pre-run
    TZ,
  ) === 0,
);
check(
  'the same instant one run later counts exactly 1 (Mon 08:00 EDT)',
  missedScheduledRuns(
    new Date('2026-08-14T07:12:00-04:00'),
    new Date('2026-08-17T08:00:00-04:00'),
    TZ,
  ) === 1,
);
// Same check in winter, where the UTC offset differs (EST, -05:00). A helper
// that hardcodes one offset passes one of these two and fails the other.
check(
  'run instant is local in winter too (Mon 05:00 EST, before the run)',
  missedScheduledRuns(
    new Date('2026-01-16T07:12:00-05:00'),
    new Date('2026-01-19T05:00:00-05:00'),
    TZ,
  ) === 0,
);

// Kills a gap found by injecting AGENT_MIN=59: no test pinned the MINUTE of the
// run, only the hour. 07:30 sits between 07:12 and 07:59, so it discriminates.
check(
  'run minute is 07:12, not merely "some time in hour 7" (Mon 07:30 = run done)',
  missedScheduledRuns(
    new Date('2026-08-14T07:12:00-04:00'),
    new Date('2026-08-17T07:30:00-04:00'),
    TZ,
  ) === 1,
);

// Kills "wrong timezone (UTC)": every other test passes TZ explicitly, so the
// module's own default was never exercised.
//
// Picking the input matters here. My first attempt used a Sunday-night instant,
// which returns 0 in BOTH Toronto and UTC, so the mutant survived -- a test
// that exercises the default without DISCRIMINATING on it. Monday 05:00 EDT
// separates them: locally the 07:12 run is still two hours away (0 missed),
// while in UTC that instant is 09:00 and the "07:12" already looks past (1).
check(
  'default tz is Toronto, not UTC (Mon 05:00 EDT: run still pending)',
  assessStaleness('2026-08-14T07:12:00-04:00', new Date('2026-08-17T05:00:00-04:00')).missedRuns === 0,
);
check(
  'default tz still detects a real outage',
  assessStaleness('2026-08-19T07:12:00-04:00', new Date('2026-08-21T08:00:00-04:00')).missedRuns === 2,
);

// ---------------------------------------------------------------------------
// 5c. MARKET HOLIDAYS (measured, see docs/positions_staleness/README.md
// "Known limitation"). A single weekday closure must be absorbed by the
// 2-missed-run tolerance; only two consecutive closures may raise the banner.
// These pin the numbers quoted in the README so they cannot drift silently.
// ---------------------------------------------------------------------------
// Thanksgiving Thu 2026-11-26, last healthy run Wed 11-25.
check(
  'single weekday holiday does not alarm (Thu midday)',
  assessStaleness('2026-11-25T07:12:00-05:00', new Date('2026-11-26T12:00:00-05:00'), TZ).isStale === false,
);
check(
  'single weekday holiday clears on the next run (Fri 08:00, agent ran)',
  assessStaleness('2026-11-27T07:12:00-05:00', new Date('2026-11-27T08:00:00-05:00'), TZ).isStale === false,
);
// Two consecutive closures: the documented limitation, asserted so that a
// future change which "fixes" it must update the README too.
check(
  'two consecutive weekday closures DO alarm (documented limitation)',
  assessStaleness('2026-11-25T07:12:00-05:00', new Date('2026-11-27T08:00:00-05:00'), TZ).isStale === true,
);

// ---------------------------------------------------------------------------
// 6. DEGENERATE INPUT must never crash a paid page.
// ---------------------------------------------------------------------------
for (const bad of [null, undefined, '', 'not-a-date', '{}']) {
  const v = assessStaleness(bad as string | null, new Date('2026-08-21T12:00:00-04:00'), TZ);
  check(`bad input ${JSON.stringify(bad)} is quiet, not crashing`, v.isStale === false && v.ageDays === null);
}
check('future timestamp does not alarm',
  assessStaleness('2027-01-01T00:00:00-04:00', new Date('2026-08-21T12:00:00-04:00'), TZ).isStale === false);
check('missedScheduledRuns clamps reversed range',
  missedScheduledRuns(new Date('2026-08-21T00:00:00Z'), new Date('2026-08-01T00:00:00Z'), TZ) === 0);

// ---------------------------------------------------------------------------
console.log(`\n  ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  FAIL: ${f}`);
  process.exit(1);
}
console.log(`  healthy-year sweep: ${healthyHours} hourly samples, 0 false alarms`);
console.log(`  old rule on the same data: ${oldFalseAlarms} false-alarm hours (~${(oldFalseAlarms / 52).toFixed(1)}h/week)\n`);
