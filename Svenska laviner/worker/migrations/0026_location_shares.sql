-- "Dela position": a time-limited share of your latest position with people
-- you choose (your tour company or people you follow). Only the latest point
-- is kept, never a trail, and the rows are deleted when the share ends.
CREATE TABLE location_shares (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  lat REAL,
  lon REAL,
  accuracy REAL,
  position_at TEXT
);
CREATE INDEX location_shares_ends ON location_shares(ends_at);

CREATE TABLE location_share_viewers (
  user_id INTEGER NOT NULL REFERENCES location_shares(user_id) ON DELETE CASCADE,
  viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, viewer_id)
);
CREATE INDEX location_share_viewers_viewer ON location_share_viewers(viewer_id);
