#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🧪 Testing Unipile Invitation Status API\n');

// Get a LinkedIn account
const { data: account } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('account_type', 'linkedin')
  .eq('connection_status', 'connected')
  .limit(1)
  .single();

if (!account) {
  console.error('❌ No LinkedIn account found');
  process.exit(1);
}

console.log(`Using account: ${account.account_name}`);
console.log(`Unipile ID: ${account.unipile_account_id}\n`);

// Test the API
const url = `https://${process.env.UNIPILE_DSN}/api/v1/users/invite/sent?account_id=${account.unipile_account_id}`;
console.log(`Calling: ${url}\n`);

try {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-KEY': process.env.UNIPILE_API_KEY || '',
      'Accept': 'application/json'
    }
  });

  console.log(`Status: ${response.status}\n`);

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ Error: ${error}`);
    process.exit(1);
  }

  const data = await response.json();
  console.log('✅ Response:', JSON.stringify(data, null, 2));
  
  if (data.items && data.items.length > 0) {
    console.log(`\n📊 Found ${data.items.length} sent invitations`);
    console.log('\nSample invitation:');
    console.log(JSON.stringify(data.items[0], null, 2));
  }
} catch (error) {
  console.error('❌ Fetch error:', error.message);
}
