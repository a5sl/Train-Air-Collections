-- Bring Cloudflare D1 to parity with the self-hosted server:
-- 1) codeshare support (previously missing on this side)
-- 2) actual departure/arrival times for flights
-- Existing rows keep defaults (0 / NULL) and are not otherwise touched.

ALTER TABLE trips ADD COLUMN is_codeshare INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE trips ADD COLUMN operating_carrier TEXT;
ALTER TABLE trips ADD COLUMN operating_flight_number TEXT;
ALTER TABLE trips ADD COLUMN actual_departure_time TEXT;
ALTER TABLE trips ADD COLUMN actual_arrival_time TEXT;
