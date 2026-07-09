import { requireSession } from './session.js';
import { upsertSubscription, storeBillingSession, takeBillingSession } from './db.js';
import { randomId } from './util.js';

const TIERS = new Set(['basic', 'pro']);
const INTERVALS = new Set(['monthly', 'annual']);
const HELCIM_API = 'https://api.helcim.com/v2';
const SESSION_TTL = 3600_000; // 1 hour

function helcimFetch(path, opts, env) {
  return fetch(`${HELCIM_API}${path}`, {
    ...opts,
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-token': env.HELCIM_API_TOKEN,
      ...opts?.headers,
    },
  });
}

// ── Checkout: initialize a HelcimPay.js verify session ──
// Returns a checkoutToken for the browser to load into the HelcimPay iframe.
// The secretToken is stored server-side in billing_sessions and never sent to
// the browser (used to validate the transaction response hash).
export function mountBilling(app) {
  app.post('/api/billing/checkout', requireSession(), async (c) => {
    const { user } = c.get('session');
    const { tier, interval = 'monthly' } = await c.req.json().catch(() => ({}));
    if (!TIERS.has(tier)) return c.json({ error: 'invalid_tier' }, 400);
    if (!INTERVALS.has(interval)) return c.json({ error: 'invalid_interval' }, 400);

    // Mock mode — instant activation
    if (c.env.MOCK_BILLING === '1') {
      await upsertSubscription(c.env.DB, user.id, {
        tier, status: 'active', periodEnd: Date.now() + 365 * 86400_000,
      });
      return c.json({ ok: true, mock: true, tier });
    }

    if (!c.env.HELCIM_API_TOKEN) {
      return c.json({ error: 'billing_not_configured' }, 503);
    }

    // Initialize HelcimPay in verify mode — tokenizes the card without a charge
    const body = {
      paymentType: 'verify',
      amount: 0,
      currency: 'USD',
      setAsDefaultPaymentMethod: 1,
      customerRequest: { contactName: user.email, email: user.email },
      paymentMethod: 'cc',
    };
    const res = await helcimFetch('/helcim-pay/initialize', { method: 'POST', body: JSON.stringify(body) }, c.env);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`HelcimPay init failed (${res.status}): ${text}`);
      return c.json({ error: 'checkout_failed' }, 502);
    }

    const data = await res.json();
    const sessionId = randomId();
    await storeBillingSession(c.env.DB, {
      id: sessionId, userId: user.id, tier, interval,
      checkoutToken: data.checkoutToken, secretToken: data.secretToken,
    });
    return c.json({ ok: true, checkoutToken: data.checkoutToken, sessionId });
  });

  // ── Activate: validate the HelcimPay.js response and create the subscription ──
  // The browser forwards { data, hash } from the iframe's postMessage. The
  // server verifies sha256(compactJson(data) + secretToken) === hash, then
  // creates a Helcim recurring subscription via POST /v2/subscriptions.
  app.post('/api/billing/activate', requireSession(), async (c) => {
    const { user } = c.get('session');
    const { data, hash, sessionId } = await c.req.json().catch(() => ({}));
    if (!sessionId || !hash || !data) return c.json({ error: 'bad_request' }, 400);

    const session = await takeBillingSession(c.env.DB, sessionId);
    if (!session) return c.json({ error: 'session_expired' }, 400);
    if (session.user_id !== user.id) return c.json({ error: 'session_mismatch' }, 403);

    // Validate hash
    const textEncoder = new TextEncoder();
    const bytes = textEncoder.encode(JSON.stringify(data) + session.secret_token);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const expected = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const actual = String(hash).toLowerCase();
    if (expected !== actual) return c.json({ error: 'hash_mismatch' }, 403);

    // Extract customer code from the verified data
    const customerCode = data?.customerCode || data?.customer?.customerCode;
    const tier = session.tier;
    const interval = session.interval || 'monthly';

    // Figure out which payment plan to use
    const planKey = tier === 'pro' ? 'PRO' : 'BASIC';
    const intervalKey = interval === 'annual' ? 'ANNUAL' : 'MONTHLY';
    const planId = c.env[`HELCIM_PLAN_${planKey}_${intervalKey}`];
    if (!planId) return c.json({ error: 'plan_not_configured' }, 503);

    // Create the Helcim recurring subscription
    const dateActivated = new Date().toISOString().slice(0, 10);
    const recurringAmount = tier === 'pro'
      ? (interval === 'annual' ? 990 : 99)
      : (interval === 'annual' ? 490 : 49);
    const subBody = {
      subscriptions: [{
        dateActivated,
        paymentPlanId: Number(planId),
        customerCode,
        recurringAmount,
        paymentMethod: 'card',
      }],
    };
    const subRes = await helcimFetch('/subscriptions', {
      method: 'POST',
      headers: { 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify(subBody),
    }, c.env);

    if (!subRes.ok) {
      const text = await subRes.text().catch(() => '');
      console.error(`Helcim subscription create failed (${subRes.status}): ${text}`);
      return c.json({ error: 'subscription_failed' }, 502);
    }

    const subData = await subRes.json();
    const arr = subData.data ?? subData.subscriptions ?? (Array.isArray(subData) ? subData : [subData]);
    const subscription = Array.isArray(arr) ? arr[0] : arr;
    const helcimSubId = String(subscription?.id ?? '');
    const monthMs = 30 * 24 * 60 * 60 * 1000;
    const periodEnd = Date.now() + (interval === 'annual' ? 12 : 1) * monthMs;

    await upsertSubscription(c.env.DB, user.id, {
      tier, status: 'active', periodEnd,
      helcimCustomerId: customerCode, helcimPlanId: planId,
      billingInterval: interval, helcimSubscriptionId: helcimSubId,
    });

    return c.json({ ok: true, tier, interval });
  });

  // ── Webhook ──
  app.post('/api/billing/webhook', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const eventType = body.eventType || body.type || '';
    const payload = body.data || body;
    if (eventType.includes('payment') || eventType.includes('subscription')) {
      const customerCode = payload.customerCode || payload.customer?.customerCode;
      if (customerCode) {
        const sub = await c.env.DB.prepare(
          'SELECT user_id FROM subscriptions WHERE helcim_customer_id=?'
        ).bind(customerCode).first();
        if (sub) {
          const monthMs = 30 * 24 * 60 * 60 * 1000;
          await c.env.DB.prepare(
            'UPDATE subscriptions SET status=?, current_period_end=? WHERE user_id=?'
          ).bind('active', Date.now() + monthMs, sub.user_id).run();
        }
      }
    }
    return c.json({ ok: true });
  });
}
