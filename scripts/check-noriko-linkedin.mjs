import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkNoriko() {
  console.log('\n🔍 Checking Noriko Y LinkedIn account status...\n');

  // Find Noriko's user account
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .ilike('email', '%noriko%')
    .single();

  if (userError || !user) {
    console.error('❌ User not found:', userError);
    return;
  }

  console.log('👤 User found:');
  console.log(`   Email: ${user.email}`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Current Workspace: ${user.current_workspace_id}`);

  // Check workspace accounts
  const { data: workspaceAccounts, error: accountsError } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', user.current_workspace_id)
    .eq('account_type', 'linkedin');

  console.log('\n📋 Workspace LinkedIn Accounts:');
  if (workspaceAccounts && workspaceAccounts.length > 0) {
    workspaceAccounts.forEach(account => {
      console.log(`   - ${account.account_name || account.account_identifier}`);
      console.log(`     ID: ${account.id}`);
      console.log(`     Unipile ID: ${account.unipile_account_id || 'N/A'}`);
      console.log(`     Status: ${account.connection_status || 'unknown'}`);
      console.log(`     Created: ${account.created_at}`);
      console.log('');
    });
  } else {
    console.log('   ⚠️  No LinkedIn accounts found in workspace_accounts');
  }

  // Check for any Unipile accounts not in workspace_accounts
  if (process.env.UNIPILE_DSN && process.env.UNIPILE_API_KEY) {
    try {
      const unipileResponse = await fetch(
        `https://${process.env.UNIPILE_DSN}/api/v1/accounts?providers[]=LINKEDIN`,
        {
          headers: {
            'X-API-KEY': process.env.UNIPILE_API_KEY,
            'Accept': 'application/json'
          }
        }
      );

      if (unipileResponse.ok) {
        const unipileData = await unipileResponse.json();
        console.log('\n🔗 Unipile LinkedIn Accounts (all):');
        
        if (unipileData.items && unipileData.items.length > 0) {
          unipileData.items.forEach(account => {
            console.log(`   - ${account.name || account.identifier}`);
            console.log(`     ID: ${account.id}`);
            console.log(`     Email: ${account.identifier}`);
            console.log(`     Is Valid: ${account.is_valid}`);
            console.log('');
          });

          // Check if any are orphaned (not in workspace_accounts)
          const workspaceAccountIds = new Set(
            workspaceAccounts?.map(a => a.unipile_account_id).filter(Boolean) || []
          );
          
          const orphanedAccounts = unipileData.items.filter(
            account => !workspaceAccountIds.has(account.id)
          );

          if (orphanedAccounts.length > 0) {
            console.log('\n⚠️  ORPHANED ACCOUNTS (in Unipile but not workspace_accounts):');
            orphanedAccounts.forEach(account => {
              console.log(`   - ${account.name || account.identifier} (ID: ${account.id})`);
            });
          }
        } else {
          console.log('   No accounts found in Unipile');
        }
      }
    } catch (unipileError) {
      console.error('❌ Error checking Unipile:', unipileError.message);
    }
  }

  console.log('\n✅ Check complete\n');
}

checkNoriko().catch(console.error);
