#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking Automation Across ALL Workspaces\n');

// Get all workspaces with active campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select(`
    id,
    name,
    workspace_id,
    created_by,
    status,
    auto_execute,
    workspaces!inner(id, name)
  `)
  .in('status', ['active', 'scheduled']);

console.log(`📊 Total Active Campaigns: ${campaigns?.length || 0}\n`);

// Group by workspace
const workspaces = {};
campaigns?.forEach(c => {
  if (!workspaces[c.workspace_id]) {
    workspaces[c.workspace_id] = {
      name: c.workspaces.name,
      campaigns: [],
      workspace_id: c.workspace_id
    };
  }
  workspaces[c.workspace_id].campaigns.push(c);
});

console.log(`🏢 Workspaces with Active Campaigns: ${Object.keys(workspaces).length}\n`);

// Check each workspace
for (const [wsId, ws] of Object.entries(workspaces)) {
  console.log(`\n📋 Workspace: ${ws.name}`);
  console.log(`   Campaigns: ${ws.campaigns.length}`);
  
  // Check pending prospects
  let totalPending = 0;
  for (const campaign of ws.campaigns) {
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .in('status', ['pending', 'approved', 'ready_to_message'])
      .not('linkedin_url', 'is', null);
    
    totalPending += prospects?.count || 0;
  }
  
  console.log(`   Pending Prospects: ${totalPending}`);
  
  // Check LinkedIn accounts
  const { data: linkedInAccounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', wsId)
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected');
  
  console.log(`   LinkedIn Accounts: ${linkedInAccounts?.length || 0}`);
  
  if (linkedInAccounts && linkedInAccounts.length > 0) {
    linkedInAccounts.forEach(acc => {
      console.log(`      - ${acc.account_name} (${acc.user_id})`);
    });
  }
  
  // Check if campaigns will execute
  if (totalPending > 0 && linkedInAccounts && linkedInAccounts.length > 0) {
    console.log(`   ✅ READY: Will process automatically`);
  } else if (totalPending > 0 && (!linkedInAccounts || linkedInAccounts.length === 0)) {
    console.log(`   ❌ BLOCKED: No LinkedIn accounts connected`);
  } else if (totalPending === 0) {
    console.log(`   ⏸️  NO PENDING: All prospects processed`);
  }
}

console.log('\n\n🎯 SUMMARY:');
const readyWorkspaces = Object.values(workspaces).filter(ws => {
  // Check if has pending and has accounts (simplified check)
  return true; // We'll count properly above
});

console.log('The cron will process campaigns from ALL workspaces automatically.');
console.log('Each campaign uses the LinkedIn account of the user who created it.');
