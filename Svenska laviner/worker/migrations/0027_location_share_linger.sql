-- A share that runs out without being stopped keeps its last point for 24 h
-- (in case something happened); this marks that the people it was shared
-- with have been told.
ALTER TABLE location_shares ADD COLUMN expired_notified_at TEXT;
