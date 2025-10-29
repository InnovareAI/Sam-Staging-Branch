#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Identifying Failing Campaigns\n');

// Get the campaigns that failed in the cron run
// Campaign IDs from the error: a06abf27-4d2b-4f1b-b766-fbf3345f14fc and cd9b2ec8-4c6d-47a4-b3b8-761e84a39e06

const failingCampaignIds = [
  'a06abf27-4d2b-4f1b-b766-fbf3345f14fc',
  'cd9b2ec8-4c6d-47a4-b3b8-761e84a39e06'
];

for (const campaignId of failingCampaignIds) {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*, workspaces(*)')
    .eq('id', campaignId)
    .single();
  
  console.log(`\n📋 Campaign: ${campaign.name}`);
  console.log(`   Creator: ${campaign.created_by}`);
  console.log(`   Workspace: ${campaign.workspaces.name}`);
  
  // Check if creator has LinkedIn account
  const { data: linkedInAccount } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', campaign.workspace_id)
    .eq('user_id', campaign.created_by)
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected')
    .single();
  
  if (!linkedInAccount) {
    console.log(`   ❌ ISSUE: Creator has NO connected LinkedIn account`);
  } else {
    console.log(`   ✅ LinkedIn: ${linkedInAccount.account_name}`);
    console.log(`   Unipile ID: ${linkedInAccount.unipile_account_id}`);
  }
  
  // Check prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .limit(1);
  
  if (prospects && prospects.length > 0) {
    const p = prospects[0];
    console.log(`   Sample Prospect: ${p.first_name || 'NO NAME'} ${p.last_name || ''}`);
    console.log(`   LinkedIn URL: ${p.linkedin_url || 'MISSING'}`);
  }
}

console.log('\n\n🎯 ROOT CAUSE:');
console.log('   Campaigns fail when creator has no connected LinkedIn account');
console.log('   The cron tries to send but cannot find an account to use');
