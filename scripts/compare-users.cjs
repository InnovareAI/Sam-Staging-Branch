require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TARGET_USER = 'tl@innovareai.com';
const WORKING_USER = 'cl@innovareai.com';
const TARGET_WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

async function compareUsers() {
  console.log('🔍 USER COMPARISON REPORT');
  console.log('='.repeat(80));
  console.log(`Target User: ${TARGET_USER} (getting "Access denied")`);
  console.log(`Working User: ${WORKING_USER} (for comparison)`);
  console.log(`Workspace: ${TARGET_WORKSPACE_ID}`);
  console.log('='.repeat(80));
  console.log('');

  try {
    // Get both users
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const targetUser = users.find(u => u.email === TARGET_USER);
    const workingUser = users.find(u => u.email === WORKING_USER);

    if (!targetUser || !workingUser) {
      console.error('❌ Could not find one or both users');
      return;
    }

    // Compare auth data
    console.log('📋 AUTHENTICATION COMPARISON');
    console.log('-'.repeat(80));
    console.log('');

    const compareField = (field, target, working, label) => {
      const match = target === working;
      const symbol = match ? '✅' : '⚠️';
      console.log(`${symbol} ${label}:`);
      console.log(`   ${TARGET_USER}: ${target}`);
      console.log(`   ${WORKING_USER}: ${working}`);
      if (!match) console.log(`   ^ DIFFERENCE FOUND`);
      console.log('');
    };

    compareField(
      targetUser.email_confirmed_at ? 'Confirmed' : 'Not Confirmed',
      workingUser.email_confirmed_at ? 'Confirmed' : 'Not Confirmed',
      'Email Confirmed'
    );

    compareField(
      targetUser.user_metadata?.is_super_admin || false,
      workingUser.user_metadata?.is_super_admin || false,
      'Is Super Admin'
    );

    compareField(
      targetUser.user_metadata?.organization || 'N/A',
      workingUser.user_metadata?.organization || 'N/A',
      'Organization'
    );

    // Compare workspace memberships
    console.log('📋 WORKSPACE MEMBERSHIP COMPARISON');
    console.log('-'.repeat(80));
    console.log('');

    const { data: targetMembership } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', TARGET_WORKSPACE_ID)
      .eq('user_id', targetUser.id)
      .single();

    const { data: workingMembership } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', TARGET_WORKSPACE_ID)
      .eq('user_id', workingUser.id)
      .single();

    if (!targetMembership) {
      console.log(`❌ ${TARGET_USER}: NO MEMBERSHIP RECORD FOUND!`);
      console.log(`   This explains the "Access denied" error`);
    } else {
      console.log(`✅ ${TARGET_USER}:`);
      console.log(`   workspace_id: ${targetMembership.workspace_id}`);
      console.log(`   user_id: ${targetMembership.user_id}`);
      console.log(`   role: ${targetMembership.role}`);
      console.log(`   status: ${targetMembership.status}`);
      console.log(`   joined_at: ${new Date(targetMembership.joined_at).toLocaleString()}`);
    }
    console.log('');

    if (!workingMembership) {
      console.log(`❌ ${WORKING_USER}: NO MEMBERSHIP RECORD FOUND!`);
    } else {
      console.log(`✅ ${WORKING_USER}:`);
      console.log(`   workspace_id: ${workingMembership.workspace_id}`);
      console.log(`   user_id: ${workingMembership.user_id}`);
      console.log(`   role: ${workingMembership.role}`);
      console.log(`   status: ${workingMembership.status}`);
      console.log(`   joined_at: ${new Date(workingMembership.joined_at).toLocaleString()}`);
    }
    console.log('');

    if (targetMembership && workingMembership) {
      console.log('📊 DIFFERENCES:');
      console.log('-'.repeat(80));
      console.log('');

      if (targetMembership.role !== workingMembership.role) {
        console.log(`⚠️  Role: ${targetMembership.role} vs ${workingMembership.role}`);
      } else {
        console.log(`✅ Role: Both have "${targetMembership.role}"`);
      }

      if (targetMembership.status !== workingMembership.status) {
        console.log(`⚠️  Status: ${targetMembership.status} vs ${workingMembership.status}`);
      } else {
        console.log(`✅ Status: Both have "${targetMembership.status}"`);
      }

      const targetDate = new Date(targetMembership.joined_at);
      const workingDate = new Date(workingMembership.joined_at);
      const daysDiff = Math.abs((targetDate - workingDate) / (1000 * 60 * 60 * 24));

      console.log(`\n📅 Join Date Difference: ${daysDiff.toFixed(1)} days`);
      if (daysDiff > 7) {
        console.log(`   ${workingUser.email} joined first (${workingDate.toLocaleDateString()})`);
        console.log(`   ${targetUser.email} joined later (${targetDate.toLocaleDateString()})`);
      }
      console.log('');
    }

    // Test access check for both users
    console.log('📋 ACCESS CHECK SIMULATION');
    console.log('-'.repeat(80));
    console.log('');

    console.log(`Testing ${TARGET_USER}...`);
    const { data: targetAccess, error: targetError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', TARGET_WORKSPACE_ID)
      .eq('user_id', targetUser.id)
      .single();

    if (targetError || !targetAccess) {
      console.log(`   ❌ ACCESS DENIED`);
      if (targetError) {
        console.log(`   Error: ${targetError.message}`);
      }
    } else {
      console.log(`   ✅ ACCESS GRANTED (role: ${targetAccess.role})`);
    }
    console.log('');

    console.log(`Testing ${WORKING_USER}...`);
    const { data: workingAccess, error: workingError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', TARGET_WORKSPACE_ID)
      .eq('user_id', workingUser.id)
      .single();

    if (workingError || !workingAccess) {
      console.log(`   ❌ ACCESS DENIED`);
      if (workingError) {
        console.log(`   Error: ${workingError.message}`);
      }
    } else {
      console.log(`   ✅ ACCESS GRANTED (role: ${workingAccess.role})`);
    }
    console.log('');

    // Summary
    console.log('='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log('');

    const bothHaveMembership = targetMembership && workingMembership;
    const bothPassAccessCheck = targetAccess && workingAccess;

    if (bothHaveMembership && bothPassAccessCheck) {
      console.log('✅ Both users have valid workspace memberships');
      console.log('✅ Both users pass access check with service role key');
      console.log('');
      console.log('🎯 CONCLUSION:');
      console.log('   If tl@innovareai.com still gets "Access denied" in the app,');
      console.log('   the issue is RLS policies blocking authenticated user queries.');
      console.log('');
      console.log('   Service role: ✅ Works (bypasses RLS)');
      console.log('   Authenticated user: ❌ Fails (blocked by RLS)');
      console.log('');
      console.log('   FIX: Apply RLS policy SQL from QUICK_FIX_GUIDE.md');
    } else if (!targetMembership) {
      console.log('❌ tl@innovareai.com has NO workspace membership record');
      console.log('');
      console.log('🎯 CONCLUSION:');
      console.log('   Data integrity issue - membership record is missing.');
      console.log('');
      console.log('   FIX: Run this SQL:');
      console.log('');
      console.log(`   INSERT INTO workspace_members`);
      console.log(`     (workspace_id, user_id, role, status, joined_at)`);
      console.log(`   VALUES`);
      console.log(`     ('${TARGET_WORKSPACE_ID}',`);
      console.log(`      '${targetUser.id}',`);
      console.log(`      'owner',`);
      console.log(`      'active',`);
      console.log(`      NOW());`);
    } else {
      console.log('⚠️  Inconsistent state detected');
      console.log('   Review the output above to identify the issue.');
    }

    console.log('');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error during comparison:', error);
  }
}

compareUsers();
