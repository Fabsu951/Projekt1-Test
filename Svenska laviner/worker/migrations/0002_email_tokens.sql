-- Email verification and password reset.

ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

-- Single-use links sent by email. Only a SHA-256 of the token is stored.
CREATE TABLE email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL, -- 'verify' | 'reset'
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX email_tokens_user ON email_tokens(user_id, purpose, created_at);
