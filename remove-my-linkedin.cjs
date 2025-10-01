const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function removeLinkedInAccount() {
  console.log('🗑️  Removing LinkedIn accounts from database...\n');
  
  // Get your user ID
  const { data: users } = await supabase.auth.admin.listUsers();
  const tlUser = users.users.find(u => u.email === 'tl@innovareai.com');
  
  if (!tlUser) {
    console.log('❌ User not found');
    return;
  }
  
  console.log(`✅ Found user: ${tlUser.email} (${tlUser.id})\n`);
  
  // Delete from user_unipile_accounts table
  const { error: unipileError, count: unipileCount } = await supabase
    .from('user_unipile_accounts')
    .delete()
    .eq('user_id', tlUser.id)
    .eq('platform', 'LINKEDIN');
  
  if (unipileError) {
    console.log('❌ Error deleting from user_unipile_accounts:', unipileError.message);
  } else {
    console.log(`✅ Deleted from user_unipile_accounts`);
  }
  
  // Try to delete from integrations table (might not exist)
  try {
    const { error: intError } = await supabase
      .from('integrations')
      .delete()
      .eq('user_id', tlUser.id)
      .eq('provider', 'linkedin');
    
    if (intError) {
      console.log('⚠️  integrations table:', intError.message);
    } else {
      console.log('✅ Deleted from integrations table');
    }
  } catch (e) {
    console.log('⚠️  integrations table not available');
  }
  
  console.log('\n✅ Cleanup complete! Database is now clean.');
  console.log('🔄 You can now reconnect your LinkedIn account.');
}

removeLinkedInAccount().catch(console.error);
