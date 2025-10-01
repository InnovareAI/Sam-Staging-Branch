-- Fix RLS policy for linkedin_proxy_assignments
-- The current policy uses clerk_id which doesn't exist

-- Drop the old policy
DROP POLICY IF EXISTS "Users can access own linkedin proxy assignments" ON linkedin_proxy_assignments;

-- Create new policy that works with Supabase auth
CREATE POLICY "Users can access own linkedin proxy assignments" ON linkedin_proxy_assignments
    FOR ALL USING (user_id = auth.uid());

-- Also allow service role to insert (for the callback)
CREATE POLICY "Service role can manage all proxy assignments" ON linkedin_proxy_assignments
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
