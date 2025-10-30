#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findLinkedIn() {
  console.log('🔍 Finding LinkedIn accounts...\n');

  // Check all account types
  const { data: allAccounts } = await supabase
    .from('workspace_accounts')
    .select('account_type, account_name, connection_status, is_active')
    .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009');

  console.log('All accounts in workspace:');
  allAccounts?.forEach(acc => {
    console.log(`  - ${acc.account_name} (${acc.account_type}) - ${acc.connection_status}`);
  });

  console.log();

  // Look for LinkedIn specifically
  const { data: linkedinAccounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
    .eq('account_type', 'linkedin');

  console.log(`LinkedIn accounts found: ${linkedinAccounts?.length || 0}`);
  
  if (linkedinAccounts && linkedinAccounts.length > 0) {
    linkedinAccounts.forEach(acc => {
      console.log('\n✅ LinkedIn Account:');
      console.log(JSON.stringify(acc, null, 2));
    });
  } else {
    console.log('\n❌ No LinkedIn accounts found with account_type="linkedin"');
    console.log('\n💡 Accounts might need to be:');
    console.log('   1. Synced from Unipile');
    console.log('   2. Or created via LinkedIn OAuth');
  }
}

findLinkedIn();
