-- Billing sessions (HelcimPay.js checkout state — secretToken never touches the browser)
CREATE TABLE IF NOT EXISTS billing_sessions (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id),
  tier           TEXT NOT NULL,
  interval       TEXT NOT NULL DEFAULT 'monthly',
  checkout_token TEXT NOT NULL,
  secret_token   TEXT NOT NULL,
  created_at     INTEGER NOT NULL
);

-- Add billing_interval to subscriptions for annual/monthly tracking
ALTER TABLE subscriptions ADD COLUMN billing_interval TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE subscriptions ADD COLUMN helcim_subscription_id TEXT;
