#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAPIEndpoint(email) {
  console.log(`🧪 Testing API endpoint for: ${email}\n`);
  
  try {
    // Get user and create session
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('✅ User found:', user.id);
    
    // Create a session token for the user
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
    });
    
    if (sessionError) {
      console.error('❌ Failed to generate session:', sessionError);
      return;
    }
    
    console.log('✅ Session generated');
    
    // Now test the API endpoint
    console.log('\n🔗 Testing /api/unipile/hosted-auth endpoint...');
    
    const apiUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    console.log('   API URL:', apiUrl);
    
    const response = await fetch(`${apiUrl}/api/unipile/hosted-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `sb-access-token=${sessionData.properties?.access_token}; sb-refresh-token=${sessionData.properties?.refresh_token}`
      },
      body: JSON.stringify({
        provider: 'LINKEDIN',
        redirect_url: `${apiUrl}/api/unipile/hosted-auth/callback`
      })
    });
    
    console.log('📥 Response status:', response.status);
    
    const data = await response.json();
    console.log('\n📄 Response data:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('\n✅ API test successful!');
      console.log('🔗 Auth URL:', data.auth_url?.substring(0, 100) + '...');
    } else {
      console.log('\n❌ API returned error:', data.error);
      if (data.debug_info) {
        console.log('🔍 Debug info:', data.debug_info);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

const email = process.argv[2] || 'tl@innovareai.com';
testAPIEndpoint(email).catch(console.error);