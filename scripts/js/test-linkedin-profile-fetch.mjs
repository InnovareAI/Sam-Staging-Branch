#!/usr/bin/env node
import 'dotenv/config';

// Test fetching a LinkedIn profile from Unipile
const testUrl = 'https://www.linkedin.com/in/hakima-mokrane-phd-956b6928';
const linkedinUsername = testUrl.split('/in/')[1]?.split('?')[0]?.replace('/', '');

console.log('Testing LinkedIn profile fetch...');
console.log('LinkedIn URL:', testUrl);
console.log('Extracted username:', linkedinUsername);
console.log();

// Get a valid Unipile account ID from database
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: account } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('account_type', 'linkedin')
  .eq('connection_status', 'connected')
  .limit(1)
  .single();

if (!account) {
  console.error('❌ No connected LinkedIn account found');
  process.exit(1);
}

console.log('Using Unipile account:', account.account_name);
console.log('Unipile account ID:', account.unipile_account_id);
console.log();

// Try to fetch the profile
const profileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/${linkedinUsername}?account_id=${account.unipile_account_id}`;
console.log('Fetching:', profileUrl);
console.log();

try {
  const response = await fetch(profileUrl, {
    method: 'GET',
    headers: {
      'X-API-KEY': process.env.UNIPILE_API_KEY || '',
      'Accept': 'application/json'
    }
  });

  console.log('Response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Error:', errorText);
  } else {
    const profileData = await response.json();
    console.log('✅ Profile data:', JSON.stringify(profileData, null, 2));
    
    // Check for name fields
    console.log('\n📝 Name fields found:');
    console.log('  display_name:', profileData.display_name);
    console.log('  name:', profileData.name);
    console.log('  full_name:', profileData.full_name);
    console.log('  first_name:', profileData.first_name);
    console.log('  last_name:', profileData.last_name);
    console.log('  provider_id:', profileData.provider_id);
  }
} catch (error) {
  console.error('❌ Fetch error:', error.message);
}
