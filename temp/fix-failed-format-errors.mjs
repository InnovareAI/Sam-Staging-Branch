#!/usr/bin/env node
/**
 * Fix Failed Format Errors
 *
 * Resolves all failed queue items with format errors to valid provider_ids
 * and resets them to pending status for retry.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';

async function resolveVanityToProviderId(vanity, unipileAccountId) {
  const url = `https://${UNIPILE_DSN}/api/v1/users/${encodeURIComponent(vanity)}?account_id=${unipileAccountId}`;

  const response = await fetch(url, {
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve ${vanity}: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.provider_id) {
    throw new Error(`No provider_id returned for ${vanity}`);
  }

  return data.provider_id;
}

async function main() {
  console.log('🔧 Fixing Failed Format Errors\n');

  // Find all failed items with format errors
  const { data: failedItems, error } = await supabase
    .from('send_queue')
    .select('*')
    .eq('status', 'failed')
    .ilike('error_message', '%expected format%');

  if (error) {
    console.error('❌ Query error:', error);
    return;
  }

  console.log(`📋 Found ${failedItems?.length || 0} items with format errors\n`);

  if (!failedItems || failedItems.length === 0) {
    console.log('✅ No format errors to fix');
    return;
  }

  let fixed = 0;
  let failed = 0;

  for (const item of failedItems) {
    console.log(`\n🔍 Processing: ${item.id}`);
    console.log(`   Current linkedin_user_id: ${item.linkedin_user_id}`);

    // Get campaign to find LinkedIn account
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, name, linkedin_account_id')
      .eq('id', item.campaign_id)
      .single();

    if (!campaign) {
      console.log('   ❌ Campaign not found');
      failed++;
      continue;
    }

    // Get LinkedIn account
    const { data: account } = await supabase
      .from('user_unipile_accounts')
      .select('unipile_account_id, account_name')
      .eq('id', campaign.linkedin_account_id)
      .single();

    if (!account) {
      console.log('   ❌ LinkedIn account not found');
      failed++;
      continue;
    }

    console.log(`   Campaign: ${campaign.name}`);
    console.log(`   Account: ${account.account_name}`);

    // Resolve vanity to provider_id
    try {
      const providerId = await resolveVanityToProviderId(item.linkedin_user_id, account.unipile_account_id);
      console.log(`   ✅ Resolved to: ${providerId}`);

      // Update send_queue
      await supabase
        .from('send_queue')
        .update({
          linkedin_user_id: providerId,
          status: 'pending',
          error_message: null,
          scheduled_for: new Date().toISOString(), // Reschedule for now
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

      // Update prospect if exists
      if (item.prospect_id) {
        await supabase
          .from('campaign_prospects')
          .update({
            linkedin_user_id: providerId,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.prospect_id);
      }

      console.log(`   ✅ Fixed and rescheduled`);
      fixed++;

    } catch (err) {
      console.log(`   ❌ Resolution failed: ${err.message}`);
      failed++;
    }

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Fixed: ${fixed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total processed: ${failedItems.length}`);
}

main().catch(console.error);
