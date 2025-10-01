const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupOldLinkedInAccounts() {
  console.log('🧹 Cleaning up old LinkedIn accounts from database...\n');
  
  // Get your user ID
  const { data: users } = await supabase.auth.admin.listUsers();
  const tlUser = users.users.find(u => u.email === 'tl@innovareai.com');
  
  if (!tlUser) {
    console.log('❌ User not found');
    return;
  }
  
  console.log(`✅ Found user: ${tlUser.email} (${tlUser.id})\n`);
  
  // Delete old accounts that don't exist in Unipile anymore
  const oldAccountIds = [
    'NLsTJRfCSg-WZAXCBo8w7A_MESSAGING',
    'NLsTJRfCSg-WZAXCBo8w7A'
  ];
  
  for (const accountId of oldAccountIds) {
    console.log(`🗑️  Deleting ${accountId}...`);
    
    const { error } = await supabase
      .from('user_unipile_accounts')
      .delete()
      .eq('user_id', tlUser.id)
      .eq('unipile_account_id', accountId);
    
    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
    } else {
      console.log(`   ✅ Deleted successfully`);
    }
  }
  
  console.log('\n✅ Cleanup complete! Checking remaining accounts...\n');
  
  // Verify cleanup
  const { data: remaining } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('user_id', tlUser.id)
    .eq('platform', 'LINKEDIN');
  
  if (!remaining || remaining.length === 0) {
    console.log('✅ No LinkedIn accounts in database - clean slate!');
  } else {
    console.log(`⚠️  Still have ${remaining.length} accounts:`);
    remaining.forEach(acc => {
      console.log(`   - ${acc.unipile_account_id} (${acc.account_name})`);
    });
  }
}

cleanupOldLinkedInAccounts().catch(console.error);
