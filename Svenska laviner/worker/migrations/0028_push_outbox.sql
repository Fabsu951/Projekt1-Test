-- Danger-level notices waiting to be sent (src/outbox.ts): one row per
-- browser or phone and change. They are sent a portion at a time, so no
-- single worker run goes over Cloudflare's limit of 50 outgoing requests.
--   channel   'web' (target = push endpoint) | 'native' (target = FCM token)
--   message   JSON {title, body, url, tag}, already in the recipient's language
CREATE TABLE push_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  target TEXT NOT NULL,
  message TEXT NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
