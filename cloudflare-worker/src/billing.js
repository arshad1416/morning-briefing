import { requireSession } from './session.js';
import { upsertSubscription } from './db.js';

const TIERS = new Set(['basic', 'pro']);
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function mountBilling(app) {
  app.post('/api/billing/checkout', requireSession(), async (c) => {
    const { user } = c.get('session');
    const { tier } = await c.req.json().catch(() => ({}));
    if (!TIERS.has(tier)) return c.json({ error: 'invalid_tier' }, 400);

    if (c.env.MOCK_BILLING === '1') {
      await upsertSubscription(c.env.DB, user.id, {
        tier, status: 'active', periodEnd: Date.now() + YEAR_MS,
      });
      return c.json({ ok: true, mock: true, tier });
    }
    return c.json({ error: 'billing_not_configured' }, 503);
  });
}
