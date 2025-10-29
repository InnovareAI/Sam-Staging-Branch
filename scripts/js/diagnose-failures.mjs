#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Diagnosing why connection requests are failing...\n');

// Check pending prospects across all campaigns
const { data: pendingProspects } = await supabase
  .from('campaign_prospects')
  .select(`
    id,
    first_name,
    last_name,
    linkedin_url,
    added_by_unipile_account,
    campaign_id,
    campaigns (
      id,
      name,
      created_by,
      workspace_id
    )
  `)
  .in('status', ['pending', 'approved', 'ready_to_message'])
  .not('linkedin_url', 'is', null)
  .limit(10);

console.log(`Found ${pendingProspects?.length || 0} pending prospects\n`);

// Check LinkedIn accounts
const { data: linkedinAccounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('account_type', 'linkedin')
  .eq('connection_status', 'connected');

console.log('📱 Connected LinkedIn Accounts:');
linkedinAccounts?.forEach((acc, i) => {
  console.log(`${i + 1}. ${acc.account_name}`);
  console.log(`   User ID: ${acc.user_id}`);
  console.log(`   Unipile ID: ${acc.unipile_account_id}`);
  console.log(`   Workspace: ${acc.workspace_id}`);
});
console.log();

// Analyze ownership issues
console.log('🔒 Ownership Analysis:');
const ownershipIssues = [];
const missingNames = [];

pendingProspects?.forEach(p => {
  const hasName = p.first_name && p.last_name;
  const campaign = p.campaigns;
  
  if (!hasName) {
    missingNames.push(p);
  }
  
  // Check if prospect can be messaged by campaign creator
  const campaignCreatorAccount = linkedinAccounts?.find(
    acc => acc.user_id === campaign.created_by && acc.workspace_id === campaign.workspace_id
  );
  
  if (!campaignCreatorAccount) {
    ownershipIssues.push({
      prospect: `${p.first_name || 'Unknown'} ${p.last_name || ''}`.trim(),
      campaign: campaign.name,
      issue: `Campaign creator (${campaign.created_by}) has no connected LinkedIn account`
    });
  } else if (p.added_by_unipile_account && p.added_by_unipile_account !== campaignCreatorAccount.unipile_account_id) {
    ownershipIssues.push({
      prospect: `${p.first_name || 'Unknown'} ${p.last_name || ''}`.trim(),
      campaign: campaign.name,
      issue: `Prospect added by ${p.added_by_unipile_account}, but campaign creator uses ${campaignCreatorAccount.unipile_account_id}`
    });
  }
});

console.log(`\n❌ Missing Names: ${missingNames.length}`);
console.log(`🚫 Ownership Issues: ${ownershipIssues.length}`);

if (ownershipIssues.length > 0) {
  console.log('\n🚫 Ownership Blocking:');
  ownershipIssues.slice(0, 5).forEach((issue, i) => {
    console.log(`${i + 1}. ${issue.prospect} (${issue.campaign})`);
    console.log(`   ${issue.issue}`);
  });
}

if (missingNames.length > 0) {
  console.log(`\n❌ Prospects with Missing Names: ${missingNames.length}`);
  console.log('   (Will be fixed by name enrichment in next deployment)');
}
