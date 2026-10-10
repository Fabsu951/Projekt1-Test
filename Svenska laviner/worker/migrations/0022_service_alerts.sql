-- The state of the forecast health check (health.ts): what is wrong right
-- now, since when, and when the admins were last emailed about it.
CREATE TABLE service_alerts (
  name TEXT PRIMARY KEY,
  problems TEXT NOT NULL,
  first_seen TEXT NOT NULL,
  last_sent TEXT
);
