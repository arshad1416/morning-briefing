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
  if (first && first !== date) return first;
  return selfDeclaredDate(date, block);
};

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'];

/**
 * The date a block names for ITSELF, when that is not the date it is published
 * under — otherwise null.
 *
 * The repeat rule above cannot suppress a block's FIRST publication, and two of
 * those firsts are themselves stale: /archive/2026-06-03/ and /archive/2026-06-04/
 * both open "📊 **Market Intel — May 26, 2026**", 8 and 9 days before the page
 * they head. Only the opening line is read, so a date mentioned in passing later
 * in the narrative cannot trip this.
 */
function selfDeclaredDate(date: string, block: Any): string | null {
  const head = (typeof block === 'string' ? block : JSON.stringify(block ?? '')).slice(0, 80);
  const m = /(\w+)\s+(\d{1,2}),\s*(20\d\d)/.exec(head);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  if (month < 0) return null;
  const named = `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return named !== date ? named : null;
}

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
