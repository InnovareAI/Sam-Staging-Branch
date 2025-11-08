require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLinkedInAccounts() {
  console.log('🔍 Checking LinkedIn accounts in workspace_accounts table...\n');

  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; // InnovareAI workspace

  // Get all workspace accounts
  const { data: accounts, error } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('account_type', 'linkedin');

  if (error) {
    console.error('❌ Error fetching accounts:', error);
    return;
  }

  console.log(`📊 Found ${accounts?.length || 0} LinkedIn accounts\n`);

  if (accounts && accounts.length > 0) {
    accounts.forEach((acc, index) => {
      console.log(`Account ${index + 1}:`);
      console.log(`  ID: ${acc.id}`);
      console.log(`  Account Name: ${acc.account_name}`);
      console.log(`  Unipile Account ID: ${acc.unipile_account_id || '❌ MISSING'}`);
      console.log(`  Is Active: ${acc.is_active}`);
      console.log(`  Connection Status: ${acc.connection_status}`);
      console.log('');
    });
  } else {
    console.log('❌ No LinkedIn accounts found');
  }

  // Check campaigns table
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, linkedin_account_id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .limit(5);

  console.log('\n📋 Active Campaigns:');
  if (campaigns && campaigns.length > 0) {
    campaigns.forEach(c => {
      console.log(`  - ${c.name}`);
      console.log(`    LinkedIn Account ID: ${c.linkedin_account_id || '⚠️  Not assigned'}`);
    });
  }
}

checkLinkedInAccounts().catch(console.error);
