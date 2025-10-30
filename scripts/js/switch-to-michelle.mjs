#!/usr/bin/env node
/**
 * Switch Outreach Campaign to use Michelle's LinkedIn account
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CAMPAIGN_NAME = '20251030-IAI-Outreach Campaign';
const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
const MICHELLE_USER_ID = '471bcb15-cc53-44f3-b5d2-4b97bb7a8b2f'; // Michelle's user ID
const MICHELLE_ACCOUNT_ID = '50aca023-5e85-4262-9fbe-f9d50c06daaf'; // Michelle's workspace_accounts ID

async function switchToMichelle() {
  console.log('🔄 SWITCHING CAMPAIGN TO MICHELLE\'S ACCOUNT\n');
  console.log('='.repeat(70));

  // Get campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('name', CAMPAIGN_NAME)
    .single();

  if (!campaign) {
    console.log('❌ Campaign not found');
    return;
  }

  console.log('\n📋 CURRENT CAMPAIGN SETUP:');
  console.log(`   Campaign: ${campaign.name}`);
  console.log(`   Current Owner: ${campaign.created_by}`);
  console.log(`   Status: ${campaign.status}`);

  // Update campaign to be owned by Michelle
  const { error: updateError } = await supabase
    .from('campaigns')
    .update({
      created_by: MICHELLE_USER_ID,
      updated_at: new Date().toISOString()
    })
    .eq('id', campaign.id);

  if (updateError) {
    console.log(`\n❌ Error updating campaign: ${updateError.message}`);
    return;
  }

  console.log('\n✅ CAMPAIGN UPDATED:');
  console.log(`   New Owner: Michelle (${MICHELLE_USER_ID})`);
  console.log(`   LinkedIn Account: Michelle Angelica Gestuveo`);

  // Get Michelle's account details
  const { data: michelleAccount } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('id', MICHELLE_ACCOUNT_ID)
    .single();

  if (michelleAccount) {
    console.log('\n📊 MICHELLE\'S LINKEDIN ACCOUNT:');
    console.log(`   Name: ${michelleAccount.account_name}`);
    console.log(`   Unipile ID: ${michelleAccount.unipile_account_id}`);
    console.log(`   Status: ${michelleAccount.connection_status}`);
    console.log(`   Daily Limit: ${michelleAccount.daily_message_limit || 'N/A'}`);
    console.log(`   Sent Today: ${michelleAccount.messages_sent_today || 0}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ CAMPAIGN READY TO EXECUTE');
  console.log('='.repeat(70));
  console.log('\n   The campaign will now use Michelle\'s LinkedIn account');
  console.log('   to send connection requests, bypassing Thorsten\'s rate limit.');
  console.log('\n   Execute the campaign from the UI to test.');
  console.log('='.repeat(70));
}

switchToMichelle().catch(console.error);
