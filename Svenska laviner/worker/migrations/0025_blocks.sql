-- Blocking another user (App Store guideline 1.2): the two stop seeing each
-- other's tours, observations, comments and names in search, can't follow,
-- comment on or like each other's things, and get no notices from each other.
CREATE TABLE blocks (
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX blocks_blocked ON blocks(blocked_id);
