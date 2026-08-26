/**
 * Staleness for the IBKR portfolio feed, measured against the agent's actual
 * schedule instead of raw elapsed time.
 *
 * WHY THIS EXISTS (see docs/positions_staleness/README.md):
 * The positions page used `staleDays > 2`, justified by the comment "the refresh
 * is daily, so >2d means runs are failing, not that it is a weekend." That
 * premise was false. The cron is:
 *
 *     12 7 * * 1-5   -> weekdays only, America/Toronto
 *
 * so on a perfectly healthy system the newest write on a Sunday afternoon is
 * Friday 07:12 -- more than two days old. The banner therefore fired every week
 * from roughly Sunday 08:00 until Monday 07:12 (~23 hours), telling paying
 * subscribers "the brokerage feed stopped updating" while nothing was wrong.
 *
 * A warning that cries wolf every Sunday is one people learn to ignore, and this
 * banner is the ONLY staleness signal the customer gets. Raising the constant
 * cannot fix it: the legitimate Fri->Mon gap is 72h, which is larger than the
 * 48h threshold, so no single age cutoff satisfies both "quiet on weekends" and
 * "warn before two days."
 *
 * So we compare against the LAST EXPECTED RUN rather than against wall-clock
 * age: how many scheduled runs have been missed. That stays quiet across
 * weekends and holidays-with-no-run, and still catches a real outage within one
 * business day.
 */

const AGENT_TZ = 'America/Toronto'; // cron runs in Pi-local time
const AGENT_HOUR = 7;
const AGENT_MIN = 12;

/** Wall-clock Y/M/D/h/m for `date` as observed in `tz`. */
function partsInTz(date: Date, tz: string) {
  // 'en-CA' gives YYYY-MM-DD, so the parts land in a predictable order.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    weekday: 'short',
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = p.value;
  }
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    // hour can come back as '24' at midnight in some ICU versions
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    weekday: out.weekday, // 'Mon' ... 'Sun'
  };
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** True when `date`, seen in the agent's timezone, is Mon-Fri. */
function isBusinessDayInTz(date: Date, tz: string): boolean {
  const idx = WEEKDAY_INDEX[partsInTz(date, tz).weekday];
  return idx >= 1 && idx <= 5;
}

/**
 * How many scheduled runs *should* have produced a file between `asOf` and
 * `now`, exclusive of the run that wrote `asOf` itself.
 *
 * Counts weekday 07:12 boundaries crossed. Returns 0 while the feed is healthy,
 * including all weekend hours.
 */
export function missedScheduledRuns(asOf: Date, now: Date, tz: string = AGENT_TZ): number {
  if (Number.isNaN(asOf.getTime()) || Number.isNaN(now.getTime())) return 0;
  if (now <= asOf) return 0;

  let missed = 0;
  // Walk day by day from the day after asOf through today, counting weekday
  // run times that have already passed. Day count is tiny (an outage of months
  // is still only a few hundred iterations), so a loop is fine and obvious.
  const cursor = new Date(asOf.getTime());
  for (let guard = 0; guard < 3660; guard++) {
    // advance one calendar day in the target tz
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const p = partsInTz(cursor, tz);
    // The scheduled instant for this calendar day, expressed as a Date.
    const scheduled = zonedTimeToDate(p.year, p.month, p.day, AGENT_HOUR, AGENT_MIN, tz);
    if (scheduled > now) break;
    if (scheduled > asOf && isBusinessDayInTz(scheduled, tz)) missed++;
  }
  return missed;
}

/**
 * Build a Date for a wall-clock time in `tz`. Handles DST by measuring the
 * zone's offset at an approximate instant and correcting once, which is exact
 * except for times inside a DST transition -- 07:12 never is, in this zone.
 */
function zonedTimeToDate(
  year: number, month: number, day: number, hour: number, minute: number, tz: string,
): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const guess = new Date(naiveUtc);
  const seen = partsInTz(guess, tz);
  const seenUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, 0, 0);
  const offset = seenUtc - naiveUtc; // how far the zone shifted our guess
  return new Date(naiveUtc - offset);
}

export interface StalenessVerdict {
  /** Show the "data is old" banner. */
  isStale: boolean;
  /** Scheduled weekday runs that produced nothing. 0 on a healthy system. */
  missedRuns: number;
  /** Raw age in days, kept for wording and for callers that want it. */
  ageDays: number | null;
}

/**
 * Decide whether the feed is genuinely stale.
 *
 * `missedRuns >= 2` means two consecutive scheduled weekday runs produced
 * nothing, which cannot happen while the agent is healthy and never happens
 * merely because it is a weekend. One missed run is deliberately tolerated: a
 * single transient failure self-heals next morning, and the daily Telegram
 * alert already tells the operator about it. The customer does not need to see
 * a warning the operator is already acting on.
 */
export function assessStaleness(
  asOfIso: string | null | undefined,
  now: Date = new Date(),
  tz: string = AGENT_TZ,
): StalenessVerdict {
  if (!asOfIso) return { isStale: false, missedRuns: 0, ageDays: null };
  const ms = Date.parse(String(asOfIso));
  if (Number.isNaN(ms)) return { isStale: false, missedRuns: 0, ageDays: null };

  const asOf = new Date(ms);
  const missedRuns = missedScheduledRuns(asOf, now, tz);
  const ageDays = (now.getTime() - ms) / 86_400_000;
  return { isStale: missedRuns >= 2, missedRuns, ageDays };
}