#!/usr/bin/env node

/**
 * Investigate the failed queue item with "Invalid parameters" error
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigateFailedQueueItem() {
  console.log('🔍 Investigating failed queue item...\n');

  const IRISH_UNIPILE_ID = 'ymtTx4xVQ6OVUFk83ctwtA';

  // Get Irish's account
  const { data: account } = await supabase
    .from('workspace_accounts')
    .select('id')
    .eq('unipile_account_id', IRISH_UNIPILE_ID)
    .single();

  if (!account) {
    console.log('❌ Account not found');
    return;
  }

  // Get all campaigns for Irish's account
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id')
    .eq('linkedin_account_id', account.id);

  const campaignIds = campaigns?.map(c => c.id) || [];

  // Get failed queue items
  const { data: failedItems, error } = await supabase
    .from('send_queue')
    .select('*')
    .in('campaign_id', campaignIds)
    .eq('status', 'failed');

  if (error) {
    console.error('❌ Error fetching failed items:', error);
    return;
  }

  if (!failedItems || failedItems.length === 0) {
    console.log('✅ No failed queue items found');
    return;
  }

  console.log(`❌ Found ${failedItems.length} failed queue item(s)\n`);

  for (const item of failedItems) {
    console.log('═════════════════════════════════════════════════════════════');
    console.log('FAILED QUEUE ITEM DETAILS:');
    console.log('═════════════════════════════════════════════════════════════\n');

    console.log('📋 Queue Item Info:');
    console.log(`   ID: ${item.id}`);
    console.log(`   Status: ${item.status}`);
    console.log(`   Scheduled For: ${new Date(item.scheduled_for).toLocaleString()}`);
    console.log(`   Created At: ${new Date(item.created_at).toLocaleString()}`);
    console.log(`   Updated At: ${new Date(item.updated_at).toLocaleString()}`);
    console.log('');

    console.log('❌ Error Details:');
    console.log(`   Error Message: ${item.error_message || 'Not specified'}`);
    console.log('');

    console.log('📝 Message Payload:');
    console.log(`   LinkedIn User ID: ${item.linkedin_user_id}`);
    console.log(`   Message: "${item.message}"`);
    console.log('');

    // Get the prospect details
    const { data: prospect, error: prospectError } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('id', item.prospect_id)
      .single();

    if (prospectError) {
      console.error('❌ Error fetching prospect:', prospectError);
    } else if (prospect) {
      console.log('👤 Prospect Details:');
      console.log(`   Name: ${prospect.first_name} ${prospect.last_name}`);
      console.log(`   Title: ${prospect.title || 'N/A'}`);
      console.log(`   Company: ${prospect.company_name || 'N/A'}`);
      console.log(`   LinkedIn URL: ${prospect.linkedin_url}`);
      console.log(`   Current Status: ${prospect.status}`);
      console.log(`   LinkedIn User ID: ${prospect.linkedin_user_id || 'Not set'}`);
      console.log('');
    }

    // Get the campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', item.campaign_id)
      .single();

    if (campaignError) {
      console.error('❌ Error fetching campaign:', campaignError);
    } else if (campaign) {
      console.log('📊 Campaign Details:');
      console.log(`   Name: ${campaign.campaign_name || '(unnamed)'}`);
      console.log(`   Status: ${campaign.status}`);
      console.log(`   LinkedIn Account ID: ${campaign.linkedin_account_id}`);
      console.log('');
    }

    console.log('🔍 Analysis:');
    console.log('─────────────────────────────────────────────────────────────');

    // Analyze the error
    if (item.error_message === 'Invalid parameters') {
      console.log('⚠️  "Invalid parameters" typically means:');
      console.log('   1. Missing required field (account_id, provider_id, or message)');
      console.log('   2. Invalid provider_id format');
      console.log('   3. Account ID mismatch');
      console.log('');

      console.log('✅ Checks:');
      console.log(`   - linkedin_user_id present: ${item.linkedin_user_id ? 'YES' : 'NO'}`);
      console.log(`   - message present: ${item.message ? 'YES' : 'NO'}`);
      console.log(`   - message length: ${item.message?.length || 0} chars`);

      if (prospect) {
        console.log(`   - prospect linkedin_url: ${prospect.linkedin_url ? 'YES' : 'NO'}`);
        console.log(`   - prospect status before: ${prospect.status}`);
      }
    }

    console.log('');
    console.log('═════════════════════════════════════════════════════════════\n');
  }

  // Check if there were any successful sends around the same time
  console.log('📊 Comparing with successful sends from same timeframe...\n');

  const failedTime = new Date(failedItems[0].scheduled_for);
  const timeStart = new Date(failedTime.getTime() - 30 * 60 * 1000); // 30 min before
  const timeEnd = new Date(failedTime.getTime() + 30 * 60 * 1000);   // 30 min after

  const { data: nearbySuccessful } = await supabase
    .from('send_queue')
    .select('id, status, scheduled_for, sent_at, linkedin_user_id')
    .in('campaign_id', campaignIds)
    .eq('status', 'sent')
    .gte('scheduled_for', timeStart.toISOString())
    .lte('scheduled_for', timeEnd.toISOString())
    .limit(3);

  if (nearbySuccessful && nearbySuccessful.length > 0) {
    console.log(`✅ ${nearbySuccessful.length} successful sends within 30 min window:`);
    nearbySuccessful.forEach((s, i) => {
      console.log(`   ${i + 1}. Scheduled: ${new Date(s.scheduled_for).toLocaleString()}`);
      console.log(`      Sent: ${new Date(s.sent_at).toLocaleString()}`);
      console.log(`      Provider ID: ${s.linkedin_user_id}`);
    });
    console.log('');
  }

  console.log('✅ Investigation complete');
}

investigateFailedQueueItem().catch(console.error);
