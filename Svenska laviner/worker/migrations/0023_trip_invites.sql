-- "Gemensam turdag": the one who planned a day invites people they follow.
-- Accepting plans the same day for the invitee (joined_trip_id), so they
-- get the forecast notice too; the inviter is told who joined.
CREATE TABLE trip_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES trip_plans(id) ON DELETE CASCADE,
  from_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'accepted' | 'declined'
  joined_trip_id INTEGER REFERENCES trip_plans(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  answered_at TEXT,
  UNIQUE (trip_id, to_user)
);
CREATE INDEX trip_invites_to ON trip_invites(to_user, status);
