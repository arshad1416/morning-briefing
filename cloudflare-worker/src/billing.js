import { requireSession } from './session.js';
import {
  getSubscription, upsertSubscription, updateSubscriptionState,
  getSubscriptionByHelcim, storeBillingSession, takeBillingSession,
} from './db.js';

const TIERS = new Set(['basic', 'pro']);
const INTERVALS = new Set(['monthly', 'annual']);
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const MONTH_MS = YEAR_MS / 12;
const HELCIM_API = 'https://api.helcim.com/v2';
const BILL_COOKIE = 'mg_bill_key';

function monthlyPrice(env, tier) {
  return tier === 'pro' ? Number(env.PRICE_PRO || 99) : Number(env.PRICE_BASIC || 49);
}
// Annual = 10 months (2 free).
function amountFor(env, tier, interval) {
  const m = monthlyPrice(env, tier);
  return interval === 'annual' ? m * 10 : m;
}
function planId(env, tier, interval) {
  return env[`HELCIM_PLAN_${tier.toUpperCase()}_${interval.toUpperCase()}`];
}
function billCookie(id) {
  return `${BILL_COOKIE}=${id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=1800`;
}
function readCookie(req, name) {
  const m = (req.headers.get('Cookie') || '').match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? m[1] : null;
}
function ymd(ms) { return new Date(ms).toISOString().slice(0, 10); }

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Thin Helcim v2 client. api-token comes from a Worker secret; never logged.
async function helcim(env, path, method, body) {
  const headers = {
    'api-token': env.HELCIM_API_TOKEN,
    'content-type': 'application/json',
    accept: 'application/json',
  };
  // Helcim requires a unique idempotency-key (max 25 chars) on mutating requests.
  if (method && method !== 'GET') {
    headers['idempotency-key'] = crypto.randomUUID().replace(/-/g, '').slice(0, 25);
  }
  const res = await fetch(`${HELCIM_API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

export function mountBilling(app) {
  // ── 1. Start checkout: initialize a HelcimPay.js "verify" session ──
  // verify captures + stores the card without charging; the recurring
  // subscription is created server-side in /confirm.
  app.post('/api/billing/checkout', requireSession(), async (c) => {
    const { user } = c.get('session');
    const { tier, interval = 'monthly' } = await c.req.json().catch(() => ({}));
    if (!TIERS.has(tier) || !INTERVALS.has(interval)) return c.json({ error: 'invalid_plan' }, 400);

    if (c.env.MOCK_BILLING === '1') {
      await upsertSubscription(c.env.DB, user.id, {
        tier, status: 'active', billingInterval: interval,
        periodEnd: Date.now() + (interval === 'annual' ? YEAR_MS : MONTH_MS),
      });
      return c.json({ ok: true, mock: true, tier, interval });
    }
    if (!planId(c.env, tier, interval)) return c.json({ error: 'plan_not_configured' }, 503);

    // Mirrors CompCeiling's initializeCheckout (src/lib/helcim.ts): verify mode
    // requires amount 0, and the card must be stored as the customer's DEFAULT
    // payment method or the subscription has nothing to bill.
    const init = await helcim(c.env, '/helcim-pay/initialize', 'POST', {
      paymentType: 'verify',
      amount: 0,
      currency: c.env.CURRENCY || 'CAD',
      setAsDefaultPaymentMethod: 1,
      customerRequest: { contactName: user.email, email: user.email },
      paymentMethod: 'cc',
    });
    // Never log init.data here — it contains the secretToken.
    if (!init.ok) console.log('[billing] init failed', tier, interval, 'status', init.status);
    if (!init.ok || !init.data.checkoutToken) {
      return c.json({ error: 'helcim_init_failed', detail: init.data }, 502);
    }
    const key = crypto.randomUUID();
    await storeBillingSession(c.env.DB, {
      id: key, userId: user.id, tier, interval,
      checkoutToken: init.data.checkoutToken, secretToken: init.data.secretToken,
    });
    c.header('Set-Cookie', billCookie(key));
    return c.json({ checkoutToken: init.data.checkoutToken });
  });

  // ── 2. Confirm: validate the modal response hash, create the subscription ──
  app.post('/api/billing/confirm', requireSession(), async (c) => {
    const { user } = c.get('session');
    const key = readCookie(c.req.raw, BILL_COOKIE);
    if (!key) return c.json({ error: 'no_checkout' }, 400);
    const sess = await takeBillingSession(c.env.DB, key); // single-use
    if (!sess || sess.user_id !== user.id) return c.json({ error: 'checkout_expired' }, 400);

    const body = await c.req.json().catch(() => ({}));
    // HelcimPay success envelope: { data: { hash, data: {transaction} }, status, ... }.
    // Tolerate a flatter { data, hash } shape too.
    const env = (body.data && body.data.data) ? body.data : body;
    const data = env.data;   // transaction object (customerCode, transactionId, cardToken, …)
    const hash = env.hash;
    if (!data || !hash) return c.json({ error: 'bad_response' }, 400);
    // Helcim: hash = sha256_hex( JSON.stringify(transactionData) + secretToken )
    const expected = await sha256Hex(JSON.stringify(data) + sess.secret_token);
    if (expected !== hash) {
      console.log('[billing] confirm hash mismatch; payload keys', Object.keys(data || {}).join(','));
      return c.json({ error: 'hash_mismatch' }, 400);
    }

    const customerCode = data.customerCode || data.customer?.customerCode;
    if (!customerCode) return c.json({ error: 'no_customer' }, 400);

    // The Helcim plan carries its OWN 7-day free trial (freeTrialPeriod=7,
    // dateBilling="Sign-up"), so activate the subscription TODAY and let Helcim
    // grant the trial before the first charge. Do NOT future-date to the app's
    // trial end: a future dateActivated produced verify-only subscriptions that
    // never persisted in Helcim (the cause of the vanished first subscription).
    const existing = await getSubscription(c.env.DB, user.id);
    const now = Date.now();
    const startMs = now;
    const pid = planId(c.env, sess.tier, sess.interval);

    // Body is an OBJECT wrapping a `subscriptions` array (a bare array is
    // rejected as "Request is malformed").
    // Mirrors CompCeiling's createSubscription: object wrapping a `subscriptions`
    // array, dateActivated YYYY-MM-DD, numeric paymentPlanId, paymentMethod "card".
    const sub = await helcim(c.env, '/subscriptions', 'POST', {
      subscriptions: [{
        dateActivated: ymd(startMs),
        paymentPlanId: Number(pid),
        customerCode,
        recurringAmount: amountFor(c.env, sess.tier, sess.interval),
        paymentMethod: 'card',
      }],
    });
    if (!sub.ok) {
      console.log('[billing] subscription create failed', sub.status, JSON.stringify(sub.data).slice(0, 300));
      return c.json({ error: 'subscription_failed', detail: sub.data }, 502);
    }
    const arr = sub.data?.data || sub.data?.subscriptions || sub.data;
    const s = Array.isArray(arr) ? (arr[0] || {}) : (arr || {});
    const subId = String(s.id || s.subscriptionId || '');
    const nextBill = s.dateBilling ? Date.parse(s.dateBilling) : startMs;

    // Access is good through Helcim's next-bill date (≈ trial end for a fresh
    // sub); the renewal webhook must extend it on each successful charge. Fall
    // back to one period only if Helcim omits the date, so we don't lock out a
    // just-paid customer while never granting free access past a real bill.
    const fullPeriod = startMs + (sess.interval === 'annual' ? YEAR_MS : MONTH_MS);
    await upsertSubscription(c.env.DB, user.id, {
      tier: sess.tier, status: 'active', billingInterval: sess.interval,
      trialEndsAt: existing?.trial_ends_at || null,
      periodEnd: nextBill || fullPeriod,
      helcimCustomerId: customerCode, helcimPlanId: String(pid), helcimSubscriptionId: subId,
    });
    return c.json({ ok: true, tier: sess.tier, interval: sess.interval });
  });

  // ── 3. Cancel: stop auto-renew; stay entitled until current_period_end ──
  app.post('/api/billing/cancel', requireSession(), async (c) => {
    const { user } = c.get('session');
    const sub = await getSubscription(c.env.DB, user.id);
    if (!sub || !sub.helcim_subscription_id) return c.json({ error: 'no_subscription' }, 400);
    if (c.env.MOCK_BILLING !== '1') {
      await helcim(c.env, `/subscriptions/${sub.helcim_subscription_id}`, 'DELETE');
    }
    await updateSubscriptionState(c.env.DB, user.id, { status: 'canceled' });
    return c.json({ ok: true });
  });

  // ── 4. Webhook: keep status/period in sync on renewals/failures/cancels ──
  // Inert until HELCIM_WEBHOOK_VERIFIER is set + the signature scheme is
  // confirmed against a real Helcim webhook (adjust `expected` then).
  app.post('/api/billing/webhook', async (c) => {
    const raw = await c.req.text();
    const verifier = c.env.HELCIM_WEBHOOK_VERIFIER;
    if (!verifier) {
      console.warn('billing webhook: HELCIM_WEBHOOK_VERIFIER unset — ignoring');
      return c.json({ ok: true, ignored: true });
    }
    // Helcim: HMAC-SHA256 over `${webhook-id}.${webhook-timestamp}.${body}`,
    // keyed by the BASE64-DECODED verifier token, signature base64-encoded. The
    // webhook-signature header may carry space-separated "v1,<sig>" tokens.
    const signedContent = `${c.req.header('webhook-id') || ''}.${c.req.header('webhook-timestamp') || ''}.${raw}`;
    const keyBytes = Uint8Array.from(atob(verifier), (ch) => ch.charCodeAt(0));
    const macKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', macKey, new TextEncoder().encode(signedContent));
    const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
    const provided = (c.req.header('webhook-signature') || '').split(' ').map((s) => (s.includes(',') ? s.split(',')[1] : s));
    if (!provided.includes(expected)) return c.json({ error: 'bad_signature' }, 401);

    let evt; try { evt = JSON.parse(raw); } catch { return c.json({ error: 'bad_body' }, 400); }
    const subId = String(evt.subscriptionId || evt.id || evt.data?.subscriptionId || '');
    const custId = String(evt.customerCode || evt.data?.customerCode || '');
    const row = await getSubscriptionByHelcim(c.env.DB, { subscriptionId: subId, customerId: custId });
    if (!row) return c.json({ ok: true, unmatched: true });

    const type = (evt.type || evt.event || '').toLowerCase();
    if (type.includes('cancel') || type.includes('delete')) {
      await updateSubscriptionState(c.env.DB, row.user_id, { status: 'canceled' });
    } else if (type.includes('fail') || type.includes('declin')) {
      await updateSubscriptionState(c.env.DB, row.user_id, { status: 'past_due' });
    } else {
      const next = evt.dateBilling || evt.data?.dateBilling;
      await updateSubscriptionState(c.env.DB, row.user_id, {
        status: 'active', periodEnd: next ? Date.parse(next) : null,
      });
    }
    return c.json({ ok: true });
  });
}
