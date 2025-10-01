const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkConnection() {
  console.log('🔍 Checking LinkedIn connection status...\n');
  
  // Get your user
  const { data: authUser } = await supabase.auth.admin.listUsers();
  const user = authUser?.users?.find(u => u.email === 'tl@innovareai.com');
  
  if (!user) {
    console.log('❌ User not found');
    return;
  }
  
  console.log(`✅ Found user: ${user.email} (${user.id})\n`);
  
  // Check user_unipile_accounts
  console.log('📊 Checking user_unipile_accounts...');
  const { data: unipileAccounts, error: unipileError } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('platform', 'LINKEDIN');
  
  if (unipileError) {
    console.log('❌ Error:', unipileError.message);
  } else {
    console.log(`   Found ${unipileAccounts?.length || 0} LinkedIn accounts\n`);
    
    if (unipileAccounts && unipileAccounts.length > 0) {
      unipileAccounts.forEach(acc => {
        console.log(`   Account: ${acc.account_name}`);
        console.log(`   Unipile ID: ${acc.unipile_account_id}`);
        console.log(`   Status: ${acc.connection_status}`);
        console.log('');
      });
    }
  }
  
  // Check linkedin_proxy_assignments
  console.log('📊 Checking linkedin_proxy_assignments...');
  const { data: proxyAssignments, error: proxyError } = await supabase
    .from('linkedin_proxy_assignments')
    .select('*')
    .eq('user_id', user.id);
  
  if (proxyError) {
    console.log('❌ Error:', proxyError.message);
  } else {
    console.log(`   Found ${proxyAssignments?.length || 0} proxy assignments\n`);
    
    if (proxyAssignments && proxyAssignments.length > 0) {
      proxyAssignments.forEach(assignment => {
        console.log(`   Account: ${assignment.linkedin_account_name}`);
        console.log(`   Country: ${assignment.detected_country}`);
        console.log(`   Proxy: ${assignment.proxy_country}${assignment.proxy_state ? '/' + assignment.proxy_state : ''}`);
        console.log(`   Status: ${assignment.connectivity_status}`);
        console.log('');
      });
    } else {
      console.log('   ⚠️ No proxy assignments found!');
      console.log('   The OAuth callback might not have triggered the proxy assignment.');
    }
  }
  
  // Get Unipile account details
  if (unipileAccounts && unipileAccounts.length > 0) {
    console.log('\n🔧 Triggering manual proxy assignment...\n');
    
    const accountId = unipileAccounts[0].unipile_account_id;
    
    // Fetch from Unipile API
    const unipileDsn = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;
    
    const response = await fetch(`https://${unipileDsn}/api/v1/accounts/${accountId}`, {
      headers: { 'X-API-KEY': unipileApiKey }
    });
    
    if (response.ok) {
      const accountDetails = await response.json();
      console.log('LinkedIn Account Details from Unipile:');
      console.log('   Name:', accountDetails.name);
      console.log('   Type:', accountDetails.type);
      console.log('   Connection Params:', JSON.stringify(accountDetails.connection_params?.im, null, 2));
    }
  }
}

checkConnection();
