const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const unipileDsn = process.env.UNIPILE_DSN;
const unipileApiKey = process.env.UNIPILE_API_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function assignProxiesToExistingAccounts() {
  console.log('🔧 Assigning proxies to existing LinkedIn accounts...\n');
  
  // Get your user
  const { data: authUser } = await supabase.auth.admin.listUsers();
  const user = authUser?.users?.find(u => u.email === 'tl@innovareai.com');
  
  if (!user) {
    console.log('❌ User not found');
    return;
  }
  
  console.log(`✅ Found user: ${user.email}\n`);
  
  // Get LinkedIn accounts
  const { data: unipileAccounts } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('platform', 'LINKEDIN');
  
  if (!unipileAccounts || unipileAccounts.length === 0) {
    console.log('❌ No LinkedIn accounts found');
    return;
  }
  
  console.log(`📊 Found ${unipileAccounts.length} LinkedIn accounts\n`);
  
  for (const account of unipileAccounts) {
    console.log(`\n🔄 Processing: ${account.account_name}`);
    console.log(`   Unipile ID: ${account.unipile_account_id}`);
    
    // Fetch full account details from Unipile
    const response = await fetch(`https://${unipileDsn}/api/v1/accounts/${account.unipile_account_id}`, {
      headers: { 'X-API-KEY': unipileApiKey }
    });
    
    if (!response.ok) {
      console.log(`   ❌ Failed to fetch account details`);
      continue;
    }
    
    const accountDetails = await response.json();
    
    // Extract location
    let linkedInLocation = null;
    let linkedInCountry = null;
    
    if (accountDetails.connection_params?.im?.location) {
      linkedInLocation = accountDetails.connection_params.im.location;
    } else if (accountDetails.connection_params?.im?.geoCountryName) {
      linkedInCountry = accountDetails.connection_params.im.geoCountryName;
    } else if (accountDetails.connection_params?.profile?.location) {
      linkedInLocation = accountDetails.connection_params.profile.location;
    } else if (accountDetails.metadata?.location) {
      linkedInLocation = accountDetails.metadata.location;
    } else if (accountDetails.metadata?.country) {
      linkedInCountry = accountDetails.metadata.country;
    }
    
    const detectedLocation = linkedInLocation || linkedInCountry || 'Germany'; // Your default
    console.log(`   📍 Detected location: ${detectedLocation}`);
    
    // Generate proxy config
    const proxyCountry = detectedLocation.toLowerCase().includes('german') || detectedLocation.toLowerCase().includes('de') ? 'de' : 'us';
    const proxyState = proxyCountry === 'us' ? 'ca' : null;
    const sessionId = `linkedin_${Date.now().toString(36)}_${Math.random().toString(36).substring(2)}`;
    
    let proxyUsername = `brd-customer-${process.env.BRIGHT_DATA_CUSTOMER_ID}-zone-residential-country-${proxyCountry}`;
    if (proxyState) {
      proxyUsername += `-state-${proxyState}`;
    }
    proxyUsername += `-session-${sessionId}`;
    
    console.log(`   📡 Proxy: ${proxyCountry.toUpperCase()}${proxyState ? '/' + proxyState.toUpperCase() : ''}`);
    
    // Store in database
    const { error: insertError } = await supabase
      .from('linkedin_proxy_assignments')
      .upsert({
        user_id: user.id,
        linkedin_account_id: account.unipile_account_id,
        linkedin_account_name: account.account_name,
        detected_country: detectedLocation,
        proxy_country: proxyCountry,
        proxy_state: proxyState,
        proxy_city: null,
        proxy_session_id: sessionId,
        proxy_username: proxyUsername,
        confidence_score: 0.9,
        connectivity_status: 'untested',
        connectivity_details: null,
        is_primary_account: false,
        account_features: [],
        last_updated: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,linkedin_account_id'
      });
    
    if (insertError) {
      console.log(`   ❌ Failed to store proxy:`, insertError.message);
    } else {
      console.log(`   ✅ Proxy assigned successfully!`);
    }
  }
  
  console.log('\n\n✅ All done! Check Settings → Proxy Country Selection to see your assignments.');
}

assignProxiesToExistingAccounts();
