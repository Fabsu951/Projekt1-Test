-- Profile pictures: R2 key (avatar/<uuid>.<ext>) of the user's picture, if any.
ALTER TABLE users ADD COLUMN avatar_key TEXT;
