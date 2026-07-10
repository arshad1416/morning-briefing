-- Helcim recurring billing. Mirrors the columns already applied to the live D1
-- (prod was provisioned ahead of this file); this keeps fresh deploys + the
-- vitest suite in parity.

-- Short-lived HelcimPay.js checkout state, keyed by an httpOnly cookie so the
-- secretToken (used to validate the transaction response) never reaches the
-- client. Single-use; deleted on confirm.
CREATE TABLE IF NOT EXISTS billing_sessions (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id),
  tier           TEXT NOT NULL,
  interval       TEXT NOT NULL DEFAULT 'monthly',
  checkout_token TEXT NOT NULL,
  secret_token   TEXT NOT NULL,
  created_at     INTEGER NOT NULL
);

-- monthly | annual, and the Helcim subscription id (for webhook reconciliation
-- + cancellation). helcim_customer_id / helcim_plan_id already exist from 0001.
ALTER TABLE subscriptions ADD COLUMN billing_interval TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE subscriptions ADD COLUMN helcim_subscription_id TEXT;
