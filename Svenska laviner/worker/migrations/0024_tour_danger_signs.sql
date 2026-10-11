-- Warning signs seen on a tour: NULL = not answered, '[]' = "inga
-- varningstecken", else a JSON array of the observation sign ids.
ALTER TABLE tours ADD COLUMN danger_signs TEXT;
