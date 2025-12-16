#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const THORSTEN_WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
const NEW_GOOGLE_ACCOUNT_ID = 'jYXN8FeCTEukNSXDoaH3hA';

console.log('🔍 VERIFYING GOOGLE CALENDAR CONNECTION');
console.log('='.repeat(70));

// Check if it's in workspace_accounts
const { data: accounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', THORSTEN_WORKSPACE_ID)
  .or('account_type.ilike.%google%,account_type.ilike.%calendar%');

console.log(`\nGoogle/Calendar accounts in workspace: ${accounts?.length || 0}`);
for (const a of accounts || []) {
  console.log(`\n   ID: ${a.id}`);
  console.log(`   Type: ${a.account_type}`);
  console.log(`   Name: ${a.account_name}`);
  console.log(`   Unipile ID: ${a.unipile_account_id}`);
  console.log(`   Status: ${a.connection_status}`);
}

// Check Unipile for the new account details
const UNIPILE_BASE_URL = 'https://api6.unipile.com:13670';
const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';

console.log('\n' + '─'.repeat(70));
console.log('Checking Unipile for account details...');

const response = await fetch(
  `${UNIPILE_BASE_URL}/api/v1/accounts/${NEW_GOOGLE_ACCOUNT_ID}`,
  {
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  }
);

if (response.ok) {
  const account = await response.json();
  console.log(`\n   Name: ${account.name}`);
  console.log(`   Type: ${account.type}`);
  console.log(`   Sources:`, account.sources?.map(s => `${s.id}: ${s.status}`).join(', '));
  console.log(`   Connection Params:`, JSON.stringify(account.connection_params, null, 2));
} else {
  console.log(`   Failed to fetch: ${response.status}`);
}

console.log('\n' + '='.repeat(70));
