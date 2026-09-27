-- Heatmap: a coarse copy of each tour's public line (hidden ends already
-- removed), as JSON [[lat, lon], ...], so the map can draw every shared
-- tour without reading each track from R2.
ALTER TABLE tours ADD COLUMN preview TEXT;
