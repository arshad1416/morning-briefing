import { sign, verify } from 'hono/jwt';
import { setCookie, deleteCookie } from 'hono/cookie';
import { getUserById, getSubscription } from './db.js';

const THIRTY_DAYS = 60 * 60 * 24 * 30;
export const SESSION_COOKIE = 'mg_session';

export async function issueSession(userId, secret) {
  const now = Math.floor(Date.now() / 1000);
  return sign({ sub: userId, iat: now, exp: now + THIRTY_DAYS }, secret);
}

export async function verifySession(token, secret, DB) {
  if (!token) return null;
  let payload;
  // hono >=4.x requires the algorithm to be passed explicitly to verify();
  // omitting it throws JwtAlgorithmRequired. sign() defaults to HS256.
  try { payload = await verify(token, secret, 'HS256'); } catch { return null; }
  const user = await getUserById(DB, payload.sub);
  if (!user) return null;
  return { user };
}

export function setSessionCookie(c, token) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: THIRTY_DAYS,
  });
}
export function clearSessionCookie(c) {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export function requireSession() {
  return async (c, next) => {
    const { getCookie } = await import('hono/cookie');
    const token = getCookie(c, SESSION_COOKIE);
    const sess = await verifySession(token, c.env.SESSION_SECRET, c.env.DB);
    if (!sess) return c.json({ error: 'not_signed_in' }, 401);
    c.set('session', sess);
    await next();
  };
}

export async function entitlement(DB, userId) {
  const sub = await getSubscription(DB, userId);
  const now = Date.now();
  if (!sub) return { entitled: false, tier: null, status: 'none' };
  if (sub.tier === 'trial') {
    const live = sub.status === 'active' && sub.trial_ends_at && sub.trial_ends_at > now;
    return { entitled: !!live, tier: 'trial', status: live ? 'active' : 'expired', trialEndsAt: sub.trial_ends_at };
  }
  const live = sub.status === 'active' && (!sub.current_period_end || sub.current_period_end > now);
  return { entitled: !!live, tier: sub.tier, status: sub.status, periodEnd: sub.current_period_end };
}

export const ROUTE_TIER = { research: 'basic', screener: 'basic', charts: 'pro', models: 'pro', positions: 'basic' };
export function meetsTier(userTier, needTier) {
  const rank = { basic: 1, pro: 2 };
  const have = userTier === 'trial' ? 2 : (rank[userTier] || 0);
  return have >= (rank[needTier] || 0);
}
