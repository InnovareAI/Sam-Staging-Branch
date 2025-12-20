require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('LINKEDIN ACCOUNTS STATUS:');
  console.log('='.repeat(60) + '\n');

  const { data: accounts, error } = await supabase
    .from('user_unipile_accounts')
    .select('id, account_name, unipile_account_id, connection_status, platform')
    .order('account_name');

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  const targetNames = ['thorsten', 'charissa', 'irish', 'michelle', 'jennifer'];
  
  console.log('TARGET ACCOUNTS (for inbox monitoring):');
  console.log('-'.repeat(50));
  
  for (const acc of accounts) {
    const nameLower = (acc.account_name || '').toLowerCase();
    const isTarget = targetNames.some(function(n) { return nameLower.includes(n); });
    if (isTarget) {
      const status = acc.connection_status === 'OK' ? 'CONNECTED' : acc.connection_status;
      console.log('Name:', acc.account_name);
      console.log('  Status:', status);
      console.log('  Platform:', acc.platform);
      console.log('  Unipile ID:', acc.unipile_account_id);
      console.log('');
    }
  }

  console.log('\nALL ACCOUNTS SUMMARY:');
  console.log('-'.repeat(50));
  for (const acc of accounts) {
    const status = acc.connection_status === 'OK' ? 'OK' : acc.connection_status || 'unknown';
    console.log(acc.account_name, '-', acc.platform, '-', status);
  }

})();
