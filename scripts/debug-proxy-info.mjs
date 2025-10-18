#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

if (!UNIPILE_DSN || !UNIPILE_API_KEY) {
  console.error('❌ Missing Unipile credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function debugProxyInfo() {
  const userEmail = 'tl@innovareai.com';
  
  console.log('\n🔍 Debugging Proxy Info for:', userEmail);
  console.log('━'.repeat(60));
  
  // 1. Get user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, current_workspace_id')
    .eq('email', userEmail)
    .single();
  
  if (userError || !user) {
    console.error('❌ User not found:', userError);
    return;
  }
  
  console.log('✅ User found:', {
    id: user.id,
    email: user.email,
    workspace_id: user.current_workspace_id
  });
  
  // 2. Get LinkedIn accounts from workspace_accounts
  const { data: linkedinAccounts, error: accountsError } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', user.current_workspace_id)
    .eq('user_id', user.id)
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected');
  
  if (accountsError) {
    console.error('❌ Error fetching accounts:', accountsError);
    return;
  }
  
  console.log(`\n📋 Found ${linkedinAccounts?.length || 0} LinkedIn account(s) in workspace_accounts:`);
  linkedinAccounts?.forEach(acc => {
    console.log('  -', {
      unipile_id: acc.unipile_account_id,
      email: acc.account_identifier,
      name: acc.account_name
    });
  });
  
  if (!linkedinAccounts || linkedinAccounts.length === 0) {
    console.log('\n⚠️  No LinkedIn accounts found in workspace_accounts table');
    console.log('💡 Try running: npm run sync:linkedin');
    return;
  }
  
  // 3. Fetch from Unipile API
  console.log('\n🌐 Fetching from Unipile API...');
  
  for (const account of linkedinAccounts) {
    const accountUrl = UNIPILE_DSN.includes('.')
      ? `https://${UNIPILE_DSN}/api/v1/accounts/${account.unipile_account_id}`
      : `https://${UNIPILE_DSN}.unipile.com:13443/api/v1/accounts/${account.unipile_account_id}`;
    
    console.log(`\n📡 Calling: ${accountUrl}`);
    
    try {
      const response = await fetch(accountUrl, {
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('   ❌ Error response:', errorText.substring(0, 200));
        continue;
      }
      
      const accountData = await response.json();
      
      console.log('\n✅ Account data received:');
      console.log('   Account ID:', accountData.id);
      console.log('   Display name:', accountData.display_name);
      console.log('   Email:', accountData.identifier);
      
      // Extract proxy info
      console.log('\n🔍 Proxy information:');
      console.log('   connection_params:', JSON.stringify(accountData.connection_params, null, 2));
      console.log('   proxy:', JSON.stringify(accountData.proxy, null, 2));
      console.log('   sources:', JSON.stringify(accountData.sources, null, 2));
      
      const proxyInfo = {
        detected_location: accountData.connection_params?.im?.location || null,
        detected_country: accountData.connection_params?.im?.country || null,
        proxy_country: accountData.proxy?.country || 
                      accountData.connection_params?.im?.country ||
                      accountData.sources?.[0]?.proxy_country ||
                      null,
        proxy_city: accountData.proxy?.city || 
                   accountData.sources?.[0]?.proxy_city ||
                   null,
        connection_status: accountData.sources?.[0]?.status || 'unknown'
      };
      
      console.log('\n📊 Extracted proxy info:');
      console.log(JSON.stringify(proxyInfo, null, 2));
      
    } catch (error) {
      console.error('   ❌ Fetch error:', error.message);
    }
  }
}

debugProxyInfo().catch(console.error);
