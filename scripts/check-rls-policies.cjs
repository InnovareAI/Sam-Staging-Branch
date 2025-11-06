require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRLSPolicies() {
  console.log('🔍 CHECKING RLS POLICIES');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Query pg_policies to see RLS policies on workspace_members
    const { data: policies, error } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual,
            with_check
          FROM pg_policies
          WHERE tablename = 'workspace_members'
          ORDER BY policyname;
        `
      })
      .catch(async () => {
        // Fallback: try direct query
        return await supabase
          .from('pg_policies')
          .select('*')
          .eq('tablename', 'workspace_members');
      });

    if (error) {
      console.log('⚠️  Cannot query pg_policies directly (expected in some setups)');
      console.log('   You need to check RLS policies in Supabase Dashboard:');
      console.log('');
      console.log('   1. Go to: https://supabase.com/dashboard/project/[your-project]');
      console.log('   2. Navigate to: Database → Tables → workspace_members');
      console.log('   3. Click on "RLS" tab');
      console.log('   4. Check policies for SELECT operations');
      console.log('');
      console.log('   Expected policy should be something like:');
      console.log('   ');
      console.log('   Policy Name: "Users can view their workspace memberships"');
      console.log('   Command: SELECT');
      console.log('   Using expression: (auth.uid() = user_id)');
      console.log('');
      console.log('❌ If this policy is missing or incorrect, that\'s the bug!');
      console.log('');
    } else if (policies && policies.length > 0) {
      console.log(`✅ Found ${policies.length} RLS policies on workspace_members:\n`);
      policies.forEach((policy, index) => {
        console.log(`Policy #${index + 1}: ${policy.policyname}`);
        console.log(`   Command: ${policy.cmd}`);
        console.log(`   Permissive: ${policy.permissive}`);
        console.log(`   Roles: ${JSON.stringify(policy.roles)}`);
        console.log(`   Using (qual): ${policy.qual || 'N/A'}`);
        console.log(`   With check: ${policy.with_check || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No RLS policies found on workspace_members table!');
      console.log('   This means RLS might be disabled or no policies are defined.');
      console.log('');
    }

    // Check if RLS is enabled on the table
    console.log('🔍 Checking if RLS is enabled on workspace_members...\n');

    const { data: tableInfo, error: tableError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT
            tablename,
            rowsecurity
          FROM pg_tables
          WHERE schemaname = 'public'
          AND tablename = 'workspace_members';
        `
      })
      .catch(async () => {
        // Alternative check
        return { data: null, error: new Error('Cannot query pg_tables') };
      });

    if (tableError || !tableInfo) {
      console.log('⚠️  Cannot check RLS status directly');
      console.log('   Check in Supabase Dashboard → Authentication → Policies');
      console.log('');
    } else if (tableInfo && tableInfo.length > 0) {
      const table = tableInfo[0];
      if (table.rowsecurity) {
        console.log('✅ RLS is ENABLED on workspace_members');
      } else {
        console.log('⚠️  RLS is DISABLED on workspace_members');
        console.log('   This could be a security issue!');
      }
      console.log('');
    }

    // Provide diagnostic SQL for user to run in Supabase SQL editor
    console.log('='.repeat(80));
    console.log('📋 DIAGNOSTIC SQL (Run this in Supabase SQL Editor):');
    console.log('='.repeat(80));
    console.log(`
-- Check RLS status
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'workspace_members';

-- Check RLS policies
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

-- Test if user can see their own membership
-- Replace USER_ID with actual user ID
SELECT
  workspace_id,
  user_id,
  role,
  status
FROM workspace_members
WHERE user_id = 'f6885ff3-deef-4781-8721-93011c990b1b'
AND workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
`);

    console.log('='.repeat(80));
    console.log('');

    // Recommended RLS policy
    console.log('📋 RECOMMENDED RLS POLICY (if missing):');
    console.log('='.repeat(80));
    console.log(`
-- Enable RLS on workspace_members (if not already enabled)
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own workspace memberships
CREATE POLICY "Users can view their workspace memberships"
ON workspace_members
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can view all members of their workspaces (alternative)
-- Use this if users need to see other members in their workspace
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

-- Grant access to service role (for API operations)
-- This should already exist, but just in case:
CREATE POLICY "Service role full access"
ON workspace_members
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
`);

    console.log('='.repeat(80));
    console.log('');

  } catch (error) {
    console.error('❌ Error checking RLS policies:', error);
  }
}

checkRLSPolicies();
