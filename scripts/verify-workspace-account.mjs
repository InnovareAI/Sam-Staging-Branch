#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  console.log('🔍 Checking workspace_accounts table...\n');

  const { data, error } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
    .eq('account_type', 'email');

  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log(`Found ${data?.length || 0} email accounts:`);
    data?.forEach(acc => {
      console.log(`\n  Account: ${acc.account_identifier}`);
      console.log(`  Unipile ID: ${acc.unipile_account_id}`);
      console.log(`  Status: ${acc.connection_status}`);
      console.log(`  User ID: ${acc.user_id}`);
    });
  }
}

verify().catch(console.error);
