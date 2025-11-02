#!/usr/bin/env node

/**
 * Check mg@innovareai.com account workspace and campaigns
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkMgAccount() {
  console.log('🔍 Checking mg@innovareai.com Account');
  console.log('=====================================\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Step 1: Find user
    console.log('Step 1: Finding user mg@innovareai.com...');
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) throw userError;

    const mgUser = users.users.find(u => u.email === 'mg@innovareai.com');

    if (!mgUser) {
      console.error('❌ User mg@innovareai.com not found');
      process.exit(1);
    }

    console.log(`✅ Found user: ${mgUser.email}`);
    console.log(`   User ID: ${mgUser.id}\n`);

    // Step 2: Get workspace memberships
    console.log('Step 2: Getting workspace memberships...');
    const { data: memberships, error: memberError } = await supabase
      .from('workspace_members')
      .select(`
        workspace_id,
        role,
        workspaces (
          id,
          name,
          created_at
        )
      `)
      .eq('user_id', mgUser.id);

    if (memberError) throw memberError;

    console.log(`✅ Found ${memberships.length} workspace(s):\n`);

    memberships.forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.workspaces.name}`);
      console.log(`      Workspace ID: ${m.workspace_id}`);
      console.log(`      Role: ${m.role}\n`);
    });

    // Step 3: Get campaigns for each workspace
    for (const membership of memberships) {
      console.log(`\n📋 Campaigns in "${membership.workspaces.name}":`);
      console.log('─'.repeat(60));

      const { data: campaigns, error: campaignError } = await supabase
        .from('campaigns')
        .select('id, name, status, campaign_type, created_at')
        .eq('workspace_id', membership.workspace_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (campaignError) {
        console.error(`   ❌ Error fetching campaigns:`, campaignError.message);
        continue;
      }

      if (!campaigns || campaigns.length === 0) {
        console.log('   No campaigns found\n');
        continue;
      }

      campaigns.forEach((c, i) => {
        console.log(`\n   ${i + 1}. ${c.name}`);
        console.log(`      Campaign ID: ${c.id}`);
        console.log(`      Status: ${c.status}`);
        console.log(`      Type: ${c.campaign_type || 'N/A'}`);
        console.log(`      Created: ${new Date(c.created_at).toLocaleDateString()}`);
      });

      // Get campaign prospects count
      console.log('\n   📊 Campaign Prospects:');
      for (const campaign of campaigns) {
        const { count } = await supabase
          .from('campaign_prospects')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id);

        const { count: pendingCount } = await supabase
          .from('campaign_prospects')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .in('status', ['pending', 'queued_in_n8n']);

        console.log(`      ${campaign.name}: ${count} total, ${pendingCount} pending`);
      }
      console.log('');
    }

    // Step 4: Check workspace accounts (LinkedIn/Email)
    console.log('\n🔌 Workspace Accounts:');
    console.log('─'.repeat(60));

    for (const membership of memberships) {
      const { data: accounts, error: accountError } = await supabase
        .from('workspace_accounts')
        .select('account_type, account_name, connection_status, is_active')
        .eq('workspace_id', membership.workspace_id);

      if (accountError) {
        console.error(`   ❌ Error fetching accounts:`, accountError.message);
        continue;
      }

      console.log(`\n   Workspace: ${membership.workspaces.name}`);
      if (!accounts || accounts.length === 0) {
        console.log('   No accounts connected');
        continue;
      }

      accounts.forEach(acc => {
        const statusIcon = acc.is_active ? '🟢' : '🔴';
        console.log(`   ${statusIcon} ${acc.account_type}: ${acc.account_name} (${acc.connection_status})`);
      });
    }

    console.log('\n\n=================================');
    console.log('✅ Account Check Complete');
    console.log('=================================\n');

    // Provide next steps
    if (memberships.length > 0) {
      const firstWorkspace = memberships[0];
      console.log('🎯 Next Steps:');
      console.log('\n1. To test a campaign, you can either:');
      console.log('   a) Start a campaign from the UI');
      console.log('   b) Or trigger via API with:');
      console.log(`\n   curl -X POST http://localhost:3000/api/campaigns/linkedin/execute-via-n8n \\`);
      console.log(`     -H "Content-Type: application/json" \\`);
      console.log(`     -d '{"campaignId": "YOUR_CAMPAIGN_ID", "workspaceId": "${firstWorkspace.workspace_id}"}'`);
      console.log('\n2. Monitor n8n at: https://workflows.innovareai.com');
      console.log('3. Check execution logs in n8n for webhook payload\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.details) console.error('   Details:', error.details);
    process.exit(1);
  }
}

checkMgAccount().catch(console.error);
