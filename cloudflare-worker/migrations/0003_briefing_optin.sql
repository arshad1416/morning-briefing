-- Opt-in for the free daily Morning Briefing email.
-- CASL: default OFF, explicit opt-in only (never pre-checked). Captured at
-- signup via an optional 4th checkbox and toggled from the account page.
-- Delivery pipeline is separate — this only records the preference.
ALTER TABLE users ADD COLUMN briefing_opt_in INTEGER NOT NULL DEFAULT 0;
