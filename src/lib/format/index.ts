// lib/format/index.ts — number/currency/percent formatters (tabular-nums)
export function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCurrency(n: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

export function formatPercent(n: number, decimals = 2): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(decimals)}%`;
}

export function formatCompact(n: number): string {
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatTimeRemaining(targetMs: number): string {
  const diff = targetMs - Date.now();
  if (diff <= 0) return 'passed';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ── Pipeline timestamps ─────────────────────────────────────────────────────
// Published artifacts stamp `generated_at` three different ways, and the
// difference is not cosmetic once you subtract it from `Date.now()`:
//
//   verdict.json      2026-08-21T11:30:01.570029+00:00   UTC-aware
//   latest.json       2026-08-21T09:37:02-04:00          ET-aware
//   crypto-cohorts    2026-08-21T09:28:01.208299         NAIVE (Pi-local ET)
//   analysis.json     2026-08-21 07:30:10                NAIVE, space-separated
//
// `new Date()` reads the naive forms in the VIEWER's zone, so the same file is
// four hours stale for a UTC reader and NEGATIVE ages west of ET ("-10800s
// ago"); the space-separated form is Invalid Date on WebKit, which reaches
// formatDuration as NaN and renders "NaNd ago" behind a healthy green dot.
// research-client's fmtTs documents the same hazard and sidesteps it by never
// converting naive stamps — an age has to convert, so it resolves them against
// the Pi's zone instead.
//
// Returns epoch ms, or null when the stamp is absent or unusable — callers must
// render "unknown", never an age derived from a guess.

const ET_ZONE = 'America/Toronto';

const ET_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: ET_ZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Offset of ET from UTC at `utcMs`, in ms (negative — ET is behind UTC). */
function etOffsetMs(utcMs: number): number {
  const p: Record<string, string> = {};
  for (const { type, value } of ET_PARTS.formatToParts(new Date(utcMs))) p[type] = value;
  // `hour12: false` yields "24" for midnight in some engines; the date part
  // already names that day, so folding it to 0 keeps the two in step.
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return wall - utcMs;
}

const NAIVE_TS = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/;

/** Epoch ms for a timezone-naive ET wall time, or null if it isn't one. */
function parseEtWallClock(s: string): number | null {
  const m = NAIVE_TS.exec(s);
  if (!m) return null;
  const [, y, mo, d, h, mi, sec, frac] = m;
  const msFrac = frac ? Math.round(Number(`0.${frac}`) * 1000) : 0;
  // Solve on a whole-second instant: etOffsetMs reads a second-precision wall
  // clock, so a millisecond-bearing input leaks its own truncation into the
  // offset and compounds it across both passes. The fraction is added back last.
  const asUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(sec ?? 0));
  // One correction lands the instant whose ET wall clock matches these fields;
  // a second settles the hours around a DST transition, where the first guess
  // is evaluated under the wrong offset.
  let guess = asUtc - etOffsetMs(asUtc);
  guess = asUtc - etOffsetMs(guess);
  return guess + msFrac;
}

export function parsePipelineTimestamp(ts: string | null | undefined): number | null {
  if (!ts) return null;
  const s = ts.trim();
  if (!s) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const ms = Date.parse(s);
    return Number.isNaN(ms) ? null : ms;
  }
  return parseEtWallClock(s);
}
