-- "Prognos inför turen": the user plans a day in an area and gets the
-- forecast for that day as a notification when it is published (usually
-- 18:00 the evening before). notified_at is set once it has been sent.
CREATE TABLE trip_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region_id TEXT NOT NULL,
  date TEXT NOT NULL,            -- YYYY-MM-DD, Swedish date of the tour
  notified_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, region_id, date)
);
CREATE INDEX trip_plans_due ON trip_plans(region_id, date);

-- Notifications that aren't about a tour/route/observation (trip forecasts)
-- carry their own link.
ALTER TABLE notifications ADD COLUMN url TEXT;
