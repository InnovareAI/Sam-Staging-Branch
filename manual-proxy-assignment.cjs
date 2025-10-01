const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function manualAssign() {
  console.log('🔧 Manual Proxy Assignment for Existing Accounts\n');
  
  // Get your user
  const { data: authUser } = await supabase.auth.admin.listUsers();
  const user = authUser?.users?.find(u => u.email === 'tl@innovareai.com');
  
  if (!user) {
    console.log('❌ User not found');
    return;
  }
  
  console.log(`✅ Found user: ${user.email} (${user.id})\n`);
  
  // Get LinkedIn accounts from user_unipile_accounts
  const { data: accounts } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('platform', 'LINKEDIN');
  
  if (!accounts || accounts.length === 0) {
    console.log('❌ No LinkedIn accounts found');
    return;
  }
  
  console.log(`📊 Found ${accounts.length} LinkedIn accounts\n`);
  
  // Manual assignment for your accounts
  for (const account of accounts) {
    console.log(`🔄 ${account.account_name} (${account.unipile_account_id})`);
    
    // Germany proxy for Thorsten Linz
    const proxyCountry = 'de';
    const sessionId = `linkedin_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
    const proxyUsername = `brd-customer-${process.env.BRIGHT_DATA_CUSTOMER_ID}-zone-residential-country-${proxyCountry}-session-${sessionId}`;
    
    // Use service role client to bypass RLS
    const { error } = await supabase
      .from('linkedin_proxy_assignments')
      .upsert({
        user_id: user.id,
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
      console.log(`   Details:`, error);
    } else {
      console.log(`   ✅ Proxy assigned: DE (Germany)`);
      console.log(`   Session: ${sessionId.substring(0, 20)}...`);
    }
  }
  
  console.log('\n✅ Done! Now check Settings → Proxy Country Selection\n');
}

manualAssign();
