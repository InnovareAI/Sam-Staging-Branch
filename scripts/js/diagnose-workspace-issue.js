#!/usr/bin/env node

/**
 * Diagnostic Script: User Workspace Issue
 *
 * User: tl@innovareai.com
 * Issue: "No Workspace Selected" error
 * Console shows: "✅ [WORKSPACE LOAD] API returned 0 workspaces"
 *
 * This script checks:
 * 1. Does the user exist in auth.users?
 * 2. Does the user have records in workspace_members?
 * 3. Are there ANY workspaces in the database?
 * 4. What does the /api/workspace/list query actually return?
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://latxadqrvrrrcvkktrog.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const USER_EMAIL = 'tl@innovareai.com';

async function diagnose() {
  console.log('🔍 WORKSPACE DIAGNOSTIC FOR:', USER_EMAIL);
  console.log('━'.repeat(80));

  // Step 1: Find user in auth.users
  console.log('\n📋 STEP 1: Finding user in auth.users...');
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('❌ Error fetching auth users:', authError.message);
    return;
  }

  const user = authUsers.users.find(u => u.email === USER_EMAIL);

  if (!user) {
    console.error(`❌ User ${USER_EMAIL} NOT FOUND in auth.users`);
    console.log('\n🔍 All users in database:');
    authUsers.users.forEach(u => {
      console.log(`   - ${u.email} (ID: ${u.id})`);
    });
    return;
  }

  console.log(`✅ User found in auth.users`);
  console.log(`   User ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Created: ${user.created_at}`);

  // Step 2: Check users table for current_workspace_id
  console.log('\n📋 STEP 2: Checking users table for current_workspace_id...');
  const { data: userRecord, error: userError } = await supabase
    .from('users')
    .select('id, email, current_workspace_id')
    .eq('id', user.id)
    .single();

  if (userError) {
    console.error('❌ Error fetching user record:', userError.message);
  } else {
    console.log(`✅ User record found`);
    console.log(`   Current Workspace ID: ${userRecord.current_workspace_id || 'NULL'}`);
  }

  // Step 3: Check workspace_members for this user
  console.log('\n📋 STEP 3: Checking workspace_members table...');
  const { data: memberships, error: memberError } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', user.id);

  if (memberError) {
    console.error('❌ Error fetching workspace_members:', memberError.message);
  } else {
    console.log(`📊 Found ${memberships.length} workspace membership(s)`);

    if (memberships.length === 0) {
      console.log('⚠️  USER HAS NO WORKSPACE MEMBERSHIPS!');
    } else {
      memberships.forEach((m, i) => {
        console.log(`\n   Membership ${i + 1}:`);
        console.log(`   - Workspace ID: ${m.workspace_id}`);
        console.log(`   - Role: ${m.role}`);
        console.log(`   - Status: ${m.status}`);
        console.log(`   - Created: ${m.created_at}`);
      });
    }
  }

  // Step 4: Check if there are ANY workspaces in the database
  console.log('\n📋 STEP 4: Checking for workspaces in database...');
  const { data: allWorkspaces, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, name, created_at');

  if (workspaceError) {
    console.error('❌ Error fetching workspaces:', workspaceError.message);
  } else {
    console.log(`📊 Found ${allWorkspaces.length} total workspace(s) in database`);

    if (allWorkspaces.length === 0) {
      console.log('⚠️  NO WORKSPACES EXIST IN DATABASE!');
    } else {
      allWorkspaces.forEach((w, i) => {
        console.log(`\n   Workspace ${i + 1}:`);
        console.log(`   - ID: ${w.id}`);
        console.log(`   - Name: ${w.name}`);
        console.log(`   - Created: ${w.created_at}`);
      });
    }
  }

  // Step 5: Simulate the /api/workspace/list query
  console.log('\n📋 STEP 5: Simulating /api/workspace/list query...');

  // First, get memberships with status = 'active'
  const { data: activeMemberships, error: activeError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (activeError) {
    console.error('❌ Error fetching active memberships:', activeError.message);
  } else {
    console.log(`📊 Found ${activeMemberships.length} ACTIVE membership(s)`);

    if (activeMemberships.length === 0) {
      console.log('⚠️  USER HAS NO ACTIVE WORKSPACE MEMBERSHIPS!');
      console.log('   This is why /api/workspace/list returns 0 workspaces');
    } else {
      const workspaceIds = activeMemberships.map(m => m.workspace_id);

      // Fetch workspace details
      const { data: workspaceData, error: wsError } = await supabase
        .from('workspaces')
        .select('id, name')
        .in('id', workspaceIds);

      if (wsError) {
        console.error('❌ Error fetching workspace details:', wsError.message);
      } else {
        console.log(`✅ API would return ${workspaceData.length} workspace(s):`);
        workspaceData.forEach((w, i) => {
          console.log(`\n   Workspace ${i + 1}:`);
          console.log(`   - ID: ${w.id}`);
          console.log(`   - Name: ${w.name}`);
        });
      }
    }
  }

  // Step 6: Check for other possible issues
  console.log('\n📋 STEP 6: Additional checks...');

  // Check if there are inactive memberships
  const { data: inactiveMemberships, error: inactiveError } = await supabase
    .from('workspace_members')
    .select('workspace_id, status')
    .eq('user_id', user.id)
    .neq('status', 'active');

  if (!inactiveError && inactiveMemberships.length > 0) {
    console.log(`⚠️  Found ${inactiveMemberships.length} INACTIVE membership(s):`);
    inactiveMemberships.forEach((m, i) => {
      console.log(`   ${i + 1}. Workspace ${m.workspace_id} - Status: ${m.status}`);
    });
  }

  // Summary
  console.log('\n━'.repeat(80));
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log('━'.repeat(80));

  if (memberships && memberships.length === 0) {
    console.log('\n❌ ROOT CAUSE: User has NO workspace memberships at all');
    console.log('   Solution: Create a workspace membership record for this user');
  } else if (activeMemberships && activeMemberships.length === 0) {
    console.log('\n❌ ROOT CAUSE: User has workspace memberships but none are ACTIVE');
    console.log('   Current statuses:', memberships.map(m => m.status).join(', '));
    console.log('   Solution: Update workspace_members.status to "active" for this user');
  } else if (allWorkspaces && allWorkspaces.length === 0) {
    console.log('\n❌ ROOT CAUSE: No workspaces exist in the database');
    console.log('   Solution: Create a workspace for this user');
  } else {
    console.log('\n✅ User should have access to workspaces');
    console.log('   This suggests an RLS policy or authentication issue');
  }

  console.log('\n━'.repeat(80));
}

diagnose()
  .then(() => {
    console.log('\n✅ Diagnostic complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Diagnostic failed:', error);
    process.exit(1);
  });
