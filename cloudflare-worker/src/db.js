import { randomId } from './util.js';

export async function createUser(DB, { email, pwHash = null, ip = null }) {
  const id = randomId();
  const now = Date.now();
  await DB.prepare('INSERT INTO users (id,email,pw_hash,created_at,signup_ip) VALUES (?,?,?,?,?)')
    .bind(id, email.toLowerCase(), pwHash, now, ip).run();
  return { id, email: email.toLowerCase(), created_at: now };
}
export async function getUserById(DB, id) {
  return DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
}
export async function getUserByEmail(DB, email) {
  return DB.prepare('SELECT * FROM users WHERE email=?').bind(email.toLowerCase()).first();
}
export async function setPassword(DB, userId, pwHash) {
  await DB.prepare('UPDATE users SET pw_hash=? WHERE id=?').bind(pwHash, userId).run();
}
export async function getSubscription(DB, userId) {
  return DB.prepare('SELECT * FROM subscriptions WHERE user_id=?').bind(userId).first();
}
export async function upsertSubscription(DB, userId, { tier, status, trialEndsAt = null, periodEnd = null, helcimCustomerId = null, helcimPlanId = null, billingInterval = 'monthly', helcimSubscriptionId = null }) {
  await DB.prepare(
    `INSERT INTO subscriptions (user_id,tier,status,trial_ends_at,current_period_end,helcim_customer_id,helcim_plan_id,billing_interval,helcim_subscription_id)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET tier=excluded.tier,status=excluded.status,
       trial_ends_at=excluded.trial_ends_at,current_period_end=excluded.current_period_end,
       helcim_customer_id=COALESCE(excluded.helcim_customer_id,subscriptions.helcim_customer_id),
       helcim_plan_id=COALESCE(excluded.helcim_plan_id,subscriptions.helcim_plan_id),
       billing_interval=excluded.billing_interval,
       helcim_subscription_id=COALESCE(excluded.helcim_subscription_id,subscriptions.helcim_subscription_id)`
  ).bind(userId, tier, status, trialEndsAt, periodEnd, helcimCustomerId, helcimPlanId, billingInterval, helcimSubscriptionId).run();
}
export async function insertConsent(DB, userId, { termsVersion, ackVersion, quebecAttested }) {
  await DB.prepare('INSERT INTO consents (user_id,terms_version,ack_version,quebec_attested,ts) VALUES (?,?,?,?,?)')
    .bind(userId, termsVersion, ackVersion, quebecAttested ? 1 : 0, Date.now()).run();
}
export async function logAuthEvent(DB, { email = null, ip = null, type }) {
  await DB.prepare('INSERT INTO auth_events (id,email,ip,type,ts) VALUES (?,?,?,?,?)')
    .bind(randomId(), email, ip, type, Date.now()).run();
}
export async function recentAuthFailures(DB, email, sinceMs) {
  const r = await DB.prepare("SELECT COUNT(*) n FROM auth_events WHERE email=? AND type='login_fail' AND ts>?")
    .bind(email.toLowerCase(), Date.now() - sinceMs).first();
  return r?.n || 0;
}
export async function getOauthIdentity(DB, provider, providerUserId) {
  return DB.prepare('SELECT * FROM oauth_identities WHERE provider=? AND provider_user_id=?').bind(provider, providerUserId).first();
}
export async function linkOauthIdentity(DB, { provider, providerUserId, userId, email }) {
  await DB.prepare('INSERT OR IGNORE INTO oauth_identities (provider,provider_user_id,user_id,email,created_at) VALUES (?,?,?,?,?)')
    .bind(provider, providerUserId, userId, email, Date.now()).run();
}
export async function addCredential(DB, { userId, credentialId, publicKey, counter, transports }) {
  await DB.prepare('INSERT INTO credentials (id,user_id,credential_id,public_key,counter,transports,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(randomId(), userId, credentialId, publicKey, counter, transports || null, Date.now()).run();
}
export async function getCredentialsByUser(DB, userId) {
  return (await DB.prepare('SELECT * FROM credentials WHERE user_id=?').bind(userId).all()).results || [];
}
export async function getCredentialById(DB, credentialId) {
  return DB.prepare('SELECT * FROM credentials WHERE credential_id=?').bind(credentialId).first();
}
export async function bumpCredentialCounter(DB, credentialId, counter) {
  await DB.prepare('UPDATE credentials SET counter=? WHERE credential_id=?').bind(counter, credentialId).run();
}
export async function putChallenge(DB, { userId = null, challenge, type, ttlMs = 300000 }) {
  const id = randomId();
  await DB.prepare('INSERT INTO webauthn_challenges (id,user_id,challenge,type,expires_at) VALUES (?,?,?,?,?)')
    .bind(id, userId, challenge, type, Date.now() + ttlMs).run();
  return id;
}
export async function takeChallenge(DB, id) {
  const row = await DB.prepare('SELECT * FROM webauthn_challenges WHERE id=?').bind(id).first();
  if (row) await DB.prepare('DELETE FROM webauthn_challenges WHERE id=?').bind(id).run();
  if (!row || row.expires_at < Date.now()) return null;
  return row;
}
// Cookie-keyed, single-use challenge store (CompCeiling passkey technique): the
// row id IS the value in the mg_wa_key cookie, so the client never echoes a
// challengeId back. Returns the challenge string (not the row) or null.
export async function storeWebauthnChallenge(DB, key, challenge, type, userId = null, ttlMs = 600000) {
  await DB.prepare(
    `INSERT INTO webauthn_challenges (id,user_id,challenge,type,expires_at) VALUES (?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id, challenge=excluded.challenge,
       type=excluded.type, expires_at=excluded.expires_at`,
  ).bind(key, userId, challenge, type, Date.now() + ttlMs).run();
}
export async function takeWebauthnChallenge(DB, key, type) {
  const row = await DB.prepare('SELECT * FROM webauthn_challenges WHERE id=? AND type=?').bind(key, type).first();
  await DB.prepare('DELETE FROM webauthn_challenges WHERE id=?').bind(key).run(); // single-use
  if (!row || row.expires_at < Date.now()) return null;
  return row.challenge;
}

// ── Billing sessions (HelcimPay.js checkout state) ──
export async function storeBillingSession(DB, { id, userId, tier, interval, checkoutToken, secretToken }) {
  await DB.prepare(
    `INSERT INTO billing_sessions (id,user_id,tier,interval,checkout_token,secret_token,created_at)
     VALUES (?,?,?,?,?,?,?)`
  ).bind(id, userId, tier, interval, checkoutToken, secretToken, Date.now()).run();
}
export async function takeBillingSession(DB, id) {
  const row = await DB.prepare('SELECT * FROM billing_sessions WHERE id=?').bind(id).first();
  await DB.prepare('DELETE FROM billing_sessions WHERE id=?').bind(id).run(); // single-use
  return row || null;
}
