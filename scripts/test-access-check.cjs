require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TARGET_USER_ID = 'f6885ff3-deef-4781-8721-93011c990b1b'; // tl@innovareai.com
const TARGET_WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

async function testAccessCheck() {
  console.log('🔍 Testing Access Check Logic');
  console.log('='.repeat(80));
  console.log(`User ID: ${TARGET_USER_ID}`);
  console.log(`Workspace ID: ${TARGET_WORKSPACE_ID}`);
  console.log('');

  try {
    // Simulate the exact query from the API
    console.log('📝 Executing query (same as API):');
    console.log(`   .from('workspace_members')`);
    console.log(`   .select('role')`);
    console.log(`   .eq('workspace_id', '${TARGET_WORKSPACE_ID}')`);
    console.log(`   .eq('user_id', '${TARGET_USER_ID}')`);
    console.log(`   .single()`);
    console.log('');

    const { data: workspaceAccess, error: accessError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', TARGET_WORKSPACE_ID)
      .eq('user_id', TARGET_USER_ID)
      .single();

    console.log('📊 Result:');
    console.log(`   Error: ${accessError ? JSON.stringify(accessError, null, 2) : 'null'}`);
    console.log(`   Data: ${workspaceAccess ? JSON.stringify(workspaceAccess, null, 2) : 'null'}`);
    console.log('');

    // Check the condition from the API
    if (accessError || !workspaceAccess) {
      console.log('❌ ACCESS DENIED');
      console.log('   This is what the API would return: "Access denied to workspace"');
      console.log('');

      if (accessError) {
        console.log('   Error details:');
        console.log(`      code: ${accessError.code}`);
        console.log(`      message: ${accessError.message}`);
        console.log(`      details: ${accessError.details}`);
        console.log(`      hint: ${accessError.hint}`);
      }
      if (!workspaceAccess) {
        console.log('   Data is falsy/null');
      }
    } else {
      console.log('✅ ACCESS GRANTED');
      console.log(`   User role: ${workspaceAccess.role}`);
    }

    console.log('');
    console.log('='.repeat(80));

    // Now test using the anon key (what the frontend uses)
    console.log('\n🔍 Testing with ANON key (simulating frontend request)');
    console.log('='.repeat(80));

    const anonSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // We can't set auth without a real session, so just explain
    console.log('⚠️  NOTE: Cannot test with anon key without valid session token');
    console.log('   Frontend requests include auth token in cookies/headers');
    console.log('   RLS policies filter based on auth.uid()');
    console.log('');

    // Test RLS policy behavior
    console.log('🔍 Checking if RLS policies might be blocking access...');

    // Query all workspace_members to see if RLS is enabled
    const { data: allMembers, error: allError } = await supabase
      .from('workspace_members')
      .select('user_id, workspace_id, role, status')
      .eq('workspace_id', TARGET_WORKSPACE_ID)
      .limit(10);

    if (allError) {
      console.log(`❌ Error fetching all members: ${allError.message}`);
    } else {
      console.log(`✅ Can query workspace_members (${allMembers?.length} records)`);
      console.log('   RLS is working correctly with service role key');
      console.log('');

      // Check if target user is in the list
      const targetMember = allMembers?.find(m => m.user_id === TARGET_USER_ID);
      if (targetMember) {
        console.log(`   ✅ Target user found in workspace:`);
        console.log(`      role: ${targetMember.role}`);
        console.log(`      status: ${targetMember.status}`);
      } else {
        console.log(`   ❌ Target user NOT found in workspace members`);
      }
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

testAccessCheck();
