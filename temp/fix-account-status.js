import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

// Accounts that need to be marked as disconnected
const disconnectedAccounts = [
  // Deleted from Unipile
  'avp6xHsCRZaP5uSPmjc2jg', // Irish Maguad (InnovareAI workspace)
  '4Vv6oZ73RvarImDN6iYbbg', // Stan Bounev (InnovareAI workspace)
  'DMGuhuk_R_yBFqXJlT21ow', // Stan Bounev (other workspace)
  'MT39bAEDTJ6e_ZPY337UgQ', // Michelle Angelica Gestuveo (InnovareAI workspace)

  // Credential issues
  'mERQmojtSZq5GeomZZazlw'  // Thorsten Linz (InnovareAI workspace - NEEDS RE-AUTH)
];

async function fixAccountStatus() {
  console.log('Updating account statuses...\n');

  for (const accountId of disconnectedAccounts) {
    console.log(`Updating ${accountId}...`);

    const { data, error } = await supabase
      .from('user_unipile_accounts')
      .update({
        connection_status: 'disconnected',
        updated_at: new Date().toISOString()
      })
      .eq('unipile_account_id', accountId)
      .select();

    if (error) {
      console.error(`  ❌ Error: ${error.message}`);
    } else {
      console.log(`  ✅ Updated: ${data[0]?.account_name} (${data[0]?.platform})`);
    }
  }

  console.log('\n=== VERIFICATION ===');
  console.log('Checking InnovareAI workspace accounts...\n');

  const { data: accounts, error: checkError } = await supabase
    .from('user_unipile_accounts')
    .select('unipile_account_id, account_name, platform, connection_status')
    .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
    .eq('platform', 'LINKEDIN');

  if (checkError) {
    console.error('Error checking accounts:', checkError);
  } else {
    accounts.forEach(acc => {
      const status = acc.connection_status === 'active' ? '✅ ACTIVE' : '❌ DISCONNECTED';
      console.log(`${status} ${acc.account_name} (${acc.unipile_account_id})`);
    });
  }
}

fixAccountStatus().catch(console.error);
