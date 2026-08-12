-- Multi-user: scope trips (and their images, via trip_id) to an owner email.
-- The owner column is backfilled by the assign-owner script after this migration.

ALTER TABLE trips ADD COLUMN owner TEXT;

CREATE INDEX idx_trips_owner ON trips(owner);

-- Backfill safety: rows with NULL owner are invisible to every user until the
-- assign-owner script sets them (so nothing becomes visible to a stranger).