#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAutoApprovalSetup() {
  console.log('🧪 Testing auto-approval setup with new columns...\n');

  // Get a real user
  const { data: users } = await supabase.auth.admin.listUsers();
  const testUser = users.users[0];
  console.log(`Using user: ${testUser.email}`);

  // Get workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', testUser.id)
    .single();

  console.log(`Workspace: ${membership.workspace_id}\n`);

  // Create test monitor with all new fields
  const testMonitor = {
    hashtags: ['testautoapproval'],
    keywords: ['test'],
    status: 'active',
    workspace_id: membership.workspace_id,
    created_by: testUser.id,
    // New fields from migration 014
    timezone: 'America/Los_Angeles',
    daily_start_time: '08:00:00',
    auto_approve_enabled: true,
    auto_approve_start_time: '09:00:00',
    auto_approve_end_time: '18:00:00'
  };

  console.log('Creating test monitor with auto-approval settings:');
  console.log(JSON.stringify(testMonitor, null, 2));
  console.log();

  const { data, error } = await supabase
    .from('linkedin_post_monitors')
    .insert(testMonitor)
    .select()
    .single();

  if (error) {
    console.error('❌ FAILED to create monitor:', error.message);
    console.error('   Code:', error.code);
    console.error('   Details:', error.details);
    return;
  }

  console.log('✅ Monitor created successfully!\n');
  console.log('Monitor details:');
  console.log('─'.repeat(80));
  console.log(`ID: ${data.id}`);
  console.log(`Timezone: ${data.timezone}`);
  console.log(`Daily Start Time: ${data.daily_start_time}`);
  console.log(`Auto-Approve Enabled: ${data.auto_approve_enabled}`);
  console.log(`Auto-Approve Window: ${data.auto_approve_start_time} - ${data.auto_approve_end_time}`);
  console.log('─'.repeat(80));

  // Verify the data
  if (data.timezone === 'America/Los_Angeles' &&
      data.daily_start_time === '08:00:00' &&
      data.auto_approve_enabled === true &&
      data.auto_approve_start_time === '09:00:00' &&
      data.auto_approve_end_time === '18:00:00') {
    console.log('\n✅ All new columns working correctly!');
  } else {
    console.log('\n⚠️  Some fields did not save correctly');
  }

  // Clean up
  console.log('\n🧹 Cleaning up test monitor...');
  const { error: deleteError } = await supabase
    .from('linkedin_post_monitors')
    .delete()
    .eq('id', data.id);

  if (deleteError) {
    console.error('⚠️  Failed to delete test monitor:', deleteError.message);
  } else {
    console.log('✅ Test monitor deleted\n');
  }

  console.log('🎉 Auto-approval setup test complete!');
}

testAutoApprovalSetup();
