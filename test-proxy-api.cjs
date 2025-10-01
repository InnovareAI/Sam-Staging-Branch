#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function testProxyAPI() {
  console.log('🔍 Testing LinkedIn Proxy API endpoint...\n');
  
  // First, get a valid session token
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Sign in as the user
  console.log('🔐 Signing in as tl@innovareai.com...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'tl@innovareai.com',
    password: process.env.TEST_USER_PASSWORD || 'your-password-here'
  });
  
  if (authError) {
    console.error('❌ Auth failed:', authError.message);
    console.log('\n💡 Set TEST_USER_PASSWORD in .env.local or update the script with your password');
    return;
  }
  
  const accessToken = authData.session.access_token;
  console.log('✅ Signed in successfully\n');
  
  // Test the GET endpoint
  console.log('📡 Calling GET /api/linkedin/assign-proxy-ips...');
  
  try {
    const response = await fetch('http://localhost:3001/api/linkedin/assign-proxy-ips', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ API Error:', response.status, response.statusText);
      console.error('Response:', JSON.stringify(data, null, 2));
      return;
    }
    
    console.log('✅ API Response:\n');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.current_assignments && data.current_assignments.length > 0) {
      console.log('\n✅ Found assignments!');
      console.log(`   Total: ${data.current_assignments.length}`);
    } else {
      console.log('\n⚠️  No assignments returned by API');
      console.log('   This could be an RLS policy issue');
    }
    
  } catch (error) {
    console.error('❌ Error calling API:', error.message);
    console.log('\n💡 Make sure the dev server is running: npm run dev');
  }
}

testProxyAPI().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
