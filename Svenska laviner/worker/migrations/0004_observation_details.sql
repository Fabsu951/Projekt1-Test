-- Richer observations, in the spirit of Regobs: the warning signs the
-- observer saw (JSON array of ids from DANGER_SIGNS in observations.ts) and
-- an optional snow depth.
ALTER TABLE observations ADD COLUMN danger_signs TEXT NOT NULL DEFAULT '[]';
ALTER TABLE observations ADD COLUMN snow_depth_cm INTEGER;
CREATE INDEX observations_observed ON observations(observed_at);
