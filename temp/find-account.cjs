const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findAccount() {
  console.log('🔍 Checking which account is being used...\n');

  // Get the workspace for your recent campaigns
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; // InnovareAI workspace

  // Get all LinkedIn accounts in this workspace
  const { data: accounts, error } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('account_type', 'linkedin')
    .eq('is_active', true);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`Found ${accounts.length} active LinkedIn accounts:\n`);

  accounts.forEach((acc, index) => {
    console.log(`${index + 1}. ${acc.account_name}`);
    console.log(`   Unipile ID: ${acc.unipile_account_id}`);
    console.log(`   Email: ${acc.account_email || 'N/A'}`);
    console.log(`   Created: ${acc.created_at}`);
    if (acc.unipile_account_id === 'mERQmojtSZq5GeomZZazlw') {
      console.log('   ⭐ THIS IS THE ACCOUNT BEING USED ⭐');
    }
    console.log('');
  });

  // Check which account is first in the array (used by default)
  const firstAccount = accounts[0];
  console.log(`\n📍 First account (default): ${firstAccount.account_name} (${firstAccount.unipile_account_id})`);

  if (firstAccount.unipile_account_id !== 'mERQmojtSZq5GeomZZazlw') {
    console.log('\n⚠️  WARNING: The first account is NOT Thorsten Linz!');
    console.log('Connection requests might be going to:', firstAccount.account_name);
  } else {
    console.log('\n✅ Thorsten Linz is the first account - should be correct');
  }
}

findAccount().catch(console.error);
