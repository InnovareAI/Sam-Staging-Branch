/**
 * Fix Charissa's Campaign
 *
 * Find her LinkedIn account and assign it to the campaign.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CAMPAIGN_ID = '5bb3ac9c-eac3-475b-b2a5-5f939edace34';
const WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861'; // IA4

console.log('🔍 Finding LinkedIn account for IA4 workspace...');

// Find LinkedIn account (removed provider filter - doesn't exist in schema)
const { data: accounts, error: accountsError } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', WORKSPACE_ID);

if (accountsError) {
  console.error('❌ Error fetching accounts:', accountsError);
  process.exit(1);
}

console.log(`✅ Found ${accounts.length} LinkedIn account(s)`);
accounts.forEach((acc, i) => {
  console.log(`   ${i + 1}. ${acc.account_name} (${acc.email}) - ${acc.is_active ? 'Active' : 'Inactive'}`);
  console.log(`      ID: ${acc.id}`);
  console.log(`      Unipile: ${acc.unipile_account_id}`);
});

if (accounts.length === 0) {
  console.log('\n❌ No LinkedIn account found for IA4 workspace');
  process.exit(1);
}

// Use the first active account
const activeAccount = accounts.find(a => a.is_active) || accounts[0];

console.log(`\n🔧 Assigning account "${activeAccount.account_name}" to campaign...`);

// Update campaign
const { error: updateError } = await supabase
  .from('campaigns')
  .update({
    linkedin_account_id: activeAccount.id,
    campaign_name: 'IA4 - Test Campaign'
  })
  .eq('id', CAMPAIGN_ID);

if (updateError) {
  console.error('❌ Error updating campaign:', updateError);
  process.exit(1);
}

console.log('✅ Campaign updated successfully');
console.log('\n📋 Campaign details:');
console.log(`   ID: ${CAMPAIGN_ID}`);
console.log(`   Name: IA4 - Test Campaign`);
console.log(`   LinkedIn Account: ${activeAccount.account_name}`);
console.log(`   Unipile Account ID: ${activeAccount.unipile_account_id}`);
console.log('\n✅ Now you can run: node scripts/js/trigger-charissa-complete.mjs');
