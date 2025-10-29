#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Auditing all workspaces and LinkedIn accounts...\n');

// Get all workspaces
const { data: workspaces } = await supabase
  .from('workspaces')
  .select('id, name');

console.log(`Found ${workspaces?.length || 0} workspaces\n`);

for (const workspace of workspaces || []) {
  console.log(`\n📁 Workspace: ${workspace.name}`);
  console.log(`   ID: ${workspace.id}`);
  
  // Get LinkedIn accounts
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', workspace.id);
  
  const linkedinAccounts = accounts?.filter(a => a.unipile_account_id);
  
  console.log(`   LinkedIn Accounts: ${linkedinAccounts?.length || 0}`);
  
  linkedinAccounts?.forEach(acc => {
    console.log(`     - Unipile ID: ${acc.unipile_account_id}`);
    console.log(`       Status: ${acc.status || 'active'}`);
  });
  
  // Get campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status')
    .eq('workspace_id', workspace.id);
  
  console.log(`   Campaigns: ${campaigns?.length || 0}`);
  
  for (const campaign of campaigns || []) {
    // Check for prospects with missing names
    const { data: missingNames } = await supabase
      .from('campaign_prospects')
      .select('id, status')
      .eq('campaign_id', campaign.id)
      .or('first_name.is.null,last_name.is.null')
      .limit(1);
    
    if (missingNames && missingNames.length > 0) {
      const { count } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .or('first_name.is.null,last_name.is.null');
      
      console.log(`     ⚠️  ${campaign.name}: ${count} prospects missing names`);
    }
  }
}

console.log('\n\n📊 Summary: Checking for systemic issues...\n');

// Check all campaigns with failed prospects
const { data: allFailed } = await supabase
  .from('campaign_prospects')
  .select('campaign_id, campaigns(name, workspace_id, workspaces(name))')
  .eq('status', 'failed');

const failedByCampaign = {};
allFailed?.forEach(p => {
  const key = p.campaign_id;
  failedByCampaign[key] = failedByCampaign[key] || {
    campaign: p.campaigns?.name,
    workspace: p.campaigns?.workspaces?.name,
    count: 0
  };
  failedByCampaign[key].count++;
});

console.log('Campaigns with failed prospects:');
Object.values(failedByCampaign).forEach(c => {
  console.log(`  - ${c.workspace} / ${c.campaign}: ${c.count} failed`);
});
