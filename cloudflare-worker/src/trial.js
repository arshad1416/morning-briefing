import { upsertSubscription } from './db.js';

// 7-day free trial (site copy + paywall overlay say 7 days — keep in sync).
export const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;
const IP_LIMIT = 3;
const IP_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export async function startTrial(DB, { userId, deviceId, ip }) {
  if (deviceId) {
    const byDevice = await DB.prepare('SELECT COUNT(*) n FROM trial_claims WHERE device_id=?').bind(deviceId).first();
    if ((byDevice?.n || 0) > 0) return { ok: false, error: 'trial_already_claimed' };
  }
  const byIp = await DB.prepare('SELECT COUNT(*) n FROM trial_claims WHERE ip=? AND created_at>?')
    .bind(ip, Date.now() - IP_WINDOW_MS).first();
  if ((byIp?.n || 0) >= IP_LIMIT) return { ok: false, error: 'trial_ip_limit' };

  const trialEndsAt = Date.now() + TRIAL_MS;
  await upsertSubscription(DB, userId, { tier: 'trial', status: 'active', trialEndsAt });
  await DB.prepare('INSERT INTO trial_claims (device_id,ip,user_id,created_at) VALUES (?,?,?,?)')
    .bind(deviceId || 'none', ip, userId, Date.now()).run();
  return { ok: true, trialEndsAt };
}
