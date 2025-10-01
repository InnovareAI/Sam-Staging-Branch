-- Quick fix for profile_country updates
-- Run this in Supabase SQL Editor

-- 1. Add the column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_country TEXT;

-- 2. Drop conflicting policies
DROP POLICY IF EXISTS "users_auth_update" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON users;

-- 3. Create a simple, permissive update policy
CREATE POLICY "users_can_update_own_profile" ON users 
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. Grant update permissions
GRANT UPDATE (profile_country, updated_at, first_name, last_name) ON users TO authenticated;

-- 5. Verify RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 6. Check if it worked
SELECT id, email, profile_country FROM users WHERE id = auth.uid();
