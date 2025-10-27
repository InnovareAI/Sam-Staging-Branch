#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUserLinkedInAccount() {
  console.log('🔍 Checking user tl@innovareai.com LinkedIn account...\n');

  // Get user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === 'tl@innovareai.com');

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log(`✅ User found: ${user.email} (${user.id})\n`);

  // Get user's workspace
  const { data: userProfile } = await supabase
    .from('users')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single();

  const workspaceId = userProfile?.current_workspace_id;
  console.log(`🏢 User workspace: ${workspaceId}\n`);

  // Get user's LinkedIn account
  const { data: linkedInAccount } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('account_type', 'linkedin')
    .single();

  if (!linkedInAccount) {
    console.log('❌ No LinkedIn account found for user');
    return;
  }

  console.log(`📱 LinkedIn Account:`);
  console.log(`   Name: ${linkedInAccount.account_name}`);
  console.log(`   Unipile Account ID: ${linkedInAccount.unipile_account_id}`);
  console.log(`   Connection Status: ${linkedInAccount.connection_status}`);
  console.log(`   Is Active: ${linkedInAccount.is_active}`);
  console.log(`   Sources:`, linkedInAccount.unipile_sources);

  if (linkedInAccount.unipile_sources && linkedInAccount.unipile_sources.length > 0) {
    console.log(`\n   📊 Source Details:`);
    linkedInAccount.unipile_sources.forEach((source, i) => {
      console.log(`      ${i + 1}. ID: ${source.id}`);
      console.log(`         Status: ${source.status}`);
      console.log(`         Type: ${source.type || 'N/A'}`);
    });

    const activeSource = linkedInAccount.unipile_sources.find(s => s.status === 'OK');
    if (activeSource) {
      console.log(`\n   ✅ Active source found: ${activeSource.id}`);
    } else {
      console.log(`\n   ❌ NO ACTIVE SOURCE!`);
      console.log(`   Available sources:`, linkedInAccount.unipile_sources.map(s => `${s.id} (${s.status})`));
    }
  } else {
    console.log(`\n   ❌ NO SOURCES ARRAY!`);
  }

  // Check the campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('name', '20251027-IAI-Outreach Campaign')
    .single();

  if (campaign) {
    console.log(`\n📋 Campaign: ${campaign.name}`);
    console.log(`   Campaign workspace: ${campaign.workspace_id}`);
    console.log(`   User workspace: ${workspaceId}`);
    console.log(`   Match: ${campaign.workspace_id === workspaceId ? '✅ YES' : '❌ NO'}`);
  }

  // Now test Unipile API directly
  console.log(`\n🔍 Testing Unipile API directly...`);
  const unipileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/accounts/${linkedInAccount.unipile_account_id}`;

  try {
    const response = await fetch(unipileUrl, {
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Account found in Unipile`);
      console.log(`   Name: ${data.name}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Sources:`, data.sources);

      if (data.sources && data.sources.length > 0) {
        const activeSource = data.sources.find(s => s.status === 'OK');
        if (activeSource) {
          console.log(`   ✅ Active source in Unipile: ${activeSource.id}`);
        } else {
          console.log(`   ❌ No active sources in Unipile!`);
        }
      }
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Error from Unipile: ${errorText}`);
    }
  } catch (error) {
    console.log(`   ❌ Exception: ${error.message}`);
  }
}

checkUserLinkedInAccount().catch(console.error);
