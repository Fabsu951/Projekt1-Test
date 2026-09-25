-- One row per region and forecast day, recorded by the worker whenever it
-- fetches forecasts (cron + /forecasts cache misses). `date` is the
-- Swedish-time date the forecast is valid until; `problems` is a JSON array
-- of lavinprognoser.se problem slugs.
CREATE TABLE forecast_history (
  region_id TEXT NOT NULL,
  date TEXT NOT NULL,
  danger INTEGER NOT NULL CHECK (danger BETWEEN 1 AND 5),
  problems TEXT NOT NULL DEFAULT '[]',
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (region_id, date)
);
