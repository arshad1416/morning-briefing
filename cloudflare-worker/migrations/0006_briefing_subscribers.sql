-- Free daily-briefing captures from logged-out visitors (landing-page form).
--
-- STANDALONE ON PURPOSE — no foreign key to users, and no row is ever written
-- into users for a capture. users.pw_hash is nullable (0001_init.sql), so a
-- public endpoint inserting there would create squattable rows with three
-- proven consequences (all reproduced against this tree before this table was
-- written):
--   1. auth_password.js:34 returns 409 email_taken for any existing row, so a
--      squatted capture permanently locks the real owner out of signup.
--   2. auth_oauth.js:72 fires its anti-hijack guard only `if (existing &&
--      existing.pw_hash)`, so a pw_hash-NULL capture falls through to
--      `existing || createUser(...)` at :85 and BECOMES the victim's Google
--      account.
--   3. auth_oauth.js:82's gate is `if (!existing && !consented)`, so a capture
--      row makes `existing` truthy and skips both the Terms/not-advice/
--      not-Quebec gate and insertConsent at :93.
--
-- CASL consent evidence is stored inline rather than in `consents`, because
-- consents.user_id REFERENCES users(id) and these rows are deliberately not
-- users. Same fields insertConsent() records: terms/ack version + timestamp,
-- plus the submitting IP.
--
-- `id` is the HMAC unsubscribe token subject, same format and same token as
-- users.id (briefing.js verifyToken / the Pi sender's unsub_token) so one
-- unsubscribe URL covers both kinds of recipient.
--
-- Unsubscribe SETS unsubscribed_at rather than deleting: the subscribe route is
-- INSERT OR IGNORE, so keeping the row makes an unsubscribe stick against a
-- re-submission of the same address.
--
-- Rate limiting for the subscribe route reuses the existing `chat_rate` table
-- (0005) — the chat endpoint it was built for has been deleted, so the table
-- has no other reader. See the comment on rateLimited() in briefing.js.
CREATE TABLE IF NOT EXISTS briefing_subscribers (
  email           TEXT PRIMARY KEY,
  id              TEXT NOT NULL UNIQUE,
  created_at      INTEGER NOT NULL,
  consent_ip      TEXT,
  terms_version   TEXT,
  ack_version     TEXT,
  unsubscribed_at INTEGER
);
