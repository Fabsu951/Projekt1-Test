-- Phones running the Android/iOS app that asked for push notifications,
-- delivered through Firebase Cloud Messaging (which hands iPhone messages
-- to Apple's APNs). One row per device token.
--   regions          JSON array of area ids: danger-level changes (no account needed)
--   user_id          set only when the user turned on account notices on this device
CREATE TABLE native_devices (
  token TEXT PRIMARY KEY,
  platform TEXT NOT NULL,          -- 'android' | 'ios'
  regions TEXT NOT NULL DEFAULT '[]',
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX native_devices_user ON native_devices(user_id);
