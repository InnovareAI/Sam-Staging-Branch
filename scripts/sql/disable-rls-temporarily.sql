-- Temporarily disable RLS to test if monitor appears
ALTER TABLE linkedin_post_monitors DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'linkedin_post_monitors';
