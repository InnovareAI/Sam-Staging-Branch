#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

console.log('🔍 Testing workspace LinkedIn account query...\n');

// Try the query that N8N is likely using
const { data, error } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', workspaceId)
  .eq('account_type', 'linkedin')
  .eq('connection_status', 'connected');

if (error) {
  console.error('❌ Error:', error);
} else {
  console.log(`✅ Found ${data?.length || 0} LinkedIn accounts:\n`);
  if (data?.length > 0) {
    data.forEach((acc, idx) => {
      console.log(`${idx + 1}. Account:`);
      console.log(`   ID: ${acc.id}`);
      console.log(`   Unipile Account ID: ${acc.unipile_account_id}`);
      console.log(`   Status: ${acc.connection_status}`);
      console.log(`   Account Type: ${acc.account_type}`);
      console.log('');
    });
  } else {
    console.log('⚠️ No connected LinkedIn accounts found!');
    console.log('\nThis is the issue - the workflow needs a connected LinkedIn account.');
    console.log('Check Settings → Integrations to connect LinkedIn via Unipile.');
  }
}
