-- Tour diary: imported GPS tracks. The full track lives in R2 (track_key);
-- these rows hold what lists and maps need. pin_* and the public bounds
-- come from the track with the hidden ends removed, so shared listings
-- never reveal where a tour started or ended.
CREATE TABLE tours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  duration_s INTEGER,
  distance_m INTEGER NOT NULL,
  ascent_m INTEGER NOT NULL,
  descent_m INTEGER NOT NULL,
  max_elevation_m INTEGER,
  region_id TEXT,
  shared INTEGER NOT NULL DEFAULT 1,
  hide_ends_m INTEGER NOT NULL DEFAULT 500,
  pin_lat REAL,
  pin_lon REAL,
  track_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX tours_user ON tours(user_id);
CREATE INDEX tours_shared_started ON tours(shared, started_at);
CREATE INDEX tours_region ON tours(region_id);
