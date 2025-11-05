import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

console.log('🔍 Debugging LinkedIn Search Pagination Issue\n');
console.log('Why are we only getting 50 results instead of 500?\n');

// Get Stan's account
const { data: account } = await supabase
  .from('workspace_accounts')
  .select('unipile_account_id, workspace_id')
  .eq('user_id', '6a927440-ebe1-49b4-ae5e-fbee5d27944d')
  .eq('account_type', 'linkedin')
  .single();

if (!account) {
  console.log('❌ No LinkedIn account found');
  process.exit(1);
}

console.log('✅ Found account:', account.unipile_account_id);
console.log('   Workspace:', account.workspace_id);

// Test search with pagination
const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

const searchUrl = UNIPILE_DSN.includes('.')
  ? `https://${UNIPILE_DSN}/api/v1/linkedin/search`
  : `https://${UNIPILE_DSN}.unipile.com:13443/api/v1/linkedin/search`;

console.log('\n📡 Testing Unipile API:\n');
console.log('   URL:', searchUrl);

// Simulate the search (you need to provide a saved search URL)
const testSearchUrl = 'https://www.linkedin.com/sales/search/people?savedSearchId=YOUR_SEARCH_ID';

console.log('\n🧪 Simulating batch 1...\n');

const params1 = new URLSearchParams({
  account_id: account.unipile_account_id,
  limit: '50'
});

const searchPayload = { url: testSearchUrl };

try {
  const response1 = await fetch(`${searchUrl}?${params1}`, {
    method: 'POST',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(searchPayload)
  });

  if (!response1.ok) {
    console.log('❌ Batch 1 failed:', response1.status, response1.statusText);
    const errorText = await response1.text();
    console.log('   Error:', errorText);
    process.exit(1);
  }

  const data1 = await response1.json();

  console.log('✅ Batch 1 Response:');
  console.log('   Items:', data1.items?.length || 0);
  console.log('   Cursor:', data1.cursor || 'NULL');
  console.log('   Has more?:', !!data1.cursor);
  console.log('   Response keys:', Object.keys(data1).join(', '));

  if (data1.cursor) {
    console.log('\n🧪 Simulating batch 2 with cursor...\n');

    const params2 = new URLSearchParams({
      account_id: account.unipile_account_id,
      limit: '50',
      cursor: data1.cursor
    });

    const response2 = await fetch(`${searchUrl}?${params2}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(searchPayload)
    });

    if (!response2.ok) {
      console.log('❌ Batch 2 failed:', response2.status, response2.statusText);
    } else {
      const data2 = await response2.json();
      console.log('✅ Batch 2 Response:');
      console.log('   Items:', data2.items?.length || 0);
      console.log('   Cursor:', data2.cursor || 'NULL');
      console.log('   Total so far:', (data1.items?.length || 0) + (data2.items?.length || 0));
    }
  } else {
    console.log('\n⚠️  NO CURSOR RETURNED!');
    console.log('   This is why pagination stops after 50 results.');
    console.log('   Possible reasons:');
    console.log('   1. Search has exactly 50 results (unlikely)');
    console.log('   2. Unipile API not returning cursor');
    console.log('   3. Search URL format issue');
    console.log('   4. Account permissions issue');
  }

} catch (error) {
  console.error('❌ Error:', error.message);
}

console.log('\n✅ Debug complete!');
