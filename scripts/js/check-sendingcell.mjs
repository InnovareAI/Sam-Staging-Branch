#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking Sendingcell Workspace...\n');

// Find Sendingcell workspace
const { data: workspaces } = await supabase
  .from('workspaces')
  .select('id, name')
  .ilike('name', '%sendingcell%');

if (!workspaces || workspaces.length === 0) {
  console.log('❌ No workspace found with name containing "sendingcell"');
  
  // List all workspaces
  const { data: allWorkspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .order('name');
  
  console.log('\n📋 Available workspaces:');
  allWorkspaces?.forEach(w => console.log(`  - ${w.name} (ID: ${w.id})`));
  process.exit(0);
}

const workspace = workspaces[0];
console.log(`📁 Workspace: ${workspace.name}`);
console.log(`   ID: ${workspace.id}\n`);

// Check LinkedIn accounts
const { data: accounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', workspace.id);

const linkedinAccounts = accounts?.filter(a => a.unipile_account_id);

console.log(`🔗 LinkedIn Accounts: ${linkedinAccounts?.length || 0}`);

if (linkedinAccounts && linkedinAccounts.length > 0) {
  for (const acc of linkedinAccounts) {
    console.log(`\n   Account ${linkedinAccounts.indexOf(acc) + 1}:`);
    console.log(`   - Unipile ID: ${acc.unipile_account_id}`);
    console.log(`   - Status: ${acc.status || 'active'}`);
    console.log(`   - Email: ${acc.email || 'N/A'}`);
    console.log(`   - Created: ${acc.created_at}`);
    
    // Verify account with Unipile API
    console.log('   - Verifying with Unipile...');
    try {
      const response = await fetch(`https://${process.env.UNIPILE_DSN}/api/v1/accounts/${acc.unipile_account_id}`, {
        method: 'GET',
        headers: {
          'X-API-KEY': process.env.UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const accountData = await response.json();
        console.log(`   ✅ Connected: ${accountData.provider} - ${accountData.email || accountData.identifier}`);
        console.log(`   - Account Status: ${accountData.status || 'active'}`);
      } else {
        console.log(`   ❌ Not connected (HTTP ${response.status})`);
      }
    } catch (error) {
      console.log(`   ❌ Error verifying: ${error.message}`);
    }
  }
} else {
  console.log('   ⚠️  No LinkedIn accounts found');
}

// Check campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('*')
  .eq('workspace_id', workspace.id)
  .order('created_at', { ascending: false });

console.log(`\n📢 Campaigns: ${campaigns?.length || 0}`);

if (campaigns && campaigns.length > 0) {
  for (const campaign of campaigns) {
    console.log(`\n   Campaign: ${campaign.name}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Created: ${campaign.created_at}`);
    
    // Check prospects
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('status')
      .eq('campaign_id', campaign.id);
    
    const statusCounts = {};
    prospects?.forEach(p => {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    });
    
    console.log(`   Prospects:`);
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`     - ${status}: ${count}`);
    });
    
    // Check for missing names
    const { data: missingNames } = await supabase
      .from('campaign_prospects')
      .select('id')
      .eq('campaign_id', campaign.id)
      .or('first_name.is.null,last_name.is.null');
    
    if (missingNames && missingNames.length > 0) {
      console.log(`   ⚠️  Warning: ${missingNames.length} prospects with missing names`);
    }
  }
}

// Check workspace members
const { data: members } = await supabase
  .from('workspace_members')
  .select('role, users(email)')
  .eq('workspace_id', workspace.id);

console.log(`\n👥 Team Members: ${members?.length || 0}`);
members?.forEach(m => {
  console.log(`   - ${m.users?.email || 'Unknown'} (${m.role})`);
});
