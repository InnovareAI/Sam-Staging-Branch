import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STAN_USER_ID = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';
const BLUE_LABEL_WORKSPACE_ID = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

async function testLinkedInCheck() {
  console.log('🔍 Testing LinkedIn Connection Check (Exact API Logic)...\n');

  // EXACT query from the API route (line 173-179)
  console.log('Running EXACT query from API route:');
  console.log(`  workspace_id = ${BLUE_LABEL_WORKSPACE_ID}`);
  console.log(`  user_id = ${STAN_USER_ID}`);
  console.log(`  account_type = 'linkedin'`);
  console.log(`  connection_status = 'connected'`);
  console.log('');

  const { data: userLinkedInAccounts, error: userAccountsError } = await supabase
    .from('workspace_accounts')
    .select('unipile_account_id, account_name, connection_status')
    .eq('workspace_id', BLUE_LABEL_WORKSPACE_ID)
    .eq('user_id', STAN_USER_ID)
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected');

  console.log('📊 Query Result:');
  if (userAccountsError) {
    console.log('❌ Error:', userAccountsError.message);
    console.log('   Code:', userAccountsError.code);
  }

  console.log(`   Accounts found: ${userLinkedInAccounts?.length || 0}`);

  if (userLinkedInAccounts && userLinkedInAccounts.length > 0) {
    console.log('✅ LinkedIn accounts FOUND!');
    userLinkedInAccounts.forEach(acc => {
      console.log(`   - ${acc.account_name}`);
      console.log(`     Unipile ID: ${acc.unipile_account_id}`);
      console.log(`     Status: ${acc.connection_status}`);
    });
    console.log('');
    console.log('✅ Stan SHOULD be able to run searches!');
  } else {
    console.log('❌ NO LinkedIn accounts found with these filters');
    console.log('');
    console.log('🔍 Debugging - checking without filters:');

    // Check ALL Stan's accounts
    const { data: allStanAccounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('user_id', STAN_USER_ID);

    console.log(`   Stan has ${allStanAccounts?.length || 0} total accounts`);
    if (allStanAccounts && allStanAccounts.length > 0) {
      allStanAccounts.forEach(acc => {
        console.log(`   - Type: ${acc.account_type}`);
        console.log(`     Status: ${acc.connection_status}`);
        console.log(`     Workspace: ${acc.workspace_id}`);
        console.log(`     Name: ${acc.account_name || 'None'}`);
        console.log(`     Unipile ID: ${acc.unipile_account_id || 'None'}`);
        console.log('');
      });
    }

    // Check workspace accounts (any user)
    console.log('🔍 Checking ALL workspace accounts:');
    const { data: workspaceAccounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', BLUE_LABEL_WORKSPACE_ID);

    console.log(`   Workspace has ${workspaceAccounts?.length || 0} total accounts`);
  }
}

testLinkedInCheck();
