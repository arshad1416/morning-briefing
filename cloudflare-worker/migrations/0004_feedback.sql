-- Durable feedback inbox. feedback.js has inserted into this table since the
-- AgenticOS dashboard work, but no migration ever created it, so every insert
-- died in its silent catch on a fresh DB. Columns match the insert exactly.
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  email TEXT,
  page TEXT,
  ip TEXT,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status, created_at);
