console.log('🔍 RLS POLICY DIAGNOSTIC FOR workspace_members');
console.log('='.repeat(80));
console.log('');
console.log('📋 Run these SQL queries in Supabase SQL Editor:');
console.log('   https://supabase.com/dashboard → SQL Editor');
console.log('');
console.log('='.repeat(80));
console.log('');

console.log('-- QUERY 1: Check if RLS is enabled on workspace_members');
console.log('-- Expected: rls_enabled = true');
console.log(`
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'workspace_members';
`);

console.log('='.repeat(80));
console.log('');

console.log('-- QUERY 2: List all RLS policies on workspace_members');
console.log('-- Expected: At least 1 policy for SELECT operations');
console.log(`
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check
FROM pg_policies
WHERE tablename = 'workspace_members'
ORDER BY policyname;
`);

console.log('='.repeat(80));
console.log('');

console.log('-- QUERY 3: Test if specific user can access their membership');
console.log('-- This simulates what happens when the API runs with user auth');
console.log(`
-- First, set the user context (replace with actual user ID)
SELECT set_config('request.jwt.claims', '{"sub": "f6885ff3-deef-4781-8721-93011c990b1b"}', true);

-- Now try to query workspace_members (simulates API call)
SELECT
  workspace_id,
  user_id,
  role,
  status
FROM workspace_members
WHERE user_id = 'f6885ff3-deef-4781-8721-93011c990b1b'
AND workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

-- If this returns empty, RLS is blocking the query!
`);

console.log('='.repeat(80));
console.log('');

console.log('❓ EXPECTED RESULTS:');
console.log('');
console.log('✅ If working correctly:');
console.log('   - Query 1: rls_enabled = true');
console.log('   - Query 2: Shows policy like "Users can view their workspace memberships"');
console.log('   - Query 3: Returns 1 row with role=owner, status=active');
console.log('');
console.log('❌ If broken:');
console.log('   - Query 1: rls_enabled = false (BAD - table not protected)');
console.log('   - Query 2: No policies found (BAD - no access rules)');
console.log('   - Query 3: Returns empty (BAD - RLS blocking valid access)');
console.log('');

console.log('='.repeat(80));
console.log('');

console.log('🔧 FIX: If RLS is blocking valid access, run these commands:');
console.log('');
console.log('='.repeat(80));
console.log(`
-- Enable RLS on workspace_members (if not already enabled)
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Drop existing broken policies (if any)
DROP POLICY IF EXISTS "Users can view their workspace memberships" ON workspace_members;
DROP POLICY IF EXISTS "Users can view members of their workspaces" ON workspace_members;

-- Create correct RLS policy for user access
CREATE POLICY "Users can view their workspace memberships"
ON workspace_members
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Alternative: Allow users to see all members in their workspaces
-- Uncomment if users need to see other members:
/*
CREATE POLICY "Users can view members of their workspaces"
ON workspace_members
FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
  )
);
*/

-- Ensure service role has full access (for API operations)
CREATE POLICY "Service role full access"
ON workspace_members
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Verify policies were created
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'workspace_members';
`);

console.log('='.repeat(80));
console.log('');

console.log('📝 NOTES:');
console.log('');
console.log('1. The API uses createRouteHandlerClient which includes user auth context');
console.log('2. When RLS is enabled, Supabase filters queries based on auth.uid()');
console.log('3. If no policy matches auth.uid() = user_id, the query returns empty');
console.log('4. Empty result causes: if (accessError || !workspaceAccess) → 403 Access Denied');
console.log('');
console.log('5. DATABASE DATA IS CORRECT (verified by audit)');
console.log('6. USER HAS VALID MEMBERSHIP (role=owner, status=active)');
console.log('7. PROBLEM IS RLS POLICY, NOT DATA INTEGRITY');
console.log('');

console.log('='.repeat(80));
console.log('');

console.log('🎯 ROOT CAUSE:');
console.log('');
console.log('The workspace_members table either:');
console.log('   a) Has RLS enabled but NO policies (blocking all access)');
console.log('   b) Has a broken/incorrect policy that doesn\'t match auth.uid()');
console.log('   c) Has a policy that only works for service_role, not authenticated users');
console.log('');
console.log('When user tl@innovareai.com tries to create a campaign:');
console.log('   1. API checks workspace access via workspace_members query');
console.log('   2. RLS policy filters the query based on auth.uid()');
console.log('   3. Policy doesn\'t return the row (even though it exists)');
console.log('   4. API sees empty result and returns "Access denied to workspace"');
console.log('');

console.log('='.repeat(80));
console.log('');

console.log('✅ SOLUTION:');
console.log('');
console.log('Run the FIX SQL above in Supabase SQL Editor');
console.log('This will create the correct RLS policy allowing users to see their memberships');
console.log('');

console.log('='.repeat(80));
