const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findUserId() {
  console.log('🔍 Finding your user IDs...\n');
  
  // Get auth user
  const { data: authUser } = await supabase.auth.admin.listUsers();
  const authUserData = authUser?.users?.find(u => u.email === 'tl@innovareai.com');
  
  console.log('Auth User ID:', authUserData?.id);
  
  // Get users table user
  const { data: usersTableData } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'tl@innovareai.com')
    .single();
  
  console.log('Users Table ID:', usersTableData?.id);
  console.log('\nFull user record:', usersTableData);
  
  if (authUserData?.id !== usersTableData?.id) {
    console.log('\n⚠️ MISMATCH! Auth ID and Users table ID are different!');
    console.log('\nWe should use the Users table ID for proxy assignments.');
    
    // Now assign proxy with correct ID
    const { data: accounts } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', authUserData.id)
      .eq('platform', 'LINKEDIN');
    
    if (accounts && accounts.length > 0) {
      console.log(`\n📊 Found ${accounts.length} LinkedIn accounts\n`);
      
      for (const account of accounts) {
        console.log(`🔄 ${account.account_name}`);
        
        const proxyCountry = 'de';
        const sessionId = `linkedin_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
        const proxyUsername = `brd-customer-${process.env.BRIGHT_DATA_CUSTOMER_ID}-zone-residential-country-${proxyCountry}-session-${sessionId}`;
        
        // Use the USERS TABLE ID, not auth ID
        const { error } = await supabase
          .from('linkedin_proxy_assignments')
          .upsert({
            user_id: usersTableData.id,  // Use users table ID!
            linkedin_account_id: account.unipile_account_id,
            linkedin_account_name: account.account_name,
            detected_country: 'Germany',
            proxy_country: proxyCountry,
            proxy_state: null,
            proxy_city: null,
            proxy_session_id: sessionId,
            proxy_username: proxyUsername,
            confidence_score: 1.0,
            connectivity_status: 'untested',
            is_primary_account: false,
            account_features: [],
            last_updated: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (error) {
          console.log(`   ❌ Error: ${error.message}`);
        } else {
          console.log(`   ✅ Proxy assigned: DE (Germany)`);
        }
      }
    }
  }
}

findUserId();
