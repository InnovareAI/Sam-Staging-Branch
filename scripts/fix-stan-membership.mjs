#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STAN_USER_ID = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';
const STAN_WORKSPACE_ID = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

async function fixStanMembership() {
  console.log('🔧 Fixing Stan Bounev membership...\n');

  // 1. Check workspace details
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', STAN_WORKSPACE_ID)
    .single();

  if (!workspace) {
    console.log('❌ Workspace not found!');
    return;
  }

  console.log('📁 Workspace Details:');
  console.log(`   Name: ${workspace.name}`);
  console.log(`   Tenant: ${workspace.tenant || 'None'}`);
  console.log(`   ID: ${workspace.id}\n`);

  // 2. Check if membership exists
  const { data: existingMembership } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', STAN_USER_ID)
    .eq('workspace_id', STAN_WORKSPACE_ID)
    .single();

  if (existingMembership) {
    console.log('✅ Membership already exists!');
    console.log(`   Role: ${existingMembership.role}\n`);
  } else {
    console.log('❌ No membership found. Creating...\n');

    // 3. Create membership
    const { data: newMembership, error } = await supabase
      .from('workspace_members')
      .insert({
        user_id: STAN_USER_ID,
        workspace_id: STAN_WORKSPACE_ID,
        role: 'admin',
        joined_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating membership:', error);
      return;
    }

    console.log('✅ Membership created successfully!');
    console.log(`   Role: ${newMembership.role}\n`);
  }

  // 4. Check LinkedIn accounts for this workspace
  const { data: linkedinAccounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', STAN_WORKSPACE_ID)
    .eq('account_type', 'linkedin');

  console.log('🔗 LinkedIn Accounts:');
  if (linkedinAccounts && linkedinAccounts.length > 0) {
    linkedinAccounts.forEach(acc => {
      console.log(`   - Account: ${acc.account_name || 'Unknown'}`);
      console.log(`     Status: ${acc.connection_status}`);
      console.log(`     Unipile ID: ${acc.unipile_account_id || 'None'}`);
    });
  } else {
    console.log('   ❌ NO LINKEDIN ACCOUNT CONNECTED!');
    console.log('   \n📋 ACTION REQUIRED:');
    console.log('   1. Stan needs to go to: https://app.meet-sam.com/linkedin-integration');
    console.log('   2. Click "Connect LinkedIn Account"');
    console.log('   3. Authorize via Unipile');
    console.log('   4. Then retry the search');
  }

  console.log('\n✅ Fix complete!');
}

fixStanMembership();
