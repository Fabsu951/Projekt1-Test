-- Social features, Strava-style: follow people (one-way, no approval),
-- a feed of what they share, comments and likes.

CREATE TABLE follows (
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX follows_followee ON follows(followee_id);

-- item_type is 'tour', 'observation' or 'route'.
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX comments_item ON comments(item_type, item_id, created_at);
CREATE INDEX comments_user ON comments(user_id);

CREATE TABLE likes (
  item_type TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (item_type, item_id, user_id)
);
CREATE INDEX likes_user ON likes(user_id);

-- Tours can be shared with followers only. Visibility is then:
-- shared = 0 → only the owner; shared = 1, followers_only = 0 → everyone;
-- shared = 1, followers_only = 1 → the owner's followers.
ALTER TABLE tours ADD COLUMN followers_only INTEGER NOT NULL DEFAULT 0;
CREATE INDEX tours_user_created ON tours(user_id, created_at);
CREATE INDEX observations_user_created ON observations(user_id, created_at);
CREATE INDEX routes_user_created ON routes(user_id, created_at);
