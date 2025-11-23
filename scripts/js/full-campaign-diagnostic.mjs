#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnostic() {
  const campaignId = '1d3428f8-454d-4ffb-8337-4273f781adfb';
  
  console.log('\n🔍 FULL CAMPAIGN DIAGNOSTIC\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Campaign details
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  console.log('1. CAMPAIGN RECORD:');
  console.log(`   ├─ Name: ${campaign.name}`);
  console.log(`   ├─ Status: ${campaign.status}`);
  console.log(`   ├─ Type: ${campaign.campaign_type}`);
  console.log(`   ├─ Workspace ID: ${campaign.workspace_id}`);
  console.log(`   ├─ LinkedIn Account ID: ${campaign.linkedin_account_id || '❌ MISSING'}`);
  console.log(`   ├─ Created: ${new Date(campaign.created_at).toLocaleString()}`);
  console.log(`   └─ Updated: ${new Date(campaign.updated_at).toLocaleString()}\n`);

  // 2. Prospects count
  const { count: prospectCount } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);

  console.log('2. PROSPECTS:');
  console.log(`   └─ Count: ${prospectCount || 0} ${prospectCount === 0 ? '❌ NO PROSPECTS!' : '✅'}\n`);

  // 3. Send queue
  const { count: queueCount } = await supabase
    .from('send_queue')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);

  console.log('3. SEND QUEUE:');
  console.log(`   └─ Count: ${queueCount || 0} ${queueCount === 0 ? '❌ NO MESSAGES QUEUED!' : '✅'}\n`);

  // 4. Messages
  console.log('4. MESSAGE TEMPLATES:');
  if (campaign.message_templates) {
    console.log(`   ├─ Connection Request: ${campaign.message_templates.connection_request ? '✅' : '❌'}`);
    console.log(`   └─ Follow-ups: ${campaign.message_templates.follow_up_messages?.length || 0} messages\n`);
  } else {
    console.log(`   └─ ❌ NO MESSAGE TEMPLATES!\n`);
  }

  // 5. Check if LinkedIn account exists
  if (campaign.linkedin_account_id) {
    const { data: account } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('id', campaign.linkedin_account_id)
      .single();

    console.log('5. LINKEDIN ACCOUNT:');
    if (account) {
      console.log(`   ├─ Name: ${account.account_name}`);
      console.log(`   ├─ Unipile ID: ${account.unipile_account_id}`);
      console.log(`   ├─ Status: ${account.connection_status}`);
      console.log(`   └─ Active: ${account.is_active ? '✅' : '❌'}\n`);
    } else {
      console.log(`   └─ ❌ ACCOUNT NOT FOUND!\n`);
    }
  } else {
    console.log('5. LINKEDIN ACCOUNT:');
    console.log(`   └─ ❌ NO LINKEDIN ACCOUNT ASSIGNED!\n`);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔴 PROBLEM IDENTIFIED:');
  if (prospectCount === 0) {
    console.log('   Campaign created but prospects were NOT uploaded!');
    console.log('   This could be due to:');
    console.log('   1. RLS policy blocking prospect insertion');
    console.log('   2. API error during prospect upload');
    console.log('   3. Missing required fields (linkedin_url, linkedin_user_id)');
    console.log('   4. Workspace ID mismatch\n');
    console.log('💡 SOLUTION:');
    console.log('   Check browser console logs or Netlify function logs');
    console.log('   for errors during campaign creation\n');
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
}

diagnostic();
