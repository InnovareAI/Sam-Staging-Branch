#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 SIMULATING EXECUTE-LIVE FILTERING\n');

// Get latest campaign
const { data: campaign } = await supabase
  .from('campaigns')
  .select('id, name, created_by, workspace_id')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

console.log(`📋 Campaign: ${campaign.name}`);
console.log(`   ID: ${campaign.id.substring(0, 8)}...`);
console.log(`   Created by: ${campaign.created_by}\n`);

// Get LinkedIn account
const { data: linkedInAccount } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', campaign.workspace_id)
  .eq('user_id', campaign.created_by)
  .eq('account_type', 'linkedin')
  .eq('connection_status', 'connected')
  .single();

console.log(`🔗 LinkedIn Account: ${linkedInAccount?.account_name || 'NOT FOUND'}`);
console.log(`   Unipile ID: ${linkedInAccount?.unipile_account_id}\n`);

// Step 1: Get prospects with execute-live query
console.log('📊 Step 1: Query campaign_prospects\n');
const { data: campaignProspects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', campaign.id)
  .in('status', ['pending', 'approved', 'ready_to_message', 'follow_up_due'])
  .limit(10);

console.log(`Found ${campaignProspects?.length || 0} prospects with correct status:\n`);

campaignProspects?.forEach((p, i) => {
  console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
  console.log(`   Status: ${p.status}`);
  console.log(`   LinkedIn URL: ${p.linkedin_url || 'MISSING'}`);
  console.log(`   LinkedIn User ID: ${p.linkedin_user_id || 'MISSING'}`);
  console.log(`   Added by Unipile: ${p.added_by_unipile_account || 'NULL'}`);
});

if (!campaignProspects || campaignProspects.length === 0) {
  console.log('\n❌ NO PROSPECTS FOUND - Check status values in database');

  // Debug: Get ALL prospects regardless of status
  const { data: allProspects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status')
    .eq('campaign_id', campaign.id);

  console.log(`\nAll prospects in campaign (any status): ${allProspects?.length || 0}`);
  allProspects?.forEach((p) => {
    console.log(`   - ${p.first_name} ${p.last_name}: status=${p.status}`);
  });

  process.exit(0);
}

// Step 2: Apply filters from execute-live
console.log(`\n📊 Step 2: Apply execute-live filters\n`);

const executableProspects = campaignProspects.filter(cp => {
  const hasLinkedIn = cp.linkedin_url || cp.linkedin_user_id;
  const ownedByThisUnipileAccount = cp.added_by_unipile_account === linkedInAccount.unipile_account_id;
  const isLegacyProspect = cp.added_by_unipile_account === null && campaign.created_by === linkedInAccount.user_id;
  const canMessage = ownedByThisUnipileAccount || isLegacyProspect;
  const ownedByOtherUnipileAccount =
    cp.added_by_unipile_account !== null &&
    cp.added_by_unipile_account !== linkedInAccount.unipile_account_id;

  console.log(`Checking ${cp.first_name} ${cp.last_name}:`);
  console.log(`   hasLinkedIn: ${hasLinkedIn ? '✅' : '❌'}`);
  console.log(`   ownedByThisUnipileAccount: ${ownedByThisUnipileAccount ? '✅' : '❌'}`);
  console.log(`   isLegacyProspect (null owner): ${isLegacyProspect ? '✅' : '❌'}`);
  console.log(`   canMessage: ${canMessage ? '✅' : '❌'}`);
  console.log(`   ownedByOtherUnipileAccount: ${ownedByOtherUnipileAccount ? '❌ BLOCKED' : '✅'}`);
  console.log(`   PASSES: ${hasLinkedIn && canMessage ? '✅ YES' : '❌ NO'}\n`);

  return hasLinkedIn && canMessage;
});

console.log(`\n🎯 RESULT: ${executableProspects.length} prospects would execute\n`);

if (executableProspects.length === 0) {
  console.log('❌ WHY ZERO EXECUTABLE PROSPECTS?\n');

  const noLinkedIn = campaignProspects.filter(p => !p.linkedin_url && !p.linkedin_user_id);
  const wrongOwner = campaignProspects.filter(p =>
    (p.linkedin_url || p.linkedin_user_id) &&
    p.added_by_unipile_account !== null &&
    p.added_by_unipile_account !== linkedInAccount.unipile_account_id
  );

  if (noLinkedIn.length > 0) {
    console.log(`⚠️  ${noLinkedIn.length} prospects missing LinkedIn URL/ID`);
  }
  if (wrongOwner.length > 0) {
    console.log(`⚠️  ${wrongOwner.length} prospects owned by different Unipile account`);
    wrongOwner.forEach(p => {
      console.log(`     - ${p.first_name} ${p.last_name}`);
      console.log(`       Owner: ${p.added_by_unipile_account}`);
      console.log(`       Expected: ${linkedInAccount.unipile_account_id}`);
    });
  }
} else {
  console.log('✅ These prospects would execute:');
  executableProspects.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.first_name} ${p.last_name}`);
  });
}
