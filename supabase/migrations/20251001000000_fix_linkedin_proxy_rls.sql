-- Fix LinkedIn proxy assignments RLS policy to work with Supabase auth
-- This ensures users can see their LinkedIn proxy assignments

-- Drop old policies that reference clerk_id or users table
DROP POLICY IF EXISTS "Users can access own linkedin proxy assignments" ON linkedin_proxy_assignments;
DROP POLICY IF EXISTS "linkedin_proxy_assignments_user_access" ON linkedin_proxy_assignments;

-- Create new policy using direct Supabase auth
CREATE POLICY "linkedin_proxy_assignments_user_access" ON linkedin_proxy_assignments
    FOR ALL USING (user_id = auth.uid());

-- Also add service role policy for API access
CREATE POLICY "service_role_access_linkedin_proxy_assignments" ON linkedin_proxy_assignments
    FOR ALL USING (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON linkedin_proxy_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON linkedin_proxy_assignments TO service_role;
