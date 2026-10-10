-- A planned tour day can name one of your saved routes. The app sends a
-- compact profile of the steep ground under it (aspect sector, height,
-- metres), so the forecast notice can say where the route meets the
-- forecast's avalanche problems. A snapshot: later edits to the route
-- need the day to be planned again.
ALTER TABLE trip_plans ADD COLUMN route_id INTEGER REFERENCES routes(id) ON DELETE SET NULL;
ALTER TABLE trip_plans ADD COLUMN route_title TEXT;
ALTER TABLE trip_plans ADD COLUMN route_steep TEXT;
