CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  pw_hash      TEXT,
  created_at   INTEGER NOT NULL,
  signup_ip    TEXT
);
CREATE TABLE oauth_identities (
  provider          TEXT NOT NULL,
  provider_user_id  TEXT NOT NULL,
  user_id           TEXT NOT NULL REFERENCES users(id),
  email             TEXT,
  created_at        INTEGER NOT NULL,
  PRIMARY KEY (provider, provider_user_id)
);
CREATE TABLE credentials (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id),
  credential_id  TEXT NOT NULL UNIQUE,
  public_key     TEXT NOT NULL,
  counter        INTEGER NOT NULL DEFAULT 0,
  transports     TEXT,
  created_at     INTEGER NOT NULL
);
CREATE TABLE webauthn_challenges (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  challenge   TEXT NOT NULL,
  type        TEXT NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE TABLE subscriptions (
  user_id             TEXT PRIMARY KEY REFERENCES users(id),
  tier                TEXT NOT NULL,
  status              TEXT NOT NULL,
  trial_ends_at       INTEGER,
  current_period_end  INTEGER,
  helcim_customer_id  TEXT,
  helcim_plan_id      TEXT
);
CREATE TABLE trial_claims (
  device_id   TEXT NOT NULL,
  ip          TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users(id),
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_trial_device ON trial_claims(device_id);
CREATE INDEX idx_trial_ip ON trial_claims(ip, created_at);
CREATE TABLE consents (
  user_id         TEXT NOT NULL REFERENCES users(id),
  terms_version   TEXT NOT NULL,
  ack_version     TEXT NOT NULL,
  quebec_attested INTEGER NOT NULL,
  ts              INTEGER NOT NULL
);
CREATE TABLE auth_events (
  id     TEXT PRIMARY KEY,
  email  TEXT,
  ip     TEXT,
  type   TEXT NOT NULL,
  ts     INTEGER NOT NULL
);
CREATE INDEX idx_auth_email_ts ON auth_events(email, ts);
CREATE INDEX idx_auth_ip_ts ON auth_events(ip, ts);
