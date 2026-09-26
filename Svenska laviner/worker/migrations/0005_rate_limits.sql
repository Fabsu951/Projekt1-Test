-- Short-lived counters against password guessing and signup spam. `key` is
-- a SHA-256 of e.g. "login-email:<email>" or "login-ip:<ip>", so neither
-- emails nor IP addresses are stored in the clear. Rows older than a day
-- are deleted as new attempts come in.
CREATE TABLE rate_limit_events (
  key TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX rate_limit_events_key_at ON rate_limit_events(key, at);
CREATE INDEX rate_limit_events_at ON rate_limit_events(at);
