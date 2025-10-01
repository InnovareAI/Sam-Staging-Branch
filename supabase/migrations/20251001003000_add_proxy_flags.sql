-- Add missing flags to user_proxy_preferences and profile_country to users
-- Ensures inserts/updates from API routes do not fail

BEGIN;

ALTER TABLE user_proxy_preferences
  ADD COLUMN IF NOT EXISTS is_auto_assigned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_linkedin_based boolean DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_country text;

COMMIT;