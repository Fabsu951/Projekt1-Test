-- When the user ticked "Jag godkänner användarvillkoren" at signup (null for
-- accounts made before the terms existed, 2026-10-07).
ALTER TABLE users ADD COLUMN terms_accepted_at TEXT;
