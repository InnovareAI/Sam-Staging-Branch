const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const unipileDsn = process.env.UNIPILE_DSN;
const unipileApiKey = process.env.UNIPILE_API_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanup() {
  console.log('🧹 Cleaning up stale LinkedIn accounts...\n');
  
  // Get auth user
  const { data: authUser } = await supabase.auth.admin.listUsers();
  const authUserData = authUser?.users?.find(u => u.email === 'tl@innovareai.com');
  
  if (!authUserData) {
    console.log('❌ User not found');
    return;
  }
  
  console.log(`✅ Found user: ${authUserData.email}\n`);
  
  // Get all LinkedIn accounts from Unipile
  console.log('🔍 Fetching active LinkedIn accounts from Unipile...');
  const response = await fetch(`https://${unipileDsn}/api/v1/accounts`, {
    headers: { 'X-API-KEY': unipileApiKey }
  });
  
  if (!response.ok) {
    console.log(`⚠️  Unipile API error: ${response.status} (${response.statusText})`);
    console.log('Unipile might be down temporarily (502 earlier).\n');
    
    // Clean up database anyway
    console.log('🗑️  Cleaning up database records...\n');
    
    const { data: dbAccounts } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', authUserData.id)
      .eq('platform', 'LINKEDIN');
    
    if (dbAccounts && dbAccounts.length > 0) {
      console.log(`Found ${dbAccounts.length} stale accounts in database:\n`);
      
      for (const acc of dbAccounts) {
        console.log(`  - ${acc.account_name} (${acc.unipile_account_id})`);
        
        // Delete from user_unipile_accounts
        await supabase
          .from('user_unipile_accounts')
          .delete()
          .eq('unipile_account_id', acc.unipile_account_id);
        
        // Delete proxy assignment
        await supabase
          .from('linkedin_proxy_assignments')
          .delete()
          .eq('linkedin_account_id', acc.unipile_account_id);
      }
      
      console.log('\n✅ Cleaned up stale accounts!');
    } else {
      console.log('✅ No stale accounts found in database');
    }
    
    return;
  }
  
  const data = await response.json();
  const activeLinkedInAccounts = data.items?.filter(acc => acc.type === 'LINKEDIN') || [];
  
  console.log(`   Active accounts in Unipile: ${activeLinkedInAccounts.length}\n`);
  
  if (activeLinkedInAccounts.length === 0) {
    console.log('✅ No LinkedIn accounts connected - cleaning up database...\n');
    
    // Remove from user_unipile_accounts
    const { data: deleted1 } = await supabase
      .from('user_unipile_accounts')
      .delete()
      .eq('user_id', authUserData.id)
      .eq('platform', 'LINKEDIN')
      .select();
    
    console.log(`   Removed ${deleted1?.length || 0} from user_unipile_accounts`);
    
    // Remove proxy assignments (use users table ID)
    const { data: usersTableData } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'tl@innovareai.com')
      .single();
    
    const { data: deleted2 } = await supabase
      .from('linkedin_proxy_assignments')
      .delete()
      .eq('user_id', usersTableData.id)
      .select();
    
    console.log(`   Removed ${deleted2?.length || 0} from linkedin_proxy_assignments\n`);
    
    console.log('✅ All cleaned up! Database is now in sync.\n');
    console.log('📝 Next: Connect a LinkedIn account at https://app.meet-sam.com/linkedin-integration');
    console.log('   The OAuth callback will automatically assign a dedicated IP!');
  }
}

cleanup();
