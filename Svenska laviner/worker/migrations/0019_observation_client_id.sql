-- Observations saved on the phone without coverage are sent later, maybe
-- more than once if an answer gets lost; the app's own id for each one
-- makes the second send a no-op.
ALTER TABLE observations ADD COLUMN client_id TEXT;
CREATE UNIQUE INDEX observations_client ON observations(user_id, client_id) WHERE client_id IS NOT NULL;
