// app/archive/corpus.ts — reads data/archive/ off disk, at build time.
//
// This is not a route file. It exists because BOTH archive routes need the
// same answer and neither can export it to the other: Next generates
// `.next/types/app/**/page.ts` asserting a page module has no exports beyond
// `default`, `metadata`, `generateStaticParams` and friends, so a named export
// from either page.tsx fails `tsc --noEmit`. The alternative was a second copy
// of the rule below in the list page, which is the thing this is here to avoid.
import fs from 'node:fs';
import path from 'node:path';
import { parseTolerantJson } from '@/lib/json';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const ARCHIVE_DIR = path.join(process.cwd(), 'data', 'archive');

/** Archived dates, newest first, skipping index entries with no file. */
export function listDates(): string[] {
  try {
    const idx = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'data', 'archive-index.json'), 'utf8'),
    );
    const dates: string[] = idx.dates ?? [];
    return dates.filter((d) => fs.existsSync(path.join(ARCHIVE_DIR, `${d}.json`)));
  } catch {
    return [];
  }
}

export function loadBriefing(date: string): Any | null {
  try {
    // Five archived briefings carry bare `NaN` from Python's json writer, which
    // a plain JSON.parse rejects — those pages built as empty NewsArticle
    // shells. Same parser the backtest corpus already needed.
    return parseTolerantJson(fs.readFileSync(path.join(ARCHIVE_DIR, `${date}.json`), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Every date that published this exact block, oldest first.
 *
 * data/archive/*.json republishes whole blocks verbatim: one council narrative
 * and one premarket scan run 48 files deep (2026-06-08 … 2026-07-27) because
 * generate_latest.py copied a stale upstream payload until the
 * UPSTREAM_MAX_AGE_H guard landed (2b5e65760), and the weekend briefings repeat
 * the previous day's note in shorter runs. Nothing in the archived copy records
 * where it came from — `scanned_at` is never copied into the payload — so a
 * page cannot date the block. What it can do is not claim it.
 */
let published: Map<string, string[]> | null = null;
export function publishedOn(block: Any): string[] {
  if (!published) {
    published = new Map();
    for (const d of [...listDates()].reverse()) {
      const b = loadBriefing(d);
      for (const v of [b?.narrative, b?.premarket_top_setups]) {
        const key = v && JSON.stringify(v);
        if (!key) continue;
        const seen = published.get(key);
        if (seen) seen.push(d);
        else published.set(key, [d]);
      }
    }
  }
  return (block && published.get(JSON.stringify(block))) || [];
}

/**
 * The earlier date that first published this block, or null if it is this
 * date's own. The date that wrote a note keeps it; every later date carrying
 * the identical note says so instead of reprinting it as that morning's.
 */
export const repeatOf = (date: string, block: Any): string | null => {
  const [first] = publishedOn(block);
  return first && first !== date ? first : null;
};

/**
 * date → the earlier date whose narrative that date merely repeats.
 *
 * /archive is a client component: it fetches the same per-date JSON at runtime
 * and cannot read the corpus off disk, so it cannot apply the rule itself. Its
 * server wrapper calls this at build time and hands the answer down as a prop.
 */
export function narrativeRepeats(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of listDates()) {
    const origin = repeatOf(d, loadBriefing(d)?.narrative);
    if (origin) out[d] = origin;
  }
  return out;
}
