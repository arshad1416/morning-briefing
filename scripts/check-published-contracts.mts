/**
 * Does the published data still satisfy the contracts the frontend parses it with?
 *
 * Freshness and correctness are different failures, and only one of them was
 * being watched. `premarket_top_setups` was missing from ALL 25 published
 * versions of latest.json — perfectly fresh, perfectly unparseable. Because
 * `fetchJson` (src/lib/api/index.ts) uses zod's throwing `.parse()`, that single
 * absent field killed the whole `latestQuery` and with it TickerTape,
 * IndicesCard, VixRegimeCard, NewsFeed and ActionQueue. No monitor noticed,
 * because every monitor was asking whether the data was recent.
 *
 * This imports the REAL schemas rather than restating them, so it cannot drift
 * from what the site actually enforces. It runs against the LIVE origin, so it
 * also covers anything Cloudflare serves differently from the Pi's local copy.
 *
 * Gated payloads are deliberately not covered — they need a session; the Worker's
 * own vitest suite owns those.
 *
 *   npx tsx scripts/check-published-contracts.mts [origin]
 */
import { LatestDataSchema, VerdictSchema, GexDataSchema } from '../src/lib/schemas/market';
import { ScreenerDataSchema } from '../src/lib/schemas/screener';

type Schema = { safeParse: (d: unknown) => { success: boolean; error?: { issues: Array<{ path: (string | number)[]; message: string }> } } };

const ORIGIN = (process.argv[2] || process.env.ORIGIN || 'https://maplegamma.com').replace(/\/$/, '');

// Exactly the public files src/lib/api/index.ts fetches, with the schema it uses.
const CONTRACTS: Array<[string, Schema]> = [
  ['/data/latest.json', LatestDataSchema],
  ['/data/verdict.json', VerdictSchema],
  ['/data/maplegamma-data.json', GexDataSchema],
  ['/data/screener-lite.json', ScreenerDataSchema],
];

const failures: string[] = [];

for (const [path, schema] of CONTRACTS) {
  const url = `${ORIGIN}${path}`;
  let body: unknown;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'mg-contract-check/1.0' } });
    if (!res.ok) {
      failures.push(`${path}: HTTP ${res.status}`);
      continue;
    }
    // Strict-JSON check comes free: JSON.parse rejects the bare Infinity/NaN
    // tokens that froze the publish on 2026-07-30.
    body = JSON.parse(await res.text());
  } catch (e) {
    failures.push(`${path}: fetch/parse failed — ${(e as Error).message}`);
    continue;
  }

  const r = schema.safeParse(body);
  if (r.success) {
    console.log(`PASS  ${path}`);
    continue;
  }
  const issues = (r.error?.issues ?? [])
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
  console.log(`FAIL  ${path}`);
  for (const i of issues) console.log(`        ${i}`);
  failures.push(`${path} — ${issues.join('; ')}`);
}

if (failures.length) {
  console.log(`\n${failures.length} published payload(s) no longer match the frontend's contract.`);
  console.log('The site will render blank tiles for every component fed by these files.');
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log(`\nAll ${CONTRACTS.length} public payloads satisfy the schemas the site parses them with.`);
