-- Fix users table RLS policies for profile updates
-- Ensure users can update their own profile_country field

-- Drop existing update policies
DROP POLICY IF EXISTS "users_auth_update" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Create a comprehensive update policy
CREATE POLICY "users_can_update_own_profile" ON users 
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure profile_country column exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_country TEXT;

-- Add index for profile_country lookups
CREATE INDEX IF NOT EXISTS idx_users_profile_country ON users(profile_country);

-- Grant necessary permissions
GRANT UPDATE (profile_country, updated_at) ON users TO authenticated;

-- Verify RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Add a comment for documentation
COMMENT ON COLUMN users.profile_country IS '2-letter country code for proxy location preference (e.g., us, de, gb)';
