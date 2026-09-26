-- A signed-in user's starred regions (JSON array of region ids), so they
-- follow the account between devices.
ALTER TABLE users ADD COLUMN favorites TEXT NOT NULL DEFAULT '[]';
