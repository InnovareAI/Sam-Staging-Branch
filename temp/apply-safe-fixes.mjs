#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

console.log('🔧 APPLYING SAFE QA MONITOR FIXES\n');
console.log('='.repeat(80));

async function cleanupArchivedCampaign() {
  console.log('\n📋 FIX 1: Clean up failed queue items from archived messenger campaign\n');

  const campaignId = '281feb3b-9d07-4844-9fe0-221665f0bb92';

  // First, verify it's archived
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, campaign_name, campaign_type, status')
    .eq('id', campaignId)
    .single();

  if (!campaign) {
    console.log('❌ Campaign not found');
    return;
  }

  console.log(`Campaign: ${campaign.campaign_name || 'Unnamed'}`);
  console.log(`Type: ${campaign.campaign_type}`);
  console.log(`Status: ${campaign.status}`);

  if (campaign.status !== 'archived') {
    console.log('⚠️  Campaign is not archived - skipping cleanup for safety');
    return;
  }

  // Count failed items
  const { count: failedCount } = await supabase
    .from('send_queue')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'failed');

  console.log(`\nFailed queue items: ${failedCount}`);

  if (!failedCount || failedCount === 0) {
    console.log('✅ No failed items to clean up');
    return;
  }

  // Delete failed items
  const { error, count } = await supabase
    .from('send_queue')
    .delete({ count: 'exact' })
    .eq('campaign_id', campaignId)
    .eq('status', 'failed');

  if (error) {
    console.log(`❌ Error: ${error.message}`);
    return;
  }

  console.log(`✅ Deleted ${count} failed queue items from archived campaign`);
}

async function checkEmailLinkedInMismatch() {
  console.log('\n\n📋 CHECK: Email accounts assigned to LinkedIn campaigns\n');
  console.log('='.repeat(80));

  // Find campaigns with wrong account type
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select(`
      id,
      campaign_name,
      campaign_type,
      status,
      user_unipile_accounts!inner (
        id,
        display_name,
        email,
        provider
      )
    `)
    .neq('status', 'archived')
    .not('linkedin_account_id', 'is', null);

  if (!campaigns || campaigns.length === 0) {
    console.log('No active campaigns found');
    return;
  }

  const mismatches = campaigns.filter(c => {
    const account = c.user_unipile_accounts;
    const campaignType = c.campaign_type || 'linkedin_only'; // NULL defaults to LinkedIn

    // Check if LinkedIn campaign using non-LinkedIn account
    const isLinkedInCampaign = campaignType === 'linkedin_only' ||
                               campaignType === 'messenger' ||
                               campaignType === 'multi_channel';

    return isLinkedInCampaign && account.provider !== 'LINKEDIN';
  });

  console.log(`Found ${mismatches.length} campaigns with account type mismatch:\n`);

  if (mismatches.length === 0) {
    console.log('✅ No mismatches found - all campaigns use correct account types');
    return;
  }

  mismatches.forEach(campaign => {
    const account = campaign.user_unipile_accounts;
    console.log(`🔴 Campaign: ${campaign.campaign_name || 'Unnamed'}`);
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Type: ${campaign.campaign_type || 'linkedin_only (default)'}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Account Provider: ${account.provider} ❌ (should be LINKEDIN)`);
    console.log(`   Account: ${account.display_name || account.email || 'Unknown'}`);
    console.log('');
  });

  console.log('⚠️  These campaigns require manual intervention:');
  console.log('   1. Either change campaign type to match account type');
  console.log('   2. Or assign a different account with correct provider type');
}

async function main() {
  try {
    await cleanupArchivedCampaign();
    await checkEmailLinkedInMismatch();

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Safe fixes applied!\n');
    console.log('📄 See temp/QA_MONITOR_RESOLUTION_REPORT_DEC19.md for full report\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
