-- The language people read the app in, so notifications, push and emails
-- can use it too: per account, and per browser/phone for danger-level
-- notices (those aren't tied to an account).
ALTER TABLE users ADD COLUMN lang TEXT NOT NULL DEFAULT 'sv';
ALTER TABLE push_subscriptions ADD COLUMN lang TEXT NOT NULL DEFAULT 'sv';
ALTER TABLE native_devices ADD COLUMN lang TEXT NOT NULL DEFAULT 'sv';
