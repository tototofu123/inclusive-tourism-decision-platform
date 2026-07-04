-- migration_002_place_details.sql
-- Adds opening_hours, price_level, phone, website columns to places table
-- Run: psql -h HOST -U postgres -d inclusive_tourism_v1 -f migration_002_place_details.sql

ALTER TABLE places ADD COLUMN IF NOT EXISTS opening_hours TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS price_level TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS website TEXT;
