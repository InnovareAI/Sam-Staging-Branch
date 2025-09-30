#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testHostedAuth(email) {
  console.log(`🧪 Testing hosted auth for: ${email}\n`);
  
  try {
    // Get user
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('✅ User found:', user.id);
    console.log('   Email:', user.email);
    
    // Check Unipile environment variables
    console.log('\n🔧 Environment Check:');
    console.log('   UNIPILE_DSN:', process.env.UNIPILE_DSN ? '✅ Set' : '❌ Missing');
    console.log('   UNIPILE_API_KEY:', process.env.UNIPILE_API_KEY ? '✅ Set' : '❌ Missing');
    
    if (!process.env.UNIPILE_DSN || !process.env.UNIPILE_API_KEY) {
      console.log('\n❌ Missing Unipile credentials. Cannot proceed.');
      return;
    }
    
    // Check if user has workspace  
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .maybeSingle();
    
    if (profileError) {
      console.log('\n⚠️  Error fetching user profile:', profileError.message);
    }
    
    if (!profile?.current_workspace_id) {
      console.log('\n❌ User has no workspace selected');
      console.log('   Profile data:', profile);
      return;
    }
    
    console.log('   Workspace ID:', profile.current_workspace_id);
    
    // Check existing LinkedIn accounts
    const { data: existingAccounts } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'LINKEDIN')
      .eq('connection_status', 'active');
    
    console.log('\n📊 Existing LinkedIn accounts:', existingAccounts?.length || 0);
    
    // Test Unipile API - Create hosted auth link
    const authType = (existingAccounts?.length || 0) > 0 ? 'reconnect' : 'create';
    console.log(`\n🔗 Testing ${authType} flow...`);
    
    const expirationDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const expiresOn = expirationDate.toISOString().replace(/\.\d{3}Z$/, '.000Z');
    
    const userContextPayload = {
      user_id: user.id,
      user_email: user.email,
      workspace_id: profile.current_workspace_id
    };
    
    const encodedContext = encodeURIComponent(JSON.stringify(userContextPayload));
    const callbackUrl = 'https://app.meet-sam.com/api/unipile/hosted-auth/callback';
    const successRedirectUrl = `${callbackUrl}?status=success&user_context=${encodedContext}`;
    const failureRedirectUrl = `${callbackUrl}?status=error&user_context=${encodedContext}`;
    
    let hostedAuthPayload = {
      type: authType,
      expiresOn: expiresOn,
      api_url: `https://${process.env.UNIPILE_DSN}`,
      success_redirect_url: successRedirectUrl,
      failure_redirect_url: failureRedirectUrl,
      notify_url: callbackUrl,
      name: JSON.stringify(userContextPayload),
      bypass_success_screen: true
    };
    
    if (authType === 'create') {
      hostedAuthPayload.providers = ['LINKEDIN'];
    } else {
      hostedAuthPayload.reconnect_account = existingAccounts[0].unipile_account_id;
    }
    
    console.log('\n📤 Request payload:');
    console.log(JSON.stringify(hostedAuthPayload, null, 2));
    
    const url = `https://${process.env.UNIPILE_DSN}/api/v1/hosted/accounts/link`;
    console.log(`\n🌐 Calling: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(hostedAuthPayload)
    });
    
    console.log(`\n📥 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Error response:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log('\n✅ Success! Hosted auth link generated:');
    console.log('   URL:', data.url);
    console.log('   Object:', data.object);
    
    console.log('\n📋 Instructions:');
    console.log('1. Copy the URL above');
    console.log('2. Open it in your browser');
    console.log('3. Complete LinkedIn authentication');
    console.log('4. You will be redirected back to SAM AI');
    
    console.log('\n🔗 Quick open (may not work in all terminals):');
    console.log(`   open "${data.url}"`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Get email from command line or use default
const email = process.argv[2] || 'tl@innovareai.com';
testHostedAuth(email).catch(console.error);