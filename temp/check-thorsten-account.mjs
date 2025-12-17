import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAccount() {
  console.log('Checking workspace_accounts for Thorsten Linz account...\n');

  // Find the workspace account
  const { data: accounts, error } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('unipile_account_id', 'mERQmojtSZq5GeomZZazlw');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Found accounts:', JSON.stringify(accounts, null, 2));

  if (accounts && accounts.length > 0) {
    const account = accounts[0];
    console.log('\n=== Account Details ===');
    console.log(`Account Name: ${account.account_name}`);
    console.log(`Workspace ID: ${account.workspace_id}`);
    console.log(`Unipile Account ID: ${account.unipile_account_id}`);
    console.log(`Connection Status: ${account.connection_status}`);
    console.log(`Account Type: ${account.account_type}`);
  }
}

checkAccount().catch(console.error);
