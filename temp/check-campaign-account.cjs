#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCampaignAccount() {
  console.log('🔍 Finding which LinkedIn account sent the campaign...\n');

  // Step 1: Get campaign and workspace info
  const { data: prospect } = await supabase
    .from('campaign_prospects')
    .select(`
      id,
      campaign_id,
      campaigns (
        name,
        workspace_id,
        workspaces (
          name
        )
      )
    `)
    .eq('id', '3a01253e-244e-40b8-84fb-f82767d541ab')
    .single();

  if (!prospect) {
    console.error('❌ Prospect not found');
    return;
  }

  console.log('📊 Campaign Details:');
  console.log(`   Campaign: ${prospect.campaigns.name}`);
  console.log(`   Workspace: ${prospect.campaigns.workspaces.name}`);
  console.log(`   Workspace ID: ${prospect.campaigns.workspace_id}\n`);

  // Step 2: Get LinkedIn account used (first one by created_at)
  const { data: account } = await supabase
    .from('workspace_accounts')
    .select(`
      account_name,
      account_identifier,
      unipile_account_id,
      connection_status,
      created_at,
      user_id
    `)
    .eq('workspace_id', prospect.campaigns.workspace_id)
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (!account) {
    console.error('❌ No LinkedIn account found for this workspace');
    return;
  }

  // Step 3: Get user email
  const { data: user } = await supabase.auth.admin.getUserById(account.user_id);

  console.log('🎯 LinkedIn Account Used to Send Campaign:');
  console.log(`   Account Name: ${account.account_name}`);
  console.log(`   User Email: ${user.user?.email || 'Unknown'}`);
  console.log(`   Unipile ID: ${account.unipile_account_id}`);
  console.log(`   Status: ${account.connection_status}`);
  console.log(`   Created: ${account.created_at}\n`);

  console.log('⚠️  CHECK LINKEDIN:');
  console.log(`   You must be logged into LinkedIn as: ${user.user?.email || account.account_name}`);
  console.log(`   Then go to: My Network → Manage → Sent\n`);
}

checkCampaignAccount().catch(console.error);
