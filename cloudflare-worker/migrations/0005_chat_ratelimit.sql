-- Per-IP fixed-window (60s) counters enforcing RATE_LIMIT_PER_MIN on the
-- public, LLM-backed chat endpoint. Stale windows are pruned opportunistically
-- from chat.js.
CREATE TABLE IF NOT EXISTS chat_rate (
  ip TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip, window_start)
);
