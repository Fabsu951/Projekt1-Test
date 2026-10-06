-- Where an imported tour came from, e.g. "hc:<Health Connect session id>",
-- so the same watch session is never imported twice, even from another
-- phone or after reinstalling the app.
ALTER TABLE tours ADD COLUMN source_ref TEXT;
CREATE UNIQUE INDEX tours_user_source ON tours (user_id, source_ref) WHERE source_ref IS NOT NULL;
