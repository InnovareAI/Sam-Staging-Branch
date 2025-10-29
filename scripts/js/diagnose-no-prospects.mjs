#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get user
const { data: user } = await supabase
  .from('users')
  .select('id')
  .eq('email', 'tl@innovareai.com')
  .single();

// Get most recent active campaign
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, created_by, workspace_id')
  .eq('created_by', user.id)
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(1);

if (!campaigns || campaigns.length === 0) {
  console.log('❌ No active campaigns found');
  process.exit(0);
}

const campaign = campaigns[0];
console.log(`\n📋 Diagnosing: ${campaign.name}\n`);

// Get ALL prospects in campaign
const { data: allProspects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, linkedin_url, linkedin_user_id, added_by_unipile_account')
  .eq('campaign_id', campaign.id);

console.log(`Total prospects: ${allProspects?.length || 0}\n`);

if (!allProspects || allProspects.length === 0) {
  console.log('❌ No prospects in campaign');
  console.log('   Solution: Add prospects via "Add Approved Prospects"\n');
  process.exit(0);
}

// Get user's Unipile account
const { data: account } = await supabase
  .from('workspace_accounts')
  .select('unipile_account_id, name')
  .eq('workspace_id', campaign.workspace_id)
  .eq('user_id', campaign.created_by)
  .eq('account_type', 'linkedin')
  .eq('connection_status', 'connected')
  .single();

console.log(`Your LinkedIn account: ${account?.name || 'NOT CONNECTED'}`);
console.log(`Unipile ID: ${account?.unipile_account_id || 'N/A'}\n`);

// Check each filter criteria
const checks = {
  hasLinkedIn: 0,
  hasCorrectStatus: 0,
  ownedByYou: 0,
  executable: 0
};

const issues = [];

allProspects.forEach(p => {
  const hasLinkedIn = !!(p.linkedin_url || p.linkedin_user_id);
  const correctStatus = ['pending', 'approved', 'ready_to_message'].includes(p.status);
  const ownedByYou = p.added_by_unipile_account === account?.unipile_account_id ||
                      p.added_by_unipile_account === null;

  if (hasLinkedIn) checks.hasLinkedIn++;
  if (correctStatus) checks.hasCorrectStatus++;
  if (ownedByYou) checks.ownedByYou++;
  if (hasLinkedIn && correctStatus && ownedByYou) checks.executable++;

  if (!hasLinkedIn || !correctStatus || !ownedByYou) {
    issues.push({
      name: `${p.first_name} ${p.last_name}`,
      status: p.status,
      hasLinkedIn,
      correctStatus,
      ownedByYou,
      ownerAccount: p.added_by_unipile_account
    });
  }
});

console.log('✅ Prospects passing each filter:\n');
console.log(`   Has LinkedIn URL: ${checks.hasLinkedIn}/${allProspects.length}`);
console.log(`   Correct status: ${checks.hasCorrectStatus}/${allProspects.length}`);
console.log(`   Owned by you: ${checks.ownedByYou}/${allProspects.length}`);
console.log(`   EXECUTABLE: ${checks.executable}/${allProspects.length}\n`);

if (checks.executable === 0) {
  console.log('❌ Why no prospects are executable:\n');

  const statuses = {};
  allProspects.forEach(p => {
    statuses[p.status] = (statuses[p.status] || 0) + 1;
  });

  console.log('Prospect statuses:');
  Object.entries(statuses).forEach(([status, count]) => {
    const isGood = ['pending', 'approved', 'ready_to_message'].includes(status);
    console.log(`   ${isGood ? '✅' : '❌'} ${status}: ${count}`);
  });

  const noLinkedIn = allProspects.filter(p => !p.linkedin_url && !p.linkedin_user_id).length;
  if (noLinkedIn > 0) {
    console.log(`\n   ⚠️  ${noLinkedIn} prospects missing LinkedIn URLs`);
  }

  const notOwned = allProspects.filter(p =>
    p.added_by_unipile_account !== null &&
    p.added_by_unipile_account !== account?.unipile_account_id
  ).length;
  if (notOwned > 0) {
    console.log(`   ⚠️  ${notOwned} prospects owned by different Unipile account`);
  }

  console.log('\n💡 Solutions:');
  if (noLinkedIn > 0) {
    console.log('   1. Re-import prospects with LinkedIn URLs');
  }
  if (checks.hasCorrectStatus < allProspects.length) {
    console.log('   2. Update prospect status to "approved" or "pending"');
  }
  if (notOwned > 0) {
    console.log('   3. Fix ownership: Run fix-prospect-ownership.mjs');
  }
} else {
  console.log(`✅ ${checks.executable} prospects ready to execute!\n`);
}
