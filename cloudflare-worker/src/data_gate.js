/**
 * Hard data gate (Phase 2). Premium JSON lives ONLY in a private R2 bucket and
 * is served exclusively through /api/data/:file after a session + entitlement +
 * tier check. Non-subscribers get 401/403 and never receive the bytes — the
 * blurred UX teaser is backed by real server-side enforcement, not CSS.
 *
 * Public files (free Dashboard) are NOT here — they stay on Pages under /data/.
 */
import { getCookie } from 'hono/cookie';
import { SESSION_COOKIE, verifySession, entitlement, meetsTier } from './session.js';

// Charts page → Pro; Models page → Pro; Research/Screener/Positions → Basic.
// (tickers/* backs the ungated #/ticker page, so it is NOT gated here.)
const PRO_PREFIXES = ['charts/'];
const PRO_FILES = new Set([
  'walk_forward_v2.json', 'walk_forward.json', 'strategy_improvement.json',
  'strategy_improvement_b.json', 'trade_outcomes.json', 'trade_outcomes_b.json',
  'prediction-engine.json', 'accuracy.json', 'council_history.json',
  'simulation.json', 'gex-detail.json',
  'nope-detail.json',
]);
const BASIC_FILES = new Set([
  'screener-data.json', 'morning_analysis.json', 'maplegamma_analysis.json',
  'maplegamma_analysis_b.json',
  'web-news.json', 'polymarket_sentiment.json', 'earnings.json',
  'sec_filings.json', 'journal.json', 'paper_trades.json',
  'ibkr_account.json', 'ibkr_positions.json', 'ibkr_trades.json',
]);

// null → not a gated file (do not serve it here).
export function neededTier(file) {
  if (PRO_PREFIXES.some((p) => file.startsWith(p)) || PRO_FILES.has(file)) return 'pro';
  if (BASIC_FILES.has(file)) return 'basic';
  return null;
}

export function mountDataGate(app) {
  app.get('/api/data/*', async (c) => {
    // path is /api/data/<file> where <file> may contain a slash (charts/AAPL.json)
    const file = decodeURIComponent(c.req.path.replace(/^\/api\/data\//, ''));
    if (!file || file.includes('..')) return c.json({ error: 'bad_request' }, 400);

    const need = neededTier(file);
    if (!need) return c.json({ error: 'not_found' }, 404);

    const sess = await verifySession(getCookie(c, SESSION_COOKIE), c.env.SESSION_SECRET, c.env.DB);
    if (!sess) return c.json({ error: 'not_signed_in' }, 401);
    const ent = await entitlement(c.env.DB, sess.user.id);
    if (!ent.entitled) return c.json({ error: 'no_subscription' }, 403);
    if (!meetsTier(ent.tier, need)) return c.json({ error: 'upgrade_required', need }, 403);

    const obj = await c.env.PRIVATE.get(file);
    if (!obj) return c.json({ error: 'not_generated' }, 404);
    // Buffer rather than stream obj.body: these JSON files are small, and a
    // dangling R2 stream trips isolated-storage cleanup in the test runner.
    const buf = await obj.arrayBuffer();
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    });
  });
}
