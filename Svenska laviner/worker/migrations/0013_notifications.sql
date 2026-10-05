-- Notifications for people: someone followed you, commented on or liked
-- your tour/observation/route, or answered in a thread you're part of.
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,            -- 'follow' | 'comment' | 'reply' | 'like'
  actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT,                -- 'tour' | 'observation' | 'route', null for follows
  item_id INTEGER,
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX notifications_user ON notifications(user_id, created_at);

-- Browsers that asked for push notifications about the above. Unlike
-- push_subscriptions (danger levels, anonymous), these are tied to an
-- account — only when the user turns it on.
CREATE TABLE user_push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX user_push_user ON user_push_subscriptions(user_id);
