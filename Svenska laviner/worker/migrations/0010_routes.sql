-- Planned routes (ruttplanering): the points the user clicked, plus the
-- numbers the app worked out from elevation data when saving (shown in
-- lists only). Private unless the owner shares them by link.
CREATE TABLE routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  waypoints TEXT NOT NULL,
  distance_m INTEGER NOT NULL,
  ascent_m INTEGER,
  descent_m INTEGER,
  region_id TEXT,
  shared INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX routes_user ON routes(user_id, updated_at);
