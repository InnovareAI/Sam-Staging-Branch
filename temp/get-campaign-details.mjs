#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const problemCampaignIds = [
  '281feb3b-9d07-4844-9fe0-221665f0bb92',
  'ea13b4fe-4c0f-43d5-9efe-45a506c75445',
  'c243c82d-12fc-4b49-b5b2-c52a77708bf1'
];

console.log('🔍 DETAILED CAMPAIGN INVESTIGATION\n');

async function investigateCampaign(campaignId) {
  console.log('\n' + '='.repeat(80));

  // Get full campaign details
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign) {
    console.log(`❌ Campaign ${campaignId} not found`);
    return;
  }

  console.log(`\n📊 CAMPAIGN: ${campaign.campaign_name || 'Unnamed'}`);
  console.log(`   ID: ${campaign.id}`);
  console.log(`   Type: ${campaign.campaign_type || 'linkedin_only'}`);
  console.log(`   Status: ${campaign.status}`);
  console.log(`   LinkedIn Account ID: ${campaign.linkedin_account_id}`);
  console.log(`   Created: ${campaign.created_at}`);

  // Get account details
  if (campaign.linkedin_account_id) {
    const { data: account } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('id', campaign.linkedin_account_id)
      .single();

    if (account) {
      console.log(`\n📧 ACCOUNT:`);
      console.log(`   Name: ${account.display_name || 'N/A'}`);
      console.log(`   Email: ${account.email || 'N/A'}`);
      console.log(`   Provider: ${account.provider || 'N/A'}`);
      console.log(`   Unipile Account ID: ${account.unipile_account_id || 'N/A'}`);
    } else {
      console.log(`\n⚠️  Account not found in user_unipile_accounts`);
    }
  }

  // Get error details
  const { data: errors } = await supabase
    .from('send_queue')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'failed')
    .limit(10);

  console.log(`\n❌ ERRORS (showing first 10):`);
  if (errors && errors.length > 0) {
    errors.forEach((error, idx) => {
      console.log(`\n   Error ${idx + 1}:`);
      console.log(`   Queue ID: ${error.id}`);
      console.log(`   Prospect ID: ${error.prospect_id}`);
      console.log(`   Recipient Profile: ${error.recipient_profile_id}`);
      console.log(`   Error: ${error.error_message}`);
      console.log(`   Created: ${error.created_at}`);
    });
  } else {
    console.log('   No errors found');
  }
}

async function checkUnipileEndpoint() {
  console.log('\n\n🔧 UNIPILE CONFIGURATION CHECK\n');
  console.log('='.repeat(80));

  // Check current Unipile DSN from environment or common patterns
  console.log('\n⚠️  Current Unipile DSN should be: api6.unipile.com:13670');
  console.log('   Verify in Netlify environment variables: UNIPILE_DSN');
  console.log('   Verify API endpoint in code: /api/v1/messages/send');

  console.log('\n📝 If you see "Cannot POST /api/v1/messages/send" errors:');
  console.log('   1. Check if Unipile API has changed endpoints');
  console.log('   2. Verify Unipile account is active');
  console.log('   3. Check if DSN/port configuration is correct');
}

async function checkInvalidAccountErrors() {
  console.log('\n\n🔍 INVALID ACCOUNT TYPE ERRORS\n');
  console.log('='.repeat(80));

  // Get campaigns with invalid account type errors
  const { data: errors } = await supabase
    .from('send_queue')
    .select(`
      id,
      campaign_id,
      error_message,
      campaigns (
        id,
        campaign_name,
        campaign_type,
        linkedin_account_id
      )
    `)
    .ilike('error_message', '%Invalid account type%')
    .limit(10);

  if (errors && errors.length > 0) {
    console.log(`\nFound ${errors.length} invalid account type errors:\n`);

    for (const error of errors) {
      console.log(`Campaign: ${error.campaigns?.campaign_name || 'Unknown'}`);
      console.log(`  Type: ${error.campaigns?.campaign_type || 'null'}`);
      console.log(`  LinkedIn Account ID: ${error.campaigns?.linkedin_account_id}`);
      console.log(`  Error: ${error.error_message}`);
      console.log('');

      // Get the account details
      if (error.campaigns?.linkedin_account_id) {
        const { data: account } = await supabase
          .from('user_unipile_accounts')
          .select('provider, email, display_name')
          .eq('id', error.campaigns.linkedin_account_id)
          .single();

        if (account) {
          console.log(`  Account Provider: ${account.provider || 'N/A'}`);
          console.log(`  Account: ${account.display_name || account.email || 'N/A'}`);

          if (account.provider !== 'LINKEDIN') {
            console.log(`  🔴 PROBLEM: Using ${account.provider} account for LinkedIn campaign!`);
            console.log(`  🔧 FIX: Campaign needs a LINKEDIN account, not ${account.provider}`);
          }
        }
        console.log('');
      }
    }
  } else {
    console.log('No invalid account type errors found');
  }
}

async function main() {
  try {
    for (const campaignId of problemCampaignIds) {
      await investigateCampaign(campaignId);
    }

    await checkUnipileEndpoint();
    await checkInvalidAccountErrors();

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Investigation complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
