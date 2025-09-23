// Check all associations without platform filter to test RLS
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllAssociations() {
  console.log('🔍 Checking ALL associations (no filters)...\n');

  try {
    // Check all associations without any filters
    console.log('📊 Checking all user_unipile_accounts...');
    const { data: allAccounts, error: allError } = await supabase
      .from('user_unipile_accounts')
      .select('*');

    if (allError) {
      console.error('❌ Error fetching all accounts:', allError);
      return;
    }

    console.log(`✅ Total associations found: ${allAccounts?.length || 0}\n`);

    if (allAccounts && allAccounts.length > 0) {
      console.log('📋 All associations:');
      allAccounts.forEach(account => {
        console.log(`  • ${account.account_name} (${account.platform}) - User: ${account.user_id}`);
        console.log(`    Account ID: ${account.unipile_account_id}`);
        console.log(`    Email: ${account.account_email || 'N/A'}`);
        console.log();
      });
    }

    // Check specifically for LinkedIn
    console.log('🔍 Checking specifically for LinkedIn platform...');
    const { data: linkedinAccounts, error: linkedinError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('platform', 'linkedin');

    if (linkedinError) {
      console.error('❌ Error fetching LinkedIn accounts:', linkedinError);
    } else {
      console.log(`✅ LinkedIn associations: ${linkedinAccounts?.length || 0}`);
    }

    // Check with case variations
    console.log('🔍 Checking with case variations...');
    const { data: linkedinUpper, error: upperError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('platform', 'LINKEDIN');

    if (upperError) {
      console.error('❌ Error fetching LINKEDIN accounts:', upperError);
    } else {
      console.log(`✅ LINKEDIN (uppercase) associations: ${linkedinUpper?.length || 0}`);
      if (linkedinUpper && linkedinUpper.length > 0) {
        linkedinUpper.forEach(account => {
          console.log(`  • ${account.account_name} - User: ${account.user_id}`);
        });
      }
    }

    // Try to find our specific account IDs
    console.log('\n🔍 Searching for specific account IDs...');
    const targetIds = ['he3RXnROSLuhONxgNle7dw', 'NLsTJRfCSg-WZAXCBo8w7A'];
    
    for (const accountId of targetIds) {
      const { data: specificAccount, error: specificError } = await supabase
        .from('user_unipile_accounts')
        .select('*')
        .eq('unipile_account_id', accountId);

      if (specificError) {
        console.log(`❌ Error finding ${accountId}:`, specificError);
      } else {
        console.log(`✅ Found ${accountId}: ${specificAccount?.length || 0} results`);
        if (specificAccount && specificAccount.length > 0) {
          specificAccount.forEach(acc => {
            console.log(`    ${acc.account_name} - ${acc.platform} - User: ${acc.user_id}`);
          });
        }
      }
    }

  } catch (error) {
    console.error('🚨 Error during check:', error);
  }
}

checkAllAssociations();