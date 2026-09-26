-- Browsers that asked for a notification when the danger level changes in
-- their favourite regions. `regions` is a JSON array of region ids. Rows are
-- deleted when the push service reports the subscription gone (404/410).
CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  regions TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
