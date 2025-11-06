-- Add profile_timezone field to users table
-- This stores the user's timezone preference selected during their first campaign creation
-- Used to auto-populate timezone in future campaigns

ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_timezone TEXT DEFAULT 'America/New_York';

-- Add comment for documentation
COMMENT ON COLUMN users.profile_timezone IS 'User timezone preference, set during first campaign creation and used as default for future campaigns';

-- Update existing users to have the default timezone
UPDATE users
SET profile_timezone = 'America/New_York'
WHERE profile_timezone IS NULL;
