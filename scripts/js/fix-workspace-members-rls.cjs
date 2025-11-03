const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

(async () => {
  console.log('🔍 Checking workspace_members RLS policies...\n');

  // Step 1: Check current policies
  const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT policyname, cmd, qual::text, with_check::text
      FROM pg_policies
      WHERE tablename = 'workspace_members'
      ORDER BY policyname;
    `
  });

  if (policiesError) {
    console.log('Cannot query policies via RPC (expected)');
    console.log('Error:', policiesError.message);
  } else if (policies) {
    console.log('Current policies:');
    console.log(JSON.stringify(policies, null, 2));
  }

  console.log('\n🚨 CRITICAL: Infinite recursion in workspace_members RLS policy');
  console.log('');
  console.log('📋 MANUAL FIX REQUIRED:');
  console.log('======================');
  console.log('');
  console.log('1. Go to Supabase Dashboard SQL Editor:');
  console.log('   https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql');
  console.log('');
  console.log('2. Run this SQL to temporarily disable RLS:');
  console.log('');
  console.log('   ALTER TABLE workspace_members DISABLE ROW LEVEL SECURITY;');
  console.log('');
  console.log('3. Check which policies exist:');
  console.log('');
  console.log('   SELECT policyname, qual FROM pg_policies WHERE tablename = \'workspace_members\';');
  console.log('');
  console.log('4. Drop ALL policies on workspace_members:');
  console.log('');
  console.log('   DROP POLICY IF EXISTS "workspace_members_select_policy" ON workspace_members;');
  console.log('   DROP POLICY IF EXISTS "workspace_members_insert_policy" ON workspace_members;');
  console.log('   DROP POLICY IF EXISTS "workspace_members_update_policy" ON workspace_members;');
  console.log('   DROP POLICY IF EXISTS "workspace_members_delete_policy" ON workspace_members;');
  console.log('   -- Add any other policy names you see from step 3');
  console.log('');
  console.log('5. Re-enable RLS with correct policy:');
  console.log('');
  console.log('   ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;');
  console.log('');
  console.log('   CREATE POLICY "Users can see their own memberships"');
  console.log('   ON workspace_members FOR SELECT');
  console.log('   USING (user_id = auth.uid());');
  console.log('');
  console.log('   CREATE POLICY "Users can update their own memberships"');
  console.log('   ON workspace_members FOR UPDATE');
  console.log('   USING (user_id = auth.uid());');
  console.log('');
  console.log('6. Test that the recursion is fixed:');
  console.log('');
  console.log('   SELECT * FROM workspace_members LIMIT 1;');
  console.log('');

  // Try a simple query to confirm the issue
  console.log('🧪 Testing workspace_members query...\n');

  const { data, error } = await supabase
    .from('workspace_members')
    .select('id')
    .limit(1);

  if (error) {
    console.log('❌ Error (confirms infinite recursion):');
    console.log('   ', error.message);
  } else {
    console.log('✅ Query successful (issue may be resolved)');
    console.log('   Found', data?.length || 0, 'records');
  }
})();
