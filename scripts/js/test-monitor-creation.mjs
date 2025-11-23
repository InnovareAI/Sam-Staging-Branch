#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMonitorCreation() {
  console.log('🧪 Testing LinkedIn Commenting Agent monitor creation...\n');

  // 1. Get the actual user from Supabase auth
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError) {
    console.error('❌ Failed to list users:', usersError);
    return;
  }

  console.log(`Found ${users.users.length} users in auth.users table`);

  if (users.users.length === 0) {
    console.error('❌ No users found in database');
    return;
  }

  const testUser = users.users[0];
  console.log(`Using user: ${testUser.email} (${testUser.id})\n`);

  // 2. Get workspace for this user
  const { data: membership, error: membershipError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', testUser.id)
    .single();

  if (membershipError) {
    console.error('❌ Failed to get workspace membership:', membershipError);
    return;
  }

  console.log(`User workspace: ${membership.workspace_id}\n`);

  // 3. Try to create a monitor
  const testMonitor = {
    hashtags: ['digitalmarketing', 'b2bsales'],
    keywords: ['lead generation'],
    status: 'active',
    workspace_id: membership.workspace_id,
    created_by: testUser.id
  };

  console.log('Creating test monitor with data:');
  console.log(JSON.stringify(testMonitor, null, 2));
  console.log();

  const { data, error } = await supabase
    .from('linkedin_post_monitors')
    .insert(testMonitor)
    .select()
    .single();

  if (error) {
    console.error('❌ FAILED:');
    console.error('   Message:', error.message);
    console.error('   Code:', error.code);
    console.error('   Details:', error.details);
    console.error('   Hint:', error.hint);
  } else {
    console.log('✅ Monitor created successfully!');
    console.log('\nMonitor details:');
    console.log(JSON.stringify(data, null, 2));

    // 4. Clean up - delete the test monitor
    console.log('\n🧹 Cleaning up test monitor...');
    const { error: deleteError } = await supabase
      .from('linkedin_post_monitors')
      .delete()
      .eq('id', data.id);

    if (deleteError) {
      console.error('⚠️  Failed to delete test monitor:', deleteError.message);
    } else {
      console.log('✅ Test monitor deleted');
    }
  }
}

testMonitorCreation();
