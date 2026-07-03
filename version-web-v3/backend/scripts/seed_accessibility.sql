-- ============================================================================
-- seed_accessibility.sql
--
-- Seeds the places table with curated Hong Kong accessibility data.
-- Runs idempotently: only updates rows that exist (matched by name).
--
-- Usage:
--   psql -h HOST -U postgres -d inclusive_tourism_v1 -f seed_accessibility.sql
-- ============================================================================

BEGIN;

-- ==================== HIGH ACCESSIBILITY (score 5) ====================

UPDATE places SET accessibility_tags = ARRAY['step-free access','elevator','accessible toilet','tactile paving','wheelchair accessible'], accessibility_score = 5 WHERE LOWER(name) LIKE '%hong kong museum of art%';
UPDATE places SET accessibility_tags = ARRAY['step-free access','elevator','accessible toilet','wheelchair accessible'], accessibility_score = 5 WHERE LOWER(name) LIKE '%hong kong science museum%';
UPDATE places SET accessibility_tags = ARRAY['step-free access','elevator','accessible toilet'], accessibility_score = 5 WHERE LOWER(name) LIKE '%hong kong space museum%';
UPDATE places SET accessibility_tags = ARRAY['step-free access','elevator','accessible toilet','wheelchair accessible','hearing loop'], accessibility_score = 5 WHERE LOWER(name) LIKE '%m+ museum%';
UPDATE places SET accessibility_tags = ARRAY['step-free access','elevator','accessible toilet','wheelchair accessible','tactile paving'], accessibility_score = 5 WHERE LOWER(name) LIKE '%hong kong palace museum%';
UPDATE places SET accessibility_tags = ARRAY['step-free access','elevator','accessible toilet','tactile paving'], accessibility_score = 5 WHERE LOWER(name) LIKE '%hong kong park%';
UPDATE places SET accessibility_tags = ARRAY['step-free access','accessible toilet','wheelchair accessible'], accessibility_score = 5 WHERE LOWER(name) LIKE '%victoria park%';
UPDATE places SET accessibility_tags = ARRAY['step-free access','elevator','accessible toilet','wheelchair accessible'], accessibility_score = 5 WHERE LOWER(name) LIKE '%times square%' AND LOWER(name) LIKE '%causeway bay%';

-- ==================== MEDIUM ACCESSIBILITY (score 3) ====================

UPDATE places SET accessibility_tags = ARRAY['step-free access','elevator','accessible toilet','limited wheelchair parking'], accessibility_score = 3 WHERE LOWER(name) LIKE '%hong kong museum of history%';
UPDATE places SET accessibility_tags = ARRAY['step-free access','elevator','accessible toilet','ramp available'], accessibility_score = 3 WHERE LOWER(name) LIKE '%star ferry%' AND LOWER(name) LIKE '%tsim sha tsui%';
UPDATE places SET accessibility_tags = ARRAY['partial step-free access','limited wheelchair access'], accessibility_score = 3 WHERE LOWER(name) LIKE '%man mo temple%';
UPDATE places SET accessibility_tags = ARRAY['wheelchair accessible','no accessible toilet'], accessibility_score = 3 WHERE LOWER(name) LIKE '%temple street night market%';
UPDATE places SET accessibility_tags = ARRAY['wheelchair accessible','narrow aisles'], accessibility_score = 3 WHERE LOWER(name) LIKE '%ladies market%';
UPDATE places SET accessibility_tags = ARRAY['step-free access','elevator','accessible toilet'], accessibility_score = 3 WHERE LOWER(name) LIKE '%kowloon park%';
UPDATE places SET accessibility_tags = ARRAY['step-free access','tactile paving','accessible toilet'], accessibility_score = 3 WHERE LOWER(name) LIKE '%nan lian garden%';

-- ==================== LOW ACCESSIBILITY (score 1) ====================

UPDATE places SET accessibility_tags = ARRAY['steps at entrance','limited wheelchair access'], accessibility_score = 1 WHERE LOWER(name) LIKE '%wong tai sin temple%';
UPDATE places SET accessibility_tags = ARRAY['steps at entrance','narrow corridors'], accessibility_score = 1 WHERE LOWER(name) LIKE '%chi lin nunnery%';
UPDATE places SET accessibility_tags = ARRAY['hiking trail','no wheelchair access'], accessibility_score = 1 WHERE LOWER(name) LIKE '%lion rock%';
UPDATE places SET accessibility_tags = ARRAY['steep approach','limited wheelchair access'], accessibility_score = 1 WHERE LOWER(name) LIKE '%victoria peak garden%';

COMMIT;