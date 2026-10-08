-- Reports on tours, shared routes, comments and profiles (observations keep
-- their own `reports` table). One row per reporter and item. Comments are
-- hidden after three reports; everything else waits for an admin.
CREATE TABLE content_reports (
  item_type TEXT NOT NULL,       -- 'tour' | 'route' | 'comment' | 'profile'
  item_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (item_type, item_id, user_id)
);
CREATE INDEX content_reports_item ON content_reports(item_type, item_id);

ALTER TABLE comments ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;

-- Free text for notifications that need it: the reason given when an admin
-- removes something after a report ("moderation").
ALTER TABLE notifications ADD COLUMN note TEXT;
